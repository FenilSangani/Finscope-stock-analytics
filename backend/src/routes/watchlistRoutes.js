const express = require('express')
const Watchlist = require('../models/Watchlist')
const asyncHandler = require('../middleware/asyncHandler')
const requireAuth = require('../middleware/requireAuth')
const { cleanSymbol } = require('../utils/market')

const router = express.Router()

const { MAX_LISTS, MAX_SYMBOLS } = Watchlist

router.use(requireAuth)

async function watchlistFor(userId) {
  const existing = await Watchlist.findOne({ user: userId })
  if (existing) return existing
  return Watchlist.create({ user: userId })
}

function shape(doc) {
  return {
    maxLists: MAX_LISTS,
    maxSymbols: MAX_SYMBOLS,
    lists: doc.lists.map((list) => ({
      id: String(list._id),
      name: list.name,
      stocks: list.stocks.map((s) => s.symbol),
    })),
  }
}

function cleanName(raw) {
  return String(raw || '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 30)
}

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const doc = await watchlistFor(req.userId)
    res.json(shape(doc))
  }),
)

router.post(
  '/',
  asyncHandler(async (req, res) => {
    const name = cleanName(req.body.name)
    if (!name) {
      return res.status(400).json({ errors: { name: 'Give the watchlist a name' } })
    }

    const doc = await watchlistFor(req.userId)

    if (doc.lists.length >= MAX_LISTS) {
      return res.status(400).json({
        errors: { form: `You can keep up to ${MAX_LISTS} watchlists. Delete one first.` },
      })
    }
    if (doc.lists.some((l) => l.name.toLowerCase() === name.toLowerCase())) {
      return res.status(400).json({ errors: { name: 'You already have a list with that name' } })
    }

    doc.lists.push({ name, stocks: [] })
    await doc.save()
    res.json(shape(doc))
  }),
)

router.patch(
  '/:listId',
  asyncHandler(async (req, res) => {
    const name = cleanName(req.body.name)
    if (!name) {
      return res.status(400).json({ errors: { name: 'Give the watchlist a name' } })
    }

    const doc = await watchlistFor(req.userId)
    const list = doc.lists.id(req.params.listId)
    if (!list) {
      return res.status(404).json({ errors: { form: 'That watchlist no longer exists.' } })
    }

    const clash = doc.lists.some(
      (l) => String(l._id) !== String(list._id) && l.name.toLowerCase() === name.toLowerCase(),
    )
    if (clash) {
      return res.status(400).json({ errors: { name: 'You already have a list with that name' } })
    }

    list.name = name
    await doc.save()
    res.json(shape(doc))
  }),
)

router.delete(
  '/:listId',
  asyncHandler(async (req, res) => {
    const doc = await watchlistFor(req.userId)

    if (doc.lists.length <= 1) {
      return res.status(400).json({ errors: { form: 'Keep at least one watchlist.' } })
    }

    const list = doc.lists.id(req.params.listId)
    if (!list) {
      return res.status(404).json({ errors: { form: 'That watchlist no longer exists.' } })
    }

    doc.lists.pull({ _id: list._id })
    await doc.save()
    res.json(shape(doc))
  }),
)

router.post(
  '/:listId/stocks',
  asyncHandler(async (req, res) => {
    const symbol = cleanSymbol(req.body.symbol)
    if (!symbol) {
      return res.status(400).json({ errors: { form: 'Pick a stock to add.' } })
    }

    const doc = await watchlistFor(req.userId)
    const list = doc.lists.id(req.params.listId)
    if (!list) {
      return res.status(404).json({ errors: { form: 'That watchlist no longer exists.' } })
    }

    if (list.stocks.some((s) => s.symbol === symbol)) {
      return res.status(400).json({ errors: { form: `${symbol} is already on this list.` } })
    }
    if (list.stocks.length >= MAX_SYMBOLS) {
      return res.status(400).json({
        errors: { form: `A watchlist holds up to ${MAX_SYMBOLS} stocks. Remove one first.` },
      })
    }

    list.stocks.push({ symbol })
    await doc.save()
    res.json(shape(doc))
  }),
)

router.delete(
  '/:listId/stocks/:symbol',
  asyncHandler(async (req, res) => {
    const symbol = cleanSymbol(req.params.symbol)
    const doc = await watchlistFor(req.userId)
    const list = doc.lists.id(req.params.listId)
    if (!list) {
      return res.status(404).json({ errors: { form: 'That watchlist no longer exists.' } })
    }

    list.stocks = list.stocks.filter((s) => s.symbol !== symbol)
    await doc.save()
    res.json(shape(doc))
  }),
)

module.exports = router
