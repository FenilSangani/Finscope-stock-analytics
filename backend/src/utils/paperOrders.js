const { fetchQuotes } = require('./market')
const { isTrading } = require('./marketHours')

function round2(value) {
  return Math.round(value * 100) / 100
}

/**
 * Apply a fill to the wallet: move the cash, update the position, and record
 * what was booked on a sell.
 *
 * Returns the fill, or a reason it could not go through. Nothing is changed
 * when it fails, so a rejected order leaves the wallet exactly as it was.
 */
function fill(account, order, price) {
  const amount = round2(order.qty * price)
  const position = account.holdings.find((h) => h.symbol === order.symbol)

  if (order.action === 'BUY') {
    if (amount > account.cash) {
      return { ok: false, reason: `Needed ₹${amount.toLocaleString('en-IN')} but the wallet had ₹${round2(account.cash).toLocaleString('en-IN')}.` }
    }

    account.cash = round2(account.cash - amount)

    if (position) {
      const totalQty = position.qty + order.qty
      position.avgPrice = round2((position.qty * position.avgPrice + amount) / totalQty)
      position.qty = totalQty
    } else {
      account.holdings.push({
        symbol: order.symbol,
        name: order.name || order.symbol,
        qty: order.qty,
        avgPrice: price,
      })
    }

    return { ok: true, price, amount, realised: null }
  }

  if (!position || position.qty < order.qty) {
    return {
      ok: false,
      reason: position
        ? `Only ${position.qty} shares were held by then.`
        : 'The position had already been sold.',
    }
  }

  const realised = round2(order.qty * (price - position.avgPrice))
  account.cash = round2(account.cash + amount)
  account.realised = round2(account.realised + realised)
  position.qty -= order.qty

  if (position.qty === 0) {
    account.holdings = account.holdings.filter((h) => h.symbol !== order.symbol)
  }

  return { ok: true, price, amount, realised }
}

/**
 * Work through orders that were queued while the market was shut.
 *
 * They fill at the price when the exchange actually reopens, in the order they
 * were placed — not at the stale closing price they were queued against, which
 * would hand out a profit that never existed. An order that no longer fits the
 * wallet is rejected with the reason kept on it.
 */
async function processPending(account) {
  const pending = account.orders.filter((o) => o.status === 'PENDING')
  if (pending.length === 0) return { processed: 0, changed: false }

  const symbols = [...new Set(pending.map((o) => o.symbol))]

  let quotes = []
  try {
    quotes = await fetchQuotes(symbols)
  } catch {
    return { processed: 0, changed: false }
  }

  if (!isTrading(quotes)) return { processed: 0, changed: false }

  const priceOf = new Map(quotes.map((q) => [q.symbol, q.price]))
  let processed = 0

  // Oldest first, so a queue of orders spends the cash in the order it was asked for.
  for (const order of [...pending].sort((a, b) => a.placedAt - b.placedAt)) {
    const price = priceOf.get(order.symbol)
    if (!price) continue

    const result = fill(account, order, price)
    order.executedAt = new Date()

    if (result.ok) {
      order.status = 'EXECUTED'
      order.price = result.price
      order.amount = result.amount
      order.realised = result.realised
      order.note = 'Queued after hours, filled at the open'
    } else {
      order.status = 'REJECTED'
      order.note = result.reason
    }

    processed += 1
  }

  if (processed > 0) await account.save()
  return { processed, changed: processed > 0 }
}

module.exports = { fill, processPending, round2 }
