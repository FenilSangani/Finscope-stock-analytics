const express = require('express')
const asyncHandler = require('../middleware/asyncHandler')
const { fetchQuotes, fetchCloses, cleanSymbol } = require('../utils/market')

const router = express.Router()

// Batch price lookups shared by the modules that show many stocks at once:
// the watchlist and the paper trading wallet.

function symbolList(raw) {
  return String(raw || '')
    .split(',')
    .map(cleanSymbol)
    .filter(Boolean)
    .slice(0, 25)
}

router.get(
  '/quotes',
  asyncHandler(async (req, res) => {
    const symbols = symbolList(req.query.symbols)
    if (symbols.length === 0) return res.json({ quotes: [] })

    try {
      res.json({ quotes: await fetchQuotes(symbols) })
    } catch {
      res.status(503).json({ errors: { form: 'Market data service is not running.' } })
    }
  }),
)

router.get(
  '/closes',
  asyncHandler(async (req, res) => {
    const symbols = symbolList(req.query.symbols)
    if (symbols.length === 0) return res.json({ dates: [], closes: {} })

    const asked = String(req.query.period).toUpperCase()
    const period = ['1MO', '6MO', '1Y', '2Y'].includes(asked) ? asked : '1Y'

    try {
      res.json(await fetchCloses(symbols, period))
    } catch {
      res.status(503).json({ errors: { form: 'Market data service is not running.' } })
    }
  }),
)

module.exports = router
