const express = require('express')
const PaperAccount = require('../models/PaperAccount')
const asyncHandler = require('../middleware/asyncHandler')
const requireAuth = require('../middleware/requireAuth')
const { fetchQuotes, cleanSymbol: clean } = require('../utils/market')
const { isTrading, nextOpenLabel } = require('../utils/marketHours')
const { fill, processPending, round2 } = require('../utils/paperOrders')

const router = express.Router()

const { STARTING_CAPITAL } = PaperAccount

const MAX_ORDERS = 200
const MAX_PENDING = 20

// Everything in this module belongs to the logged in user's own wallet.
router.use(requireAuth)

/**
 * The wallet, with any after-hours orders filled first if the market has since
 * opened. Doing it on read means a queued order comes good the next time the
 * page is looked at, with no scheduler to run.
 */
async function accountFor(userId, { settle = true } = {}) {
  const account =
    (await PaperAccount.findOne({ user: userId })) ||
    (await PaperAccount.create({ user: userId }))

  if (settle) await processPending(account)
  return account
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
        status: o.status || 'EXECUTED',
        price: o.price === null || o.price === undefined ? null : round2(o.price),
        amount: o.amount === null || o.amount === undefined ? null : round2(o.amount),
        realised: o.realised === null || o.realised === undefined ? null : round2(o.realised),
        note: o.note || null,
        placedAt: o.placedAt,
        executedAt: o.executedAt || null,
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
    const name = quote.name || symbol
    const sequence = account.orders.length + 1
    const ref = `ORD-${String(sequence).padStart(4, '0')}`

    const order = {
      ref,
      symbol,
      name,
      action,
      qty,
      placedAt: new Date(),
    }

    // Outside market hours the order is queued rather than filled. Filling it
    // against a stale closing price would book a profit or loss on a trade the
    // exchange never saw.
    if (!isTrading([quote])) {
      const queued = account.orders.filter((o) => o.status === 'PENDING').length
      if (queued >= MAX_PENDING) {
        return res.status(400).json({
          errors: { form: `You already have ${MAX_PENDING} orders waiting for the open.` },
        })
      }

      // Catching the obvious problems now is kinder than letting it sit all
      // night only to be rejected at the bell.
      const estimate = round2(qty * quote.price)
      if (action === 'BUY' && estimate > account.cash) {
        return res.status(400).json({
          errors: {
            form: `Not enough cash. At the last price this needs about ₹${estimate.toLocaleString('en-IN')}.`,
          },
        })
      }
      if (action === 'SELL') {
        const held = account.holdings.find((h) => h.symbol === symbol)
        const alreadyQueued = account.orders
          .filter((o) => o.status === 'PENDING' && o.action === 'SELL' && o.symbol === symbol)
          .reduce((sum, o) => sum + o.qty, 0)

        if (!held || held.qty < qty + alreadyQueued) {
          return res.status(400).json({
            errors: {
              form: held
                ? `You hold ${held.qty} shares of ${symbol}${alreadyQueued ? ` and ${alreadyQueued} are already queued to sell` : ''}.`
                : `You do not hold any ${symbol}.`,
            },
          })
        }
      }

      account.orders.push({ ...order, status: 'PENDING' })
      if (account.orders.length > MAX_ORDERS) {
        account.orders = account.orders.slice(-MAX_ORDERS)
      }
      await account.save()

      return res.json({
        account: shape(account),
        queued: {
          ref,
          symbol,
          name,
          action,
          qty,
          estimate,
          opensAt: nextOpenLabel(),
        },
      })
    }

    const result = fill(account, order, round2(quote.price))
    if (!result.ok) {
      return res.status(400).json({ errors: { form: result.reason } })
    }

    account.orders.push({
      ...order,
      status: 'EXECUTED',
      price: result.price,
      amount: result.amount,
      realised: result.realised,
      executedAt: new Date(),
    })

    // Keep the document bounded; the oldest orders drop off first.
    if (account.orders.length > MAX_ORDERS) {
      account.orders = account.orders.slice(-MAX_ORDERS)
    }

    await account.save()

    res.json({
      account: shape(account),
      fill: {
        symbol,
        name,
        action,
        qty,
        price: result.price,
        amount: result.amount,
        realised: result.realised,
      },
    })
  }),
)

// A queued order can be called off any time before the market opens. Once it
// has filled there is nothing to cancel, so only pending ones are accepted.
router.delete(
  '/order/:ref',
  asyncHandler(async (req, res) => {
    const ref = String(req.params.ref || '').slice(0, 20)
    const account = await accountFor(req.userId)
    const order = account.orders.find((o) => o.ref === ref)

    if (!order) {
      return res.status(404).json({ errors: { form: 'That order is not in your order book.' } })
    }
    if (order.status !== 'PENDING') {
      return res.status(400).json({
        errors: { form: 'Only orders still waiting for the market open can be cancelled.' },
      })
    }

    order.status = 'CANCELLED'
    order.note = 'Cancelled before the market opened'
    await account.save()

    res.json({ account: shape(account) })
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
