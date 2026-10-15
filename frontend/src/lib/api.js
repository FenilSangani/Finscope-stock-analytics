import { clearSession } from './auth'

// Set at build time by Vite, so the deployed front end points at the deployed
// API. A trailing slash in the variable would double up every path.
const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/$/, '')

const NETWORK_ERROR = {
  errors: { form: 'Cannot reach the server right now. Please check your connection.' },
}

/**
 * A token that the API has rejected is dead — it expired, or the account was
 * deleted. Clearing it sends the next render back to the login page instead of
 * leaving every panel stuck on an error.
 */
function handleExpiredSession() {
  clearSession()
  if (window.location.pathname !== '/auth') {
    window.location.assign('/auth')
  }
}

async function request(path, body) {
  let res
  try {
    res = await fetch(`${API_URL}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  } catch {
    throw NETWORK_ERROR
  }

  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw data
  }
  return data
}

export function registerUser(payload) {
  return request('/api/auth/register', payload)
}

export function loginUser(payload) {
  return request('/api/auth/login', payload)
}

async function get(path) {
  let res
  try {
    res = await fetch(`${API_URL}${path}`)
  } catch {
    throw NETWORK_ERROR
  }

  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw data
  }
  return data
}

export function fetchStock(symbol) {
  return get(`/api/stocks/${encodeURIComponent(symbol)}`)
}

async function authed(path, method = 'GET', body) {
  const token = localStorage.getItem('finscope_token')
  let res
  try {
    res = await fetch(`${API_URL}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    })
  } catch {
    throw NETWORK_ERROR
  }

  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    if (res.status === 401) handleExpiredSession()
    throw data
  }
  return data
}

export function fetchAccount() {
  return authed('/api/auth/me')
}

export function deleteAccount() {
  return authed('/api/auth/account', 'DELETE')
}

export function fetchHistory(symbol, period) {
  return get(`/api/stocks/history/${encodeURIComponent(symbol)}?period=${period}`)
}

export function fetchQuotes(symbols) {
  return get(`/api/stocks/quotes?symbols=${encodeURIComponent(symbols.join(','))}`)
}

export function searchSymbols(query) {
  return get(`/api/stocks/symbols/search?q=${encodeURIComponent(query)}`)
}

export function fetchComparison(symbols) {
  return get(`/api/stocks/compare/batch?symbols=${encodeURIComponent(symbols.join(','))}`)
}

// Paper trading. The wallet lives on the server, so every change comes back as
// the whole account and the page never has to guess what the balance is.
export function fetchPaperAccount() {
  return authed('/api/paper/account')
}

export function placePaperOrder({ symbol, action, qty }) {
  return authed('/api/paper/order', 'POST', { symbol, action, qty })
}

export function resetPaperAccount() {
  return authed('/api/paper/reset', 'POST', {})
}

export function fetchPaperSummary() {
  return authed('/api/paper/summary')
}

// Batch market data, shared by the watchlist and the paper trading wallet.
export function fetchMarketQuotes(symbols) {
  return get(`/api/market/quotes?symbols=${encodeURIComponent(symbols.join(','))}`)
}

export function fetchMarketCloses(symbols, period = '1Y') {
  return get(`/api/market/closes?symbols=${encodeURIComponent(symbols.join(','))}&period=${period}`)
}

// Watchlists
export function fetchWatchlists() {
  return authed('/api/watchlists')
}

export function createWatchlist(name) {
  return authed('/api/watchlists', 'POST', { name })
}

export function renameWatchlist(listId, name) {
  return authed(`/api/watchlists/${listId}`, 'PATCH', { name })
}

export function deleteWatchlist(listId) {
  return authed(`/api/watchlists/${listId}`, 'DELETE')
}

export function addWatchlistStock(listId, symbol) {
  return authed(`/api/watchlists/${listId}/stocks`, 'POST', { symbol })
}

export function removeWatchlistStock(listId, symbol) {
  return authed(`/api/watchlists/${listId}/stocks/${encodeURIComponent(symbol)}`, 'DELETE')
}
