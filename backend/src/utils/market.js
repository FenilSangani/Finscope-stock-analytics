const mongoose = require('mongoose')
const MarketCache = require('../models/MarketCache')

const MARKET_SERVICE_URL = process.env.MARKET_SERVICE_URL || 'http://localhost:8000'

// A cold Python function plus a Yahoo round trip can take a few seconds, so
// give it room before giving up.
const UPSTREAM_TIMEOUT_MS = 25000

const QUOTE_TTL_MS = 60 * 1000
const CLOSES_TTL_MS = 30 * 60 * 1000

/** Trim a user supplied ticker down to the characters NSE actually uses. */
function cleanSymbol(symbol) {
  return String(symbol || '')
    .toUpperCase()
    .replace(/[^A-Z0-9&-]/g, '')
    .slice(0, 20)
}

/** Reading or writing the cache must never be the reason a request fails. */
async function readCache(key) {
  if (mongoose.connection.readyState !== 1) return null

  try {
    const hit = await MarketCache.findOne({ key, expiresAt: { $gt: new Date() } }).lean()
    return hit ? hit.payload : null
  } catch {
    return null
  }
}

async function writeCache(key, payload, ttlMs) {
  if (mongoose.connection.readyState !== 1) return

  try {
    await MarketCache.updateOne(
      { key },
      { key, payload, expiresAt: new Date(Date.now() + ttlMs) },
      { upsert: true },
    )
  } catch {
    /* a cache miss next time is not worth failing the request over */
  }
}

async function callService(path, timeoutMs = UPSTREAM_TIMEOUT_MS) {
  const res = await fetch(`${MARKET_SERVICE_URL}${path}`, {
    signal: AbortSignal.timeout(timeoutMs),
  })
  if (!res.ok) throw new Error(`Market service replied ${res.status}`)
  return res.json()
}

/**
 * Fetch through the shared cache, returning the upstream status so a caller can
 * tell "no such stock" apart from "the service is down".
 *
 * Only successful responses are stored, and never for a stock that was not
 * found, so a typo cannot poison the cache for ten minutes.
 */
async function cachedCall(key, path, ttlMs, timeoutMs = UPSTREAM_TIMEOUT_MS) {
  const cached = await readCache(key)
  if (cached) return { ok: true, status: 200, data: cached }

  let res
  try {
    res = await fetch(`${MARKET_SERVICE_URL}${path}`, {
      signal: AbortSignal.timeout(timeoutMs),
    })
  } catch {
    return { ok: false, status: 503, data: null }
  }

  if (!res.ok) return { ok: false, status: res.status, data: null }

  const data = await res.json().catch(() => null)
  if (data === null) return { ok: false, status: 502, data: null }

  await writeCache(key, data, ttlMs)
  return { ok: true, status: 200, data }
}

/**
 * Live prices from the market data service, cached briefly in Mongo.
 *
 * Orders are priced through here rather than from whatever the browser sent,
 * so a tampered request cannot buy at a made up price.
 */
async function fetchQuotes(symbols) {
  if (symbols.length === 0) return []

  const asked = [...new Set(symbols)]
  // The cache key is sorted so the same set of stocks is one entry however it
  // was ordered, but the answer is handed back in the order it was asked for.
  const key = `quotes:${[...asked].sort().join(',')}`

  let quotes = await readCache(key)

  if (!quotes) {
    const data = await callService(
      `/market/quotes?symbols=${encodeURIComponent([...asked].sort().join(','))}`,
    )
    quotes = data.quotes || []
    if (quotes.length > 0) await writeCache(key, quotes, QUOTE_TTL_MS)
  }

  const bySymbol = new Map(quotes.map((q) => [q.symbol, q]))
  return asked.map((symbol) => bySymbol.get(symbol)).filter(Boolean)
}

async function fetchCloses(symbols, period) {
  if (symbols.length === 0) return { dates: [], closes: {} }

  const wanted = [...new Set(symbols)].sort()
  const key = `closes:${period}:${wanted.join(',')}`

  const cached = await readCache(key)
  if (cached) return cached

  const data = await callService(
    `/market/closes?symbols=${encodeURIComponent(wanted.join(','))}&period=${encodeURIComponent(
      period,
    )}`,
  )

  if (data.dates?.length) await writeCache(key, data, CLOSES_TTL_MS)
  return data
}

module.exports = {
  fetchQuotes,
  fetchCloses,
  cachedCall,
  cleanSymbol,
  MARKET_SERVICE_URL,
}
