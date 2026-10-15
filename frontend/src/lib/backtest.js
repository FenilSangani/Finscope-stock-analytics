// Backtest engines. They take a plain array of closing prices, so the same
// functions will run unchanged on real price history later.

function sma(values, period) {
  const out = new Array(values.length).fill(null)
  let sum = 0
  for (let i = 0; i < values.length; i++) {
    sum += values[i]
    if (i >= period) sum -= values[i - period]
    if (i >= period - 1) out[i] = sum / period
  }
  return out
}

function rsi(values, period = 14) {
  const out = new Array(values.length).fill(null)
  let gain = 0
  let loss = 0

  for (let i = 1; i < values.length; i++) {
    const diff = values[i] - values[i - 1]
    const up = Math.max(diff, 0)
    const down = Math.max(-diff, 0)

    if (i <= period) {
      gain += up
      loss += down
      if (i === period) {
        gain /= period
        loss /= period
        out[i] = loss === 0 ? 100 : 100 - 100 / (1 + gain / loss)
      }
      continue
    }

    // Wilder's smoothing, the standard way RSI is averaged.
    gain = (gain * (period - 1) + up) / period
    loss = (loss * (period - 1) + down) / period
    out[i] = loss === 0 ? 100 : 100 - 100 / (1 + gain / loss)
  }
  return out
}

/**
 * Worst peak-to-trough fall, from a series of return percentages.
 *
 * The returns are turned into a growth index first (10% becomes 1.10), because
 * comparing one percentage against another percentage gives a meaningless
 * number that can run past -100%.
 */
function maxDrawdown(returnPcts) {
  let peak = -Infinity
  let worst = 0
  for (const pct of returnPcts) {
    const index = 1 + pct / 100
    if (index > peak) peak = index
    if (peak > 0) {
      const dd = ((index - peak) / peak) * 100
      if (dd < worst) worst = dd
    }
  }
  return Number(worst.toFixed(2))
}

function annualise(totalReturnPct, days) {
  const years = days / 252
  if (years <= 0) return 0
  const growth = 1 + totalReturnPct / 100
  if (growth <= 0) return -100
  return Number(((Math.pow(growth, 1 / years) - 1) * 100).toFixed(2))
}

// Benchmark: simply holding the stock for the whole period.
function buyAndHold(prices) {
  return prices.map((p) => Number(((p / prices[0] - 1) * 100).toFixed(2)))
}

/**
 * Buy the dip: every day the stock closes at least `dipPct` below the
 * previous close, buy `qty` shares at that closing price.
 *
 * Money keeps going in over time, so the equity curve is tracked as a
 * percentage of what has actually been invested so far — that is the only
 * fair way to read the result.
 */
export function runBuyTheDip(prices, dates, { dipPct = 2, qty = 10 } = {}) {
  const trades = []
  const curve = []
  let shares = 0
  let invested = 0

  for (let i = 0; i < prices.length; i++) {
    const price = prices[i]

    if (i > 0) {
      const changePct = ((price - prices[i - 1]) / prices[i - 1]) * 100
      if (changePct <= -dipPct) {
        const amount = price * qty
        shares += qty
        invested += amount
        trades.push({
          date: dates[i],
          action: 'BUY',
          price: Number(price.toFixed(2)),
          qty,
          amount: Number(amount.toFixed(2)),
          note: `Fell ${changePct.toFixed(2)}%`,
        })
      }
    }

    const value = shares * price
    curve.push({
      date: dates[i],
      invested: Number(invested.toFixed(2)),
      value: Number(value.toFixed(2)),
      returnPct: invested > 0 ? Number((((value - invested) / invested) * 100).toFixed(2)) : 0,
    })
  }

  const finalValue = curve.at(-1).value
  const totalReturnPct = curve.at(-1).returnPct
  const inProfit = trades.filter((t) => prices.at(-1) > t.price).length

  return {
    trades,
    curve,
    benchmark: buyAndHold(prices),
    metrics: {
      totalReturnPct,
      annualReturnPct: annualise(totalReturnPct, prices.length),
      maxDrawdownPct: maxDrawdown(curve.map((c) => c.returnPct)),
      totalInvested: Number(invested.toFixed(2)),
      finalValue: Number(finalValue.toFixed(2)),
      profit: Number((finalValue - invested).toFixed(2)),
      tradeCount: trades.length,
      winRate: trades.length ? Number(((inProfit / trades.length) * 100).toFixed(1)) : 0,
      winLabel: 'Buys now in profit',
      sharesHeld: shares,
      benchmarkReturnPct: buyAndHold(prices).at(-1),
    },
  }
}

/**
 * Signal strategies trade a fixed pot of capital: go fully in on a buy
 * signal, fully out on a sell signal.
 */
function runSignalStrategy(prices, dates, signals, capital, extraSeries) {
  const trades = []
  const curve = []
  let cash = capital
  let shares = 0
  let entryPrice = null
  let wins = 0
  let closed = 0

  for (let i = 0; i < prices.length; i++) {
    const price = prices[i]
    const signal = signals[i]

    if (signal === 'BUY' && shares === 0 && cash > price) {
      const qty = Math.floor(cash / price)
      if (qty > 0) {
        shares = qty
        cash -= qty * price
        entryPrice = price
        trades.push({
          date: dates[i],
          action: 'BUY',
          price: Number(price.toFixed(2)),
          qty,
          amount: Number((qty * price).toFixed(2)),
          note: 'Entry signal',
        })
      }
    } else if (signal === 'SELL' && shares > 0) {
      const amount = shares * price
      const pnl = (price - entryPrice) * shares
      cash += amount
      closed += 1
      if (pnl > 0) wins += 1
      trades.push({
        date: dates[i],
        action: 'SELL',
        price: Number(price.toFixed(2)),
        qty: shares,
        amount: Number(amount.toFixed(2)),
        note: `${pnl >= 0 ? '+' : ''}₹${Math.round(pnl).toLocaleString('en-IN')} on this trade`,
        pnl: Number(pnl.toFixed(2)),
      })
      shares = 0
      entryPrice = null
    }

    const value = cash + shares * price
    curve.push({
      date: dates[i],
      invested: capital,
      value: Number(value.toFixed(2)),
      returnPct: Number((((value - capital) / capital) * 100).toFixed(2)),
    })
  }

  const finalValue = curve.at(-1).value
  const totalReturnPct = curve.at(-1).returnPct

  return {
    trades,
    curve,
    benchmark: buyAndHold(prices),
    series: extraSeries,
    metrics: {
      totalReturnPct,
      annualReturnPct: annualise(totalReturnPct, prices.length),
      maxDrawdownPct: maxDrawdown(curve.map((c) => c.returnPct)),
      totalInvested: capital,
      finalValue: Number(finalValue.toFixed(2)),
      profit: Number((finalValue - capital).toFixed(2)),
      tradeCount: trades.length,
      winRate: closed ? Number(((wins / closed) * 100).toFixed(1)) : 0,
      winLabel: 'Profitable round trips',
      sharesHeld: shares,
      benchmarkReturnPct: buyAndHold(prices).at(-1),
    },
  }
}

/** Golden cross / death cross on two moving averages. */
export function runMaCrossover(prices, dates, { fast = 20, slow = 50, capital = 100000 } = {}) {
  const fastMa = sma(prices, fast)
  const slowMa = sma(prices, slow)
  const signals = prices.map((_, i) => {
    if (i === 0 || fastMa[i] === null || slowMa[i] === null) return null
    if (fastMa[i - 1] === null || slowMa[i - 1] === null) return null
    const crossedUp = fastMa[i - 1] <= slowMa[i - 1] && fastMa[i] > slowMa[i]
    const crossedDown = fastMa[i - 1] >= slowMa[i - 1] && fastMa[i] < slowMa[i]
    return crossedUp ? 'BUY' : crossedDown ? 'SELL' : null
  })

  return runSignalStrategy(prices, dates, signals, capital, {
    fastMa,
    slowMa,
    fastLabel: `${fast} DMA`,
    slowLabel: `${slow} DMA`,
  })
}

/** Buy when RSI leaves oversold, sell when it leaves overbought. */
export function runRsiStrategy(
  prices,
  dates,
  { period = 14, oversold = 30, overbought = 70, capital = 100000 } = {},
) {
  const rsiValues = rsi(prices, period)
  const signals = prices.map((_, i) => {
    if (i === 0 || rsiValues[i] === null || rsiValues[i - 1] === null) return null
    if (rsiValues[i - 1] < oversold && rsiValues[i] >= oversold) return 'BUY'
    if (rsiValues[i - 1] > overbought && rsiValues[i] <= overbought) return 'SELL'
    return null
  })

  return runSignalStrategy(prices, dates, signals, capital, {
    rsi: rsiValues,
    oversold,
    overbought,
  })
}

export const STRATEGIES = [
  {
    id: 'dip',
    name: 'Buy the Dip',
    tagline: 'Buy a fixed quantity every time the stock drops sharply',
    run: runBuyTheDip,
  },
  {
    id: 'ma',
    name: 'Moving Average Crossover',
    tagline: 'Buy on a golden cross, sell on a death cross',
    run: runMaCrossover,
  },
  {
    id: 'rsi',
    name: 'RSI Oversold',
    tagline: 'Buy when RSI recovers from oversold, sell when it cools from overbought',
    run: runRsiStrategy,
  },
]
