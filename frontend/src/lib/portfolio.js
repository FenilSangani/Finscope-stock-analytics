// Rebuilds what the paper wallet was worth on each past trading day.
//
// Nothing historical is stored in the database — only the orders. The wallet as
// it stands today is wound back through those orders to recover the balance at
// the start of the window, then replayed forward against real closing prices.
// That way the line is always consistent with the trades that were actually
// placed, instead of a snapshot that could drift.

function round2(value) {
  return Math.round(value * 100) / 100
}

/** Calendar day of a timestamp in the viewer's own timezone, as YYYY-MM-DD. */
function dayOf(timestamp) {
  const d = new Date(timestamp)
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${month}-${day}`
}

export function buildValueCurve({ dates, closes, orders, cash, holdings, liveValue }) {
  if (!dates || dates.length === 0) return null

  // Where each order falls on the price calendar. Orders older than the window
  // are already baked into the starting balance, so they are left alone.
  const placed = []
  for (const order of orders) {
    const day = dayOf(order.placedAt)
    if (day < dates[0]) continue

    let index = dates.length - 1
    for (let i = 0; i < dates.length; i++) {
      if (dates[i] > day) {
        index = Math.max(0, i - 1)
        break
      }
    }
    placed.push({ ...order, index })
  }

  // Wind the wallet back to the first day of the window.
  let runningCash = cash
  const qty = new Map(holdings.map((h) => [h.symbol, h.qty]))

  for (const order of placed) {
    const held = qty.get(order.symbol) || 0
    if (order.action === 'BUY') {
      runningCash += order.amount
      qty.set(order.symbol, held - order.qty)
    } else {
      runningCash -= order.amount
      qty.set(order.symbol, held + order.qty)
    }
  }

  const byIndex = new Map()
  for (const order of placed) {
    if (!byIndex.has(order.index)) byIndex.set(order.index, [])
    byIndex.get(order.index).push(order)
  }

  const missing = new Set()
  const lastKnown = new Map()

  const values = dates.map((_, i) => {
    for (const order of byIndex.get(i) || []) {
      const held = qty.get(order.symbol) || 0
      if (order.action === 'BUY') {
        runningCash -= order.amount
        qty.set(order.symbol, held + order.qty)
      } else {
        runningCash += order.amount
        qty.set(order.symbol, held - order.qty)
      }
    }

    let total = runningCash
    for (const [symbol, held] of qty) {
      if (held <= 0) continue

      const close = closes[symbol]?.[i]
      if (close === null || close === undefined) {
        // Before a stock's first close in the window, carry the last price we
        // do know; if there is none at all, flag it rather than inventing one.
        const fallback = lastKnown.get(symbol)
        if (fallback === undefined) missing.add(symbol)
        else total += held * fallback
        continue
      }

      lastKnown.set(symbol, close)
      total += held * close
    }

    return round2(total)
  })

  // The last close can be hours old during market hours, so the line ends on
  // the same live value the rest of the page is showing.
  if (typeof liveValue === 'number' && values.length > 0) {
    values[values.length - 1] = round2(liveValue)
  }

  return { dates, values, missing: [...missing] }
}

/** "15 Oct" style labels for the chart axis. */
export function shortLabel(isoDate) {
  const [year, month, day] = isoDate.split('-')
  const date = new Date(Number(year), Number(month) - 1, Number(day))
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })
}
