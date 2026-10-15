import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  CategoryScale,
  Chart as ChartJS,
  Filler,
  LinearScale,
  LineElement,
  PointElement,
  Tooltip,
} from 'chart.js'
import { Line } from 'react-chartjs-2'
import {
  AlertCircle,
  ArrowRight,
  Briefcase,
  Loader2,
  Plus,
  TrendingDown,
  TrendingUp,
  Wallet,
} from 'lucide-react'
import Sidebar from '../components/dashboard/Sidebar'
import {
  fetchMarketCloses,
  fetchMarketQuotes,
  fetchPaperAccount,
  fetchWatchlists,
} from '../lib/api'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Filler, Tooltip)

const QUOTE_REFRESH_MS = 30000

const TIME_RANGES = [
  { label: '1 Month', code: '1MO' },
  { label: '6 Month', code: '6MO' },
  { label: '1 Year', code: '1Y' },
  { label: '2 Year', code: '2Y' },
]

function inr(value, digits = 2) {
  if (value === null || value === undefined) return '—'
  return `₹${Number(value).toLocaleString('en-IN', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })}`
}

function signed(value, digits = 2) {
  return `${value >= 0 ? '+' : '−'}${inr(Math.abs(value), digits)}`
}

function pct(value) {
  return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`
}

function shortLabel(isoDate) {
  const [year, month, day] = isoDate.split('-')
  return new Date(Number(year), Number(month) - 1, Number(day)).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
  })
}

function Sparkline({ values, positive }) {
  if (!values || values.length < 2) return <span className="inline-block h-6 w-16" />

  const min = Math.min(...values)
  const max = Math.max(...values)
  const span = max - min || 1
  const points = values
    .map((v, i) => `${(i / (values.length - 1)) * 60},${18 - ((v - min) / span) * 16}`)
    .join(' ')

  return (
    <svg viewBox="0 0 60 20" className="h-6 w-16" preserveAspectRatio="none">
      <polyline
        points={points}
        fill="none"
        stroke={positive ? '#10b981' : '#ef4444'}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  )
}

export default function DashboardPage() {
  const [account, setAccount] = useState(null)
  const [watchlist, setWatchlist] = useState(null)
  const [quotes, setQuotes] = useState({})
  const [spark, setSpark] = useState(null)

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const [selected, setSelected] = useState(null)
  const [range, setRange] = useState('1 Month')
  const [chart, setChart] = useState(null)
  const [chartLoading, setChartLoading] = useState(false)

  useEffect(() => {
    let cancelled = false

    Promise.all([fetchPaperAccount(), fetchWatchlists()])
      .then(([accountData, watchData]) => {
        if (cancelled) return
        setAccount(accountData.account)
        setWatchlist(watchData.lists[0] || null)
      })
      .catch((err) => {
        if (!cancelled) setError(err?.errors?.form || 'Could not load your dashboard.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [])

  // Prices for everything on the page: the holdings and the watchlist card.
  const symbols = useMemo(() => {
    const held = account?.holdings.map((h) => h.symbol) || []
    const watched = watchlist?.stocks || []
    return [...new Set([...held, ...watched])]
  }, [account, watchlist])

  const symbolKey = symbols.join(',')

  const refreshQuotes = useCallback(() => {
    if (!symbolKey) return
    fetchMarketQuotes(symbolKey.split(','))
      .then((data) => {
        setQuotes((prev) => {
          const next = { ...prev }
          for (const q of data.quotes || []) next[q.symbol] = q
          return next
        })
      })
      .catch(() => {
        /* a missed refresh leaves the last price on screen */
      })
  }, [symbolKey])

  useEffect(() => {
    refreshQuotes()
    const timer = setInterval(refreshQuotes, QUOTE_REFRESH_MS)
    return () => clearInterval(timer)
  }, [refreshQuotes])

  // One month of closes drives every small sparkline on the page.
  useEffect(() => {
    if (!symbolKey) {
      setSpark(null)
      return
    }

    let cancelled = false
    fetchMarketCloses(symbolKey.split(','), '1MO')
      .then((data) => {
        if (!cancelled) setSpark(data)
      })
      .catch(() => {
        if (!cancelled) setSpark(null)
      })

    return () => {
      cancelled = true
    }
  }, [symbolKey])

  // The big chart follows whichever stock is selected, defaulting to the first
  // holding, or the first watched stock when nothing is held yet.
  const chartSymbol = selected || account?.holdings[0]?.symbol || watchlist?.stocks[0] || null

  useEffect(() => {
    if (!chartSymbol) {
      setChart(null)
      return
    }

    let cancelled = false
    const code = TIME_RANGES.find((r) => r.label === range).code
    setChartLoading(true)

    fetchMarketCloses([chartSymbol], code)
      .then((data) => {
        if (!cancelled) setChart(data)
      })
      .catch(() => {
        if (!cancelled) setChart(null)
      })
      .finally(() => {
        if (!cancelled) setChartLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [chartSymbol, range])

  const sparkFor = (symbol) => (spark?.closes?.[symbol] || []).filter((v) => v !== null)

  const positions = (account?.holdings || []).map((h) => {
    const quote = quotes[h.symbol]
    const ltp = quote?.price ?? h.avgPrice
    const invested = h.qty * h.avgPrice
    const value = h.qty * ltp

    return {
      ...h,
      ltp,
      priced: Boolean(quote),
      invested,
      value,
      pnl: value - invested,
      pnlPct: invested === 0 ? 0 : ((value - invested) / invested) * 100,
    }
  })

  const cash = account?.cash ?? 0
  const startingCapital = account?.startingCapital ?? 1000000
  const invested = positions.reduce((sum, p) => sum + p.invested, 0)
  const currentValue = positions.reduce((sum, p) => sum + p.value, 0)
  const portfolio = cash + currentValue
  const totalPnl = portfolio - startingCapital
  const totalPnlPct = (totalPnl / startingCapital) * 100

  const stats = [
    {
      icon: totalPnl >= 0 ? TrendingUp : TrendingDown,
      label: 'Total Portfolio Value',
      value: inr(portfolio),
      sub: `${signed(totalPnl)} (${pct(totalPnlPct)}) overall`,
      subClass: totalPnl >= 0 ? 'text-emerald-600' : 'text-red-500',
    },
    {
      icon: Briefcase,
      label: 'Invested Amount',
      value: inr(invested),
      sub:
        positions.length === 0
          ? 'Nothing invested yet'
          : `Across ${positions.length} NSE ${positions.length === 1 ? 'equity' : 'equities'}`,
      subClass: 'text-gray-500',
    },
    {
      icon: Wallet,
      label: 'Available Cash (Virtual Wallet)',
      value: inr(cash),
      sub: 'Ready for Paper Trading →',
      subClass: 'text-blue-600',
      to: '/paper-trading',
    },
  ]

  const chartQuote = chartSymbol ? quotes[chartSymbol] : null
  const chartValues = (chart?.closes?.[chartSymbol] || []).filter((v) => v !== null)
  const chartUp =
    chartValues.length > 1 ? chartValues[chartValues.length - 1] >= chartValues[0] : true

  const chartData = chart && {
    labels: (chart.dates || []).map(shortLabel),
    datasets: [
      {
        data: chart.closes?.[chartSymbol] || [],
        borderColor: chartUp ? '#10b981' : '#ef4444',
        backgroundColor: (ctx) => {
          const { chart: instance } = ctx
          const { ctx: canvasCtx, chartArea } = instance
          if (!chartArea) return 'transparent'
          const gradient = canvasCtx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom)
          gradient.addColorStop(0, chartUp ? 'rgba(16,185,129,0.25)' : 'rgba(239,68,68,0.25)')
          gradient.addColorStop(1, 'rgba(255,255,255,0)')
          return gradient
        },
        borderWidth: 2,
        pointRadius: 0,
        pointHoverRadius: 5,
        pointHoverBackgroundColor: chartUp ? '#10b981' : '#ef4444',
        pointHoverBorderColor: '#fff',
        pointHoverBorderWidth: 2,
        tension: 0.3,
        fill: true,
      },
    ],
  }

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    scales: {
      x: {
        grid: { display: false },
        ticks: { color: '#9ca3af', font: { size: 10 }, maxTicksLimit: 8 },
      },
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
        padding: 10,
        cornerRadius: 10,
        displayColors: false,
        callbacks: { label: (ctx) => `₹${ctx.parsed.y.toLocaleString('en-IN')}` },
      },
    },
  }

  if (loading) {
    return (
      <div className="flex min-h-screen bg-[#f8f9fb]">
        <Sidebar />
        <div className="flex flex-1 flex-col items-center justify-center">
          <Loader2 className="h-7 w-7 animate-spin text-blue-600" />
          <p className="mt-3 text-sm text-gray-500">Loading your dashboard…</p>
        </div>
      </div>
    )
  }

  if (error || !account) {
    return (
      <div className="flex min-h-screen bg-[#f8f9fb]">
        <Sidebar />
        <main className="flex-1 p-8">
          <div className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50/50 p-6">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-500" />
            <div>
              <p className="font-semibold text-gray-900">Could not load the dashboard</p>
              <p className="mt-1 text-sm text-gray-600">{error}</p>
            </div>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen bg-[#f8f9fb]">
      <Sidebar />

      <div className="flex min-w-0 flex-1 flex-col">
        <main className="flex-1 p-8">
          {/* Stat cards */}
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
            {stats.map(({ icon: Icon, label, value, sub, subClass, to }) => {
              const body = (
                <>
                  <div className="flex items-start justify-between">
                    <p className="text-sm text-gray-500">{label}</p>
                    <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                      <Icon className="h-4 w-4" />
                    </span>
                  </div>
                  <p className="mt-3 text-2xl font-bold text-gray-900">{value}</p>
                  <p className={`mt-1 text-sm font-medium ${subClass}`}>{sub}</p>
                </>
              )

              return to ? (
                <Link
                  key={label}
                  to={to}
                  className="rounded-2xl border border-gray-200 bg-white p-6 transition hover:border-gray-300 hover:shadow-md"
                >
                  {body}
                </Link>
              ) : (
                <div key={label} className="rounded-2xl border border-gray-200 bg-white p-6">
                  {body}
                </div>
              )
            })}
          </div>

          {/* Portfolio */}
          <div className="mt-8 mb-4 flex items-center justify-between">
            <h2 className="text-lg font-bold text-gray-900">My Portfolio</h2>
            {positions.length > 0 && (
              <Link
                to="/paper-trading"
                className="flex items-center gap-1 text-sm font-semibold text-blue-600 hover:text-blue-700"
              >
                Manage
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            )}
          </div>

          {positions.length === 0 ? (
            <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center">
              <p className="text-sm font-medium text-gray-700">No holdings yet</p>
              <p className="mt-1 text-sm text-gray-500">
                Your wallet is sitting in cash at {inr(cash, 0)}. Buy your first stock to see it
                here.
              </p>
              <Link
                to="/paper-trading"
                className="mt-4 inline-flex items-center gap-2 rounded-xl bg-gray-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-black"
              >
                Open Paper Trading
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {positions.map((p) => {
                const isChart = p.symbol === chartSymbol
                return (
                  <button
                    key={p.symbol}
                    onClick={() => setSelected(p.symbol)}
                    className={`rounded-2xl border bg-white p-5 text-left transition hover:border-gray-300 hover:shadow-md ${
                      isChart ? 'border-blue-500 ring-1 ring-blue-500' : 'border-gray-200'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex min-w-0 items-center gap-2.5">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-50 text-sm font-bold text-blue-700">
                          {p.symbol.slice(0, 2)}
                        </span>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-gray-900">
                            {p.symbol}
                          </p>
                          <p className="truncate text-xs text-gray-500">{p.name}</p>
                        </div>
                      </div>
                      <Sparkline values={sparkFor(p.symbol)} positive={p.pnl >= 0} />
                    </div>
                    <div className="mt-4 flex items-center justify-between">
                      <div>
                        <p className="text-xs text-gray-500">Total Shares</p>
                        <p className="text-sm font-semibold text-gray-900">{p.qty}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-gray-500">Total Return</p>
                        <p
                          className={`text-sm font-semibold ${
                            !p.priced
                              ? 'text-gray-400'
                              : p.pnl >= 0
                                ? 'text-emerald-600'
                                : 'text-red-500'
                          }`}
                        >
                          {p.priced ? pct(p.pnlPct) : '—'}
                        </p>
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          )}

          {/* Chart + watchlist */}
          <div className="mt-8 grid grid-cols-1 gap-5 lg:grid-cols-[2fr_1fr]">
            <div className="rounded-2xl border border-gray-200 bg-white p-6">
              {!chartSymbol ? (
                <div className="flex h-full flex-col items-center justify-center py-16 text-center">
                  <p className="text-sm font-medium text-gray-700">Nothing to chart yet</p>
                  <p className="mt-1 text-sm text-gray-500">
                    Add a stock to your watchlist or buy one, and its price history shows up here.
                  </p>
                </div>
              ) : (
                <>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-blue-50 text-sm font-bold text-blue-700">
                        {chartSymbol.slice(0, 2)}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-base font-bold text-gray-900">
                          {chartQuote?.name || chartSymbol}
                        </p>
                        <p className="text-xs text-gray-500">{chartSymbol}</p>
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-xl font-bold text-gray-900">
                        {chartQuote ? inr(chartQuote.price) : '—'}
                      </p>
                      {chartQuote && (
                        <p
                          className={`flex items-center justify-end gap-1 text-sm font-medium ${
                            chartQuote.changePct >= 0 ? 'text-emerald-600' : 'text-red-500'
                          }`}
                        >
                          {chartQuote.changePct >= 0 ? (
                            <TrendingUp className="h-3.5 w-3.5" />
                          ) : (
                            <TrendingDown className="h-3.5 w-3.5" />
                          )}
                          {pct(chartQuote.changePct)}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="mt-5 flex flex-wrap gap-2">
                    {TIME_RANGES.map(({ label }) => (
                      <button
                        key={label}
                        onClick={() => setRange(label)}
                        className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                          range === label
                            ? 'bg-gray-900 text-white'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>

                  <div className="mt-6 h-64">
                    {chartLoading && !chartData ? (
                      <div className="flex h-full items-center justify-center">
                        <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
                      </div>
                    ) : chartData ? (
                      <Line data={chartData} options={chartOptions} />
                    ) : (
                      <div className="flex h-full items-center justify-center">
                        <p className="text-sm text-gray-500">
                          Price history is unavailable right now.
                        </p>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>

            <div className="rounded-2xl border border-gray-200 bg-white p-6">
              <div className="flex items-center justify-between">
                <h3 className="truncate text-base font-bold text-gray-900">
                  {watchlist?.name || 'My watchlist'}
                </h3>
                <Link
                  to="/watchlist"
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gray-100 text-gray-500 transition hover:bg-gray-200"
                  aria-label="Open watchlist"
                >
                  <Plus className="h-4 w-4" />
                </Link>
              </div>

              <div className="mt-4 space-y-1">
                {!watchlist || watchlist.stocks.length === 0 ? (
                  <p className="rounded-xl bg-gray-50 p-4 text-sm text-gray-500">
                    Nothing on your watchlist yet.
                  </p>
                ) : (
                  watchlist.stocks.map((symbol) => {
                    const quote = quotes[symbol]
                    const up = (quote?.changePct ?? 0) >= 0
                    return (
                      <Link
                        key={symbol}
                        to={`/paper-trading?symbol=${symbol}`}
                        className="flex items-center justify-between gap-2 rounded-xl px-2 py-2.5 transition hover:bg-gray-50"
                      >
                        <div className="flex min-w-0 items-center gap-2.5">
                          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gray-100 text-xs font-bold text-gray-600">
                            {symbol.slice(0, 2)}
                          </span>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-gray-900">{symbol}</p>
                            <p className="truncate text-xs text-gray-500">
                              {quote?.name || 'Loading…'}
                            </p>
                          </div>
                        </div>
                        <div className="shrink-0 text-right">
                          <p className="text-sm font-semibold text-gray-900">
                            {quote ? inr(quote.price) : '—'}
                          </p>
                          <p
                            className={`text-xs font-medium ${
                              !quote ? 'text-gray-400' : up ? 'text-emerald-600' : 'text-red-500'
                            }`}
                          >
                            {quote ? pct(quote.changePct) : '—'}
                          </p>
                        </div>
                      </Link>
                    )
                  })
                )}
              </div>

              {watchlist && watchlist.stocks.length > 0 && (
                <Link
                  to="/watchlist"
                  className="mt-4 flex items-center justify-center gap-1 rounded-xl border border-gray-200 py-2.5 text-sm font-semibold text-gray-600 transition hover:border-gray-300 hover:bg-gray-50"
                >
                  Open watchlist
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
