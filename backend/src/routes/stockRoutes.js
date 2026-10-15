const express = require('express')
const asyncHandler = require('../middleware/asyncHandler')
const { cachedCall, cleanSymbol } = require('../utils/market')

const router = express.Router()

// A full company report costs the market service several Yahoo calls, so it is
// worth caching for as long as the numbers stay meaningful.
const REPORT_TTL_MS = 10 * 60 * 1000
const HISTORY_TTL_MS = 60 * 60 * 1000
const SEARCH_TTL_MS = 60 * 60 * 1000
const QUOTE_TTL_MS = 60 * 1000

// Building a report can take a while on a cold start, so it gets more room
// than the lighter endpoints.
const REPORT_TIMEOUT_MS = 50000

/** Map an upstream failure onto a message the page can show as it is. */
function fail(res, status, notFound) {
  if (status === 404) {
    return res.status(404).json({ errors: { form: notFound } })
  }
  if (status === 503) {
    return res.status(503).json({ errors: { form: 'Market data service is not running.' } })
  }
  return res.status(502).json({
    errors: { form: 'Could not load market data right now. Please try again.' },
  })
}

function symbolList(raw, limit) {
  return String(raw || '')
    .split(',')
    .map(cleanSymbol)
    .filter(Boolean)
    .slice(0, limit)
}

router.get(
  '/history/:symbol',
  asyncHandler(async (req, res) => {
    const symbol = cleanSymbol(req.params.symbol)
    const asked = String(req.query.period).toUpperCase()
    const period = ['1Y', '3Y', '5Y'].includes(asked) ? asked : '3Y'

    if (!symbol) {
      return res.status(400).json({ errors: { form: 'Enter a stock symbol' } })
    }

    const result = await cachedCall(
      `history:${symbol}:${period}`,
      `/history/${symbol}?period=${period}`,
      HISTORY_TTL_MS,
    )

    if (!result.ok) {
      return fail(res, result.status, `No price history found for "${symbol}".`)
    }
    res.json(result.data)
  }),
)

router.get(
  '/quotes',
  asyncHandler(async (req, res) => {
    const symbols = symbolList(req.query.symbols, 8)
    if (symbols.length === 0) {
      return res.status(400).json({ errors: { form: 'Pass at least one symbol' } })
    }

    const key = `stockquotes:${[...symbols].sort().join(',')}`
    const result = await cachedCall(
      key,
      `/quotes?symbols=${encodeURIComponent(symbols.join(','))}`,
      QUOTE_TTL_MS,
    )

    if (!result.ok) {
      return fail(res, result.status, 'Could not load quotes right now.')
    }
    res.json(result.data)
  }),
)

router.get(
  '/symbols/search',
  asyncHandler(async (req, res) => {
    const q = String(req.query.q || '').slice(0, 40)

    const result = await cachedCall(
      `search:${q.toLowerCase()}`,
      `/symbols?q=${encodeURIComponent(q)}`,
      SEARCH_TTL_MS,
    )

    if (!result.ok) {
      return fail(res, result.status, 'Could not search stocks right now.')
    }
    res.json(result.data)
  }),
)

router.get(
  '/compare/batch',
  asyncHandler(async (req, res) => {
    const symbols = symbolList(req.query.symbols, 4)
    if (symbols.length < 2) {
      return res.status(400).json({ errors: { form: 'Pick at least two stocks to compare' } })
    }

    const key = `compare:${[...symbols].sort().join(',')}`
    const result = await cachedCall(
      key,
      `/compare?symbols=${encodeURIComponent(symbols.join(','))}`,
      REPORT_TTL_MS,
      REPORT_TIMEOUT_MS,
    )

    if (!result.ok) {
      return fail(res, result.status, `No NSE data found for ${symbols.join(', ')}.`)
    }
    res.json(result.data)
  }),
)

router.get(
  '/:symbol',
  asyncHandler(async (req, res) => {
    const symbol = cleanSymbol(req.params.symbol)
    if (!symbol) {
      return res.status(400).json({ errors: { form: 'Enter a stock symbol' } })
    }

    const result = await cachedCall(
      `report:${symbol}`,
      `/stock/${symbol}`,
      REPORT_TTL_MS,
      REPORT_TIMEOUT_MS,
    )

    if (!result.ok) {
      return fail(
        res,
        result.status,
        `No NSE data found for "${symbol}". Check the symbol and try again.`,
      )
    }
    res.json(result.data)
  }),
)

module.exports = router
