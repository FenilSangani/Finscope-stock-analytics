const express = require('express')
const PaperAccount = require('../models/PaperAccount')
const asyncHandler = require('../middleware/asyncHandler')
const requireAuth = require('../middleware/requireAuth')
const { fetchQuotes, cleanSymbol: clean } = require('../utils/market')

const router = express.Router()

const { STARTING_CAPITAL } = PaperAccount

const MAX_ORDERS = 200

// Everything in this module belongs to the logged in user's own wallet.
router.use(requireAuth)

function round2(value) {
  return Math.round(value * 100) / 100
}

async function accountFor(userId) {
  const existing = await PaperAccount.findOne({ user: userId })
  if (existing) return existing
  return PaperAccount.create({ user: userId })
}

function shape(account) {
  return {
    cash: round2(account.cash),
    realised: round2(account.realised),
    startingCapital: STARTING_CAPITAL,
    holdings: account.holdings.map((h) => ({
      symbol: h.symbol,
      name: h.name,
      qty: h.qty,
      avgPrice: round2(h.avgPrice),
    })),
    orders: account.orders
      .slice()
      .sort((a, b) => b.placedAt - a.placedAt)
      .map((o) => ({
        ref: o.ref,
        symbol: o.symbol,
        name: o.name,
        action: o.action,
        qty: o.qty,
        price: round2(o.price),
        amount: round2(o.amount),
        realised: o.realised === null || o.realised === undefined ? null : round2(o.realised),
        placedAt: o.placedAt,
      })),
  }
}

/** Cash plus every holding at its live price, or at cost if no price loads. */
async function valueOf(account) {
  const symbols = [...new Set(account.holdings.map((h) => h.symbol))]

  let quotes = []
  try {
    quotes = await fetchQuotes(symbols)
  } catch {
    quotes = []
  }

  const priceOf = new Map(quotes.map((q) => [q.symbol, q.price]))
  const invested = account.holdings.reduce((sum, h) => sum + h.qty * h.avgPrice, 0)
  const currentValue = account.holdings.reduce(
    (sum, h) => sum + h.qty * (priceOf.get(h.symbol) ?? h.avgPrice),
    0,
  )

  const portfolio = account.cash + currentValue

  return {
    cash: round2(account.cash),
    invested: round2(invested),
    currentValue: round2(currentValue),
    portfolio: round2(portfolio),
    totalPnl: round2(portfolio - STARTING_CAPITAL),
    totalPnlPct: round2(((portfolio - STARTING_CAPITAL) / STARTING_CAPITAL) * 100),
    startingCapital: STARTING_CAPITAL,
    positions: account.holdings.length,
    // False when a price was missing, so the page can say the figure is at cost.
    live: symbols.length === 0 || symbols.every((s) => priceOf.has(s)),
  }
}

router.get(
  '/account',
  asyncHandler(async (req, res) => {
    const account = await accountFor(req.userId)
    res.json({ account: shape(account) })
  }),
)

router.post(
  '/order',
  asyncHandler(async (req, res) => {
    const symbol = clean(req.body.symbol)
    const action = String(req.body.action || '').toUpperCase()
    const qty = Number(req.body.qty)

    if (!symbol) {
      return res.status(400).json({ errors: { form: 'Pick a stock to trade.' } })
    }
    if (action !== 'BUY' && action !== 'SELL') {
      return res.status(400).json({ errors: { form: 'An order must be a buy or a sell.' } })
    }
    if (!Number.isInteger(qty) || qty < 1 || qty > 1000000) {
      return res.status(400).json({ errors: { form: 'Enter a whole number of shares.' } })
    }

    // The fill price comes from the market service, never from the request.
    let quote
    try {
      const quotes = await fetchQuotes([symbol])
      quote = quotes[0]
    } catch {
      return res.status(503).json({ errors: { form: 'Market data service is not running.' } })
    }

    if (!quote || !quote.price) {
      return res
        .status(404)
        .json({ errors: { form: `No live price found for "${symbol}" right now.` } })
    }

    const account = await accountFor(req.userId)
    const price = round2(quote.price)
    const amount = round2(qty * price)
    const position = account.holdings.find((h) => h.symbol === symbol)

    let realised = null

    if (action === 'BUY') {
      if (amount > account.cash) {
        return res.status(400).json({
          errors: {
            form: `Not enough cash. This order needs ₹${amount.toLocaleString('en-IN')}.`,
          },
        })
      }

      account.cash = round2(account.cash - amount)

      if (position) {
        const totalQty = position.qty + qty
        position.avgPrice = round2((position.qty * position.avgPrice + amount) / totalQty)
        position.qty = totalQty
      } else {
        account.holdings.push({ symbol, name: quote.name || symbol, qty, avgPrice: price })
      }
    } else {
      if (!position || position.qty < qty) {
        return res.status(400).json({
          errors: {
            form: position
              ? `You only hold ${position.qty} shares of ${symbol}.`
              : `You do not hold any ${symbol}.`,
          },
        })
      }

      realised = round2(qty * (price - position.avgPrice))
      account.cash = round2(account.cash + amount)
      account.realised = round2(account.realised + realised)
      position.qty -= qty
      if (position.qty === 0) {
        account.holdings = account.holdings.filter((h) => h.symbol !== symbol)
      }
    }

    const sequence = account.orders.length + 1
    account.orders.push({
      ref: `ORD-${String(sequence).padStart(4, '0')}`,
      symbol,
      name: quote.name || symbol,
      action,
      qty,
      price,
      amount,
      realised,
      placedAt: new Date(),
    })

    // Keep the document bounded; the oldest orders drop off first.
    if (account.orders.length > MAX_ORDERS) {
      account.orders = account.orders.slice(-MAX_ORDERS)
    }

    await account.save()

    res.json({
      account: shape(account),
      fill: { symbol, name: quote.name || symbol, action, qty, price, amount, realised },
    })
  }),
)

router.post(
  '/reset',
  asyncHandler(async (req, res) => {
    const account = await accountFor(req.userId)

    account.cash = STARTING_CAPITAL
    account.realised = 0
    account.holdings = []
    account.orders = []

    await account.save()
    res.json({ account: shape(account) })
  }),
)

// The sidebar shows this on every page, so it is one small call rather than
// the whole wallet plus a round of quotes.
router.get(
  '/summary',
  asyncHandler(async (req, res) => {
    const account = await accountFor(req.userId)
    res.json({ summary: await valueOf(account) })
  }),
)

module.exports = router
