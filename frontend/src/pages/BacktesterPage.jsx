import { useEffect, useMemo, useState } from 'react'
import {
  CategoryScale,
  Chart as ChartJS,
  Filler,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  Tooltip,
} from 'chart.js'
import { Line } from 'react-chartjs-2'
import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  History,
  Info,
  ListOrdered,
  AlertCircle,
  Loader2,
  Play,
  Search,
  Settings2,
  TrendingDown,
  TrendingUp,
  Trophy,
} from 'lucide-react'
import Sidebar from '../components/dashboard/Sidebar'
import { fetchHistory, searchSymbols } from '../lib/api'
import { runBuyTheDip, runMaCrossover, runRsiStrategy } from '../lib/backtest'

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Filler,
  Legend,
  Tooltip,
)

const PERIODS = [
  { label: '1 Year', code: '1Y' },
  { label: '3 Year', code: '3Y' },
  { label: '5 Year', code: '5Y' },
]

const STRATEGY_TABS = [
  { id: 'dip', name: 'Buy the Dip', tagline: 'Buy a fixed quantity each time the stock falls sharply' },
  { id: 'ma', name: 'MA Crossover', tagline: 'Buy on a golden cross, sell on a death cross' },
  { id: 'rsi', name: 'RSI Oversold', tagline: 'Buy when RSI recovers from oversold, sell when it cools off' },
]

function inr(value, digits = 0) {
  if (value === null || value === undefined) return '—'
  return `₹${Number(value).toLocaleString('en-IN', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })}`
}

function Section({ icon: Icon, title, subtitle, children, right }) {
  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
            <Icon className="h-4 w-4" />
          </span>
          <div>
            <h2 className="text-base font-bold text-gray-900">{title}</h2>
            {subtitle && <p className="mt-0.5 text-sm text-gray-500">{subtitle}</p>}
          </div>
        </div>
        {right}
      </div>
      <div className="mt-5">{children}</div>
    </section>
  )
}

function Field({ label, hint, children }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-700">{label}</label>
      {children}
      {hint && <p className="mt-1 text-xs text-gray-400">{hint}</p>}
    </div>
  )
}

/**
 * Keeps a numeric field tidy while it is being typed into: digits and a
 * single decimal point only, with no leading zeros ("040" becomes "40").
 * An empty string is allowed so the field can be cleared.
 */
function cleanNumber(value) {
  let v = value.replace(/[^\d.]/g, '')

  const firstDot = v.indexOf('.')
  if (firstDot !== -1) {
    v = v.slice(0, firstDot + 1) + v.slice(firstDot + 1).replace(/\./g, '')
  }

  return v.replace(/^0+(?=\d)/, '')
}

const inputClass =
  'mt-1.5 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 focus:outline-none'

export default function BacktesterPage() {
  const [symbol, setSymbol] = useState('RELIANCE')
  const [period, setPeriod] = useState('3 Year')
  const [strategy, setStrategy] = useState('dip')

  // Kept as text while typing so the field shows exactly what was typed —
  // a controlled number input would leave stray characters like "040" on
  // screen because React sees no change in the parsed value.
  const [dipPct, setDipPct] = useState('2')
  const [qty, setQty] = useState('10')
  const [fast, setFast] = useState('20')
  const [slow, setSlow] = useState('50')
  const [rsiPeriod, setRsiPeriod] = useState('14')
  const [oversold, setOversold] = useState('30')
  const [overbought, setOverbought] = useState('70')
  const [capital, setCapital] = useState('100000')

  // Stock picker backed by the full NSE list.
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [showPicker, setShowPicker] = useState(false)
  const [stockName, setStockName] = useState('Reliance Industries Limited')

  // Real price history for the selected stock and period.
  const [history, setHistory] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const [config, setConfig] = useState({
    strategy: 'dip',
    dipPct: 2,
    qty: 10,
    fast: 20,
    slow: 50,
    rsiPeriod: 14,
    oversold: 30,
    overbought: 70,
    capital: 100000,
  })

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)

    const code = PERIODS.find((p) => p.label === period).code
    fetchHistory(symbol, code)
      .then((data) => {
        if (cancelled) return
        setHistory(data)
        setStockName(data.name)
      })
      .catch((err) => {
        if (cancelled) return
        setHistory(null)
        setError(err?.errors?.form || 'Could not load price history for this stock.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [symbol, period])

  useEffect(() => {
    if (!showPicker) return
    let cancelled = false
    const timer = setTimeout(() => {
      searchSymbols(query)
        .then((data) => {
          if (!cancelled) setResults(data.results || [])
        })
        .catch(() => {
          if (!cancelled) setResults([])
        })
    }, 250)

    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [query, showPicker])

  function runBacktest() {
    // Parse once, here, with a sane floor so an empty or silly field cannot
    // produce a nonsense backtest.
    const num = (value, fallback, min) => {
      const parsed = Number(value)
      if (!Number.isFinite(parsed) || parsed < min) return fallback
      return parsed
    }

    setConfig({
      strategy,
      dipPct: num(dipPct, 2, 0.1),
      qty: num(qty, 10, 1),
      fast: num(fast, 20, 2),
      slow: num(slow, 50, 3),
      rsiPeriod: num(rsiPeriod, 14, 2),
      oversold: num(oversold, 30, 1),
      overbought: num(overbought, 70, 2),
      capital: num(capital, 100000, 1000),
    })
  }

  const result = useMemo(() => {
    if (!history) return null

    const { prices, dates } = history

    if (config.strategy === 'dip') {
      return {
        prices,
        dates,
        ...runBuyTheDip(prices, dates, { dipPct: config.dipPct, qty: config.qty }),
      }
    }
    if (config.strategy === 'ma') {
      return {
        prices,
        dates,
        ...runMaCrossover(prices, dates, {
          fast: config.fast,
          slow: config.slow,
          capital: config.capital,
        }),
      }
    }
    return {
      prices,
      dates,
      ...runRsiStrategy(prices, dates, {
        period: config.rsiPeriod,
        oversold: config.oversold,
        overbought: config.overbought,
        capital: config.capital,
      }),
    }
  }, [config, history])

  const activeStrategy = STRATEGY_TABS.find((s) => s.id === config.strategy)

  // Everything below is only drawn once a backtest has produced a result.
  const m = result?.metrics
  const beatsMarket = m ? m.totalReturnPct > m.benchmarkReturnPct : false

  const returnChart = result && {
    labels: result.dates,
    datasets: [
      {
        label: 'Strategy',
        data: result.curve.map((c) => c.returnPct),
        borderColor: '#2563eb',
        backgroundColor: (ctx) => {
          const { chart } = ctx
          const { ctx: c, chartArea } = chart
          if (!chartArea) return 'transparent'
          const g = c.createLinearGradient(0, chartArea.top, 0, chartArea.bottom)
          g.addColorStop(0, 'rgba(37,99,235,0.18)')
          g.addColorStop(1, 'rgba(255,255,255,0)')
          return g
        },
        borderWidth: 2,
        pointRadius: 0,
        pointHoverRadius: 4,
        tension: 0.2,
        fill: true,
      },
      {
        label: 'Buy & Hold',
        data: result.benchmark,
        borderColor: '#9ca3af',
        borderWidth: 1.5,
        borderDash: [5, 4],
        pointRadius: 0,
        pointHoverRadius: 4,
        tension: 0.2,
        fill: false,
      },
    ],
  }

  const returnOptions = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    scales: {
      x: { display: false },
      y: {
        grid: { color: '#f1f5f9' },
        ticks: {
          color: '#9ca3af',
          font: { size: 11 },
          callback: (v) => `${v}%`,
        },
      },
    },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: '#111827',
        padding: 12,
        cornerRadius: 10,
        usePointStyle: true,
        boxWidth: 8,
        boxHeight: 8,
        callbacks: {
          label: (ctx) => `${ctx.dataset.label}: ${ctx.parsed.y >= 0 ? '+' : ''}${ctx.parsed.y}%`,
        },
      },
    },
  }

  // Price chart with the actual buy and sell points marked.
  const tradeByDate = new Map((result?.trades || []).map((t) => [t.date, t]))
  const priceChart = result && {
    labels: result.dates,
    datasets: [
      {
        label: 'Price',
        data: result.prices.map((p) => Number(p.toFixed(2))),
        borderColor: '#111827',
        borderWidth: 1.5,
        tension: 0.2,
        fill: false,
        pointRadius: result.dates.map((d) => (tradeByDate.has(d) ? 4 : 0)),
        pointBackgroundColor: result.dates.map((d) => {
          const t = tradeByDate.get(d)
          if (!t) return 'transparent'
          return t.action === 'BUY' ? '#10b981' : '#ef4444'
        }),
        pointBorderColor: '#fff',
        pointBorderWidth: 1.5,
        pointHoverRadius: 6,
      },
      ...(result.series?.fastMa
        ? [
            {
              label: result.series.fastLabel,
              data: result.series.fastMa,
              borderColor: '#2563eb',
              borderWidth: 1.5,
              pointRadius: 0,
              tension: 0.2,
              fill: false,
            },
            {
              label: result.series.slowLabel,
              data: result.series.slowMa,
              borderColor: '#f59e0b',
              borderWidth: 1.5,
              pointRadius: 0,
              tension: 0.2,
              fill: false,
            },
          ]
        : []),
    ],
  }

  const priceOptions = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    scales: {
      x: { display: false },
      y: {
        grid: { color: '#f1f5f9' },
        ticks: {
          color: '#9ca3af',
          font: { size: 11 },
          callback: (v) => `₹${v.toLocaleString('en-IN')}`,
        },
      },
    },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: '#111827',
        padding: 12,
        cornerRadius: 10,
        callbacks: {
          label: (ctx) => `${ctx.dataset.label}: ₹${ctx.parsed.y.toLocaleString('en-IN')}`,
          afterBody: (items) => {
            const t = tradeByDate.get(items[0].label)
            return t ? `\n${t.action} ${t.qty} @ ₹${t.price} — ${t.note}` : ''
          },
        },
      },
    },
  }

  const stats = !m
    ? []
    : [
    {
      label: 'Total Return',
      value: `${m.totalReturnPct >= 0 ? '+' : ''}${m.totalReturnPct}%`,
      tone: m.totalReturnPct >= 0 ? 'text-emerald-600' : 'text-red-500',
      note: 'On the money actually invested',
    },
    {
      label: 'Annualised Return',
      value: `${m.annualReturnPct >= 0 ? '+' : ''}${m.annualReturnPct}%`,
      tone: m.annualReturnPct >= 0 ? 'text-emerald-600' : 'text-red-500',
      note: 'Average per year',
    },
    {
      label: 'Max Drawdown',
      value: `${m.maxDrawdownPct}%`,
      tone: 'text-red-500',
      note: 'Worst fall from a peak',
    },
    {
      label: m.winLabel,
      value: `${m.winRate}%`,
      tone: 'text-gray-900',
      note: `${m.tradeCount} trades in total`,
    },
    {
      label: 'Total Invested',
      value: inr(m.totalInvested),
      tone: 'text-gray-900',
      note: config.strategy === 'dip' ? 'Added bit by bit on dips' : 'Starting capital',
    },
    {
      label: 'Final Value',
      value: inr(m.finalValue),
      tone: m.profit >= 0 ? 'text-emerald-600' : 'text-red-500',
      note: `${m.profit >= 0 ? 'Profit' : 'Loss'} of ${inr(Math.abs(m.profit))}`,
    },
  ]

  return (
    <div className="flex min-h-screen bg-[#f8f9fb]">
      <Sidebar />

      <div className="flex min-w-0 flex-1 flex-col">
        <main className="flex-1 space-y-5 p-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Strategy Backtester</h1>
            <p className="mt-1 text-sm text-gray-500">
              Test a trading rule on past prices and see what it would have returned.
            </p>
          </div>

          {/* Strategy picker */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {STRATEGY_TABS.map((s) => (
              <button
                key={s.id}
                onClick={() => setStrategy(s.id)}
                className={`rounded-2xl border p-5 text-left transition ${
                  strategy === s.id
                    ? 'border-blue-500 bg-blue-50/50 ring-1 ring-blue-500'
                    : 'border-gray-200 bg-white hover:border-gray-300'
                }`}
              >
                <p className="text-sm font-bold text-gray-900">{s.name}</p>
                <p className="mt-1 text-xs text-gray-500">{s.tagline}</p>
              </button>
            ))}
          </div>

          {/* Settings */}
          <Section
            icon={Settings2}
            title="Strategy Settings"
            subtitle="Change the rules, then run the backtest again"
          >
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Field label="Stock" hint={stockName}>
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setShowPicker((v) => !v)}
                    className={`${inputClass} flex items-center justify-between text-left`}
                  >
                    <span className="font-semibold">{symbol}</span>
                    <Search className="h-4 w-4 text-gray-400" />
                  </button>

                  {showPicker && (
                    <div className="absolute z-20 mt-2 w-full overflow-hidden rounded-xl border border-gray-200 bg-white shadow-lg">
                      <div className="relative border-b border-gray-100">
                        <Search className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-gray-400" />
                        <input
                          autoFocus
                          value={query}
                          onChange={(e) => setQuery(e.target.value)}
                          placeholder="Search any NSE stock"
                          className="w-full py-2.5 pr-4 pl-10 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none"
                        />
                      </div>
                      <div className="max-h-64 overflow-y-auto">
                        {results.length === 0 ? (
                          <p className="px-4 py-3 text-sm text-gray-500">No match found.</p>
                        ) : (
                          results.map((s) => (
                            <button
                              key={s.symbol}
                              type="button"
                              onClick={() => {
                                setSymbol(s.symbol)
                                setStockName(s.name)
                                setQuery('')
                                setShowPicker(false)
                              }}
                              className="flex w-full items-start justify-between gap-3 px-4 py-2.5 text-left transition hover:bg-gray-50"
                            >
                              <span className="shrink-0 text-sm font-semibold text-gray-900">
                                {s.symbol}
                              </span>
                              <span className="truncate text-xs text-gray-500">{s.name}</span>
                            </button>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </Field>

              <Field label="Period">
                <select
                  value={period}
                  onChange={(e) => setPeriod(e.target.value)}
                  className={inputClass}
                >
                  {PERIODS.map((p) => (
                    <option key={p.label} value={p.label}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </Field>

              {strategy === 'dip' && (
                <>
                  <Field label="Buy when it falls at least" hint="Percent drop in a single day">
                    <input
                      type="number"
                      min="0.5"
                      step="0.5"
                      value={dipPct}
                      onChange={(e) => setDipPct(cleanNumber(e.target.value))}
                      className={inputClass}
                    />
                  </Field>
                  <Field label="Shares to buy each time" hint="Fixed quantity per dip">
                    <input
                      type="number"
                      min="1"
                      value={qty}
                      onChange={(e) => setQty(cleanNumber(e.target.value))}
                      className={inputClass}
                    />
                  </Field>
                </>
              )}

              {strategy === 'ma' && (
                <>
                  <Field label="Fast moving average" hint="Days">
                    <input
                      type="number"
                      min="2"
                      value={fast}
                      onChange={(e) => setFast(cleanNumber(e.target.value))}
                      className={inputClass}
                    />
                  </Field>
                  <Field label="Slow moving average" hint="Days">
                    <input
                      type="number"
                      min="3"
                      value={slow}
                      onChange={(e) => setSlow(cleanNumber(e.target.value))}
                      className={inputClass}
                    />
                  </Field>
                  <Field label="Starting capital">
                    <input
                      type="number"
                      min="1000"
                      step="1000"
                      value={capital}
                      onChange={(e) => setCapital(cleanNumber(e.target.value))}
                      className={inputClass}
                    />
                  </Field>
                </>
              )}

              {strategy === 'rsi' && (
                <>
                  <Field label="RSI period" hint="Days">
                    <input
                      type="number"
                      min="2"
                      value={rsiPeriod}
                      onChange={(e) => setRsiPeriod(cleanNumber(e.target.value))}
                      className={inputClass}
                    />
                  </Field>
                  <Field label="Oversold level" hint="Buy above this">
                    <input
                      type="number"
                      min="5"
                      max="50"
                      value={oversold}
                      onChange={(e) => setOversold(cleanNumber(e.target.value))}
                      className={inputClass}
                    />
                  </Field>
                  <Field label="Overbought level" hint="Sell below this">
                    <input
                      type="number"
                      min="50"
                      max="95"
                      value={overbought}
                      onChange={(e) => setOverbought(cleanNumber(e.target.value))}
                      className={inputClass}
                    />
                  </Field>
                  <Field label="Starting capital">
                    <input
                      type="number"
                      min="1000"
                      step="1000"
                      value={capital}
                      onChange={(e) => setCapital(cleanNumber(e.target.value))}
                      className={inputClass}
                    />
                  </Field>
                </>
              )}
            </div>

            <button
              onClick={runBacktest}
              className="mt-5 flex items-center gap-2 rounded-xl bg-gray-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-black"
            >
              <Play className="h-4 w-4" />
              Run Backtest
            </button>
          </Section>

          {loading && (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-gray-200 bg-white py-24">
              <Loader2 className="h-7 w-7 animate-spin text-blue-600" />
              <p className="mt-3 text-sm text-gray-500">Loading real price history…</p>
            </div>
          )}

          {!loading && error && (
            <div className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50/50 p-6">
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-500" />
              <div>
                <p className="font-semibold text-gray-900">Could not run the backtest</p>
                <p className="mt-1 text-sm text-gray-600">{error}</p>
              </div>
            </div>
          )}

          {!loading && result && (
            <>
          {/* Verdict */}
          <div
            className={`flex flex-wrap items-center justify-between gap-4 rounded-2xl border p-6 ${
              beatsMarket
                ? 'border-emerald-200 bg-emerald-50/50'
                : 'border-amber-200 bg-amber-50/50'
            }`}
          >
            <div className="flex items-start gap-3">
              <span
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                  beatsMarket ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                }`}
              >
                <Trophy className="h-5 w-5" />
              </span>
              <div>
                <p className="font-bold text-gray-900">
                  {beatsMarket
                    ? `${activeStrategy.name} beat simply holding the stock`
                    : `Simply holding ${symbol} did better`}
                </p>
                <p className="mt-0.5 text-sm text-gray-600">
                  Strategy returned {m.totalReturnPct}% while buy and hold returned{' '}
                  {m.benchmarkReturnPct}% over {period.toLowerCase()}.
                </p>
              </div>
            </div>
            <span
              className={`flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-bold ${
                beatsMarket ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
              }`}
            >
              {beatsMarket ? (
                <ArrowUpRight className="h-4 w-4" />
              ) : (
                <ArrowDownRight className="h-4 w-4" />
              )}
              {(m.totalReturnPct - m.benchmarkReturnPct).toFixed(2)}% difference
            </span>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
            {stats.map((s) => (
              <div key={s.label} className="rounded-2xl border border-gray-200 bg-white p-5">
                <p className="text-xs text-gray-500">{s.label}</p>
                <p className={`mt-1.5 text-xl font-bold ${s.tone}`}>{s.value}</p>
                <p className="mt-0.5 text-xs text-gray-400">{s.note}</p>
              </div>
            ))}
          </div>

          {/* Return curve */}
          <Section
            icon={Activity}
            title="Return Over Time"
            subtitle="Percentage return, so adding money over time does not distort the picture"
            right={
              <div className="flex items-center gap-4 text-xs text-gray-500">
                <span className="flex items-center gap-1.5">
                  <span className="h-0.5 w-5 rounded bg-blue-600" />
                  Strategy
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-0.5 w-5 rounded border-t-2 border-dashed border-gray-400" />
                  Buy &amp; Hold
                </span>
              </div>
            }
          >
            <div className="h-72">
              <Line data={returnChart} options={returnOptions} />
            </div>
            <p className="mt-3 text-xs text-gray-400">
              The blue line is profit as a percentage of what you had put in by that day. The
              dashed line is what the stock itself did over the same period.
            </p>
          </Section>

          {/* Price with trades */}
          <Section
            icon={TrendingUp}
            title="Where the Trades Happened"
            subtitle="Green dots are buys, red dots are sells"
          >
            <div className="h-72">
              <Line data={priceChart} options={priceOptions} />
            </div>
          </Section>

          {/* Trade log */}
          <Section
            icon={ListOrdered}
            title="Trade History"
            subtitle={`${result.trades.length} trades — latest first`}
          >
            {result.trades.length === 0 ? (
              <p className="rounded-xl bg-gray-50 p-5 text-sm text-gray-500">
                This rule never triggered over the chosen period. Try loosening the settings.
              </p>
            ) : (
              <div className="max-h-96 overflow-auto">
                <table className="w-full min-w-[620px] text-left">
                  <thead className="sticky top-0 bg-white">
                    <tr className="border-b border-gray-200">
                      {['Date', 'Action', 'Price', 'Qty', 'Amount', 'Note'].map((h) => (
                        <th
                          key={h}
                          className="pb-3 text-xs font-semibold tracking-wider text-gray-500 uppercase"
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {[...result.trades].reverse().map((t, i) => (
                      <tr
                        key={`${t.date}-${i}`}
                        className="border-b border-gray-100 last:border-0"
                      >
                        <td className="py-3 text-sm text-gray-700">{t.date}</td>
                        <td className="py-3">
                          <span
                            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold ${
                              t.action === 'BUY'
                                ? 'bg-emerald-100 text-emerald-700'
                                : 'bg-red-100 text-red-700'
                            }`}
                          >
                            {t.action === 'BUY' ? (
                              <TrendingUp className="h-3 w-3" />
                            ) : (
                              <TrendingDown className="h-3 w-3" />
                            )}
                            {t.action}
                          </span>
                        </td>
                        <td className="py-3 text-sm text-gray-700">{inr(t.price, 2)}</td>
                        <td className="py-3 text-sm text-gray-700">{t.qty}</td>
                        <td className="py-3 text-sm text-gray-700">{inr(t.amount)}</td>
                        <td className="py-3 text-xs text-gray-500">{t.note}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Section>

          {/* Disclaimer */}
          <div className="flex items-start gap-2.5 rounded-2xl border border-gray-200 bg-white p-5 text-sm text-gray-500">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" />
            <p>
              Run on {result.prices.length} real trading days of {symbol} closing prices, from{' '}
              {result.dates[0]} to {result.dates.at(-1)}. Backtests ignore brokerage, taxes and
              slippage, and a rule that worked in the past may not work again. For learning, not
              investment advice.
            </p>
          </div>
            </>
          )}
        </main>
      </div>
    </div>
  )
}
