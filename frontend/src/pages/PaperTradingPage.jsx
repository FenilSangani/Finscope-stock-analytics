import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  ArcElement,
  CategoryScale,
  Chart as ChartJS,
  Filler,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  Tooltip,
} from 'chart.js'
import { Doughnut, Line } from 'react-chartjs-2'
import {
  Activity,
  AlertCircle,
  Briefcase,
  CheckCircle2,
  Clock,
  Eye,
  EyeOff,
  Info,
  ListOrdered,
  Loader2,
  PieChart,
  RotateCcw,
  Search,
  TrendingDown,
  TrendingUp,
  Wallet,
} from 'lucide-react'
import Sidebar from '../components/dashboard/Sidebar'
import {
  fetchMarketCloses,
  fetchMarketQuotes,
  fetchMarketStatus,
  fetchPaperAccount,
  placePaperOrder,
  resetPaperAccount,
  searchSymbols,
} from '../lib/api'
import { buildValueCurve, dayPnlFor, shortLabel } from '../lib/portfolio'

ChartJS.register(
  ArcElement,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Filler,
  Legend,
  Tooltip,
)

const QUOTE_REFRESH_MS = 30000

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

function round2(value) {
  return Math.round(value * 100) / 100
}

/** Digits only, with no leading zeros. */
function cleanNumber(value) {
  return value.replace(/\D/g, '').replace(/^0+(?=\d)/, '')
}

function stamp(date) {
  return new Date(date).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}

const STATUS_BADGES = {
  EXECUTED: { label: 'Executed', className: 'bg-emerald-50 text-emerald-700' },
  PENDING: { label: 'Waiting for open', className: 'bg-amber-50 text-amber-700' },
  REJECTED: { label: 'Rejected', className: 'bg-red-50 text-red-600' },
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

const inputClass =
  'w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 focus:outline-none'

export default function PaperTradingPage() {
  const [account, setAccount] = useState(null)
  const [quotes, setQuotes] = useState({})
  const [closes, setCloses] = useState(null)

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [flash, setFlash] = useState(null)
  const [busy, setBusy] = useState(false)

  // The watchlist module links straight into the ticket with ?symbol=XYZ.
  const [params] = useSearchParams()
  const linked = (params.get('symbol') || '').toUpperCase().replace(/[^A-Z0-9&-]/g, '')

  const [side, setSide] = useState('BUY')
  const [ticketSymbol, setTicketSymbol] = useState(linked || 'RELIANCE')
  const [ticketName, setTicketName] = useState(linked || 'Reliance Industries Limited')
  const [qty, setQty] = useState('1')

  const [showValues, setShowValues] = useState(true)
  const [confirmReset, setConfirmReset] = useState(false)
  const [market, setMarket] = useState(null)

  // Stock picker, backed by the full NSE list.
  const [showPicker, setShowPicker] = useState(false)
  const [pickerQuery, setPickerQuery] = useState('')
  const [pickerResults, setPickerResults] = useState([])

  const isOpen = market?.open ?? false

  // Whether the exchange is really trading comes from the server, which checks
  // the latest session date as well as the clock, so a holiday reads correctly.
  useEffect(() => {
    let cancelled = false
    const load = () =>
      fetchMarketStatus()
        .then((data) => {
          if (!cancelled) setMarket(data)
        })
        .catch(() => {
          /* keep the last known state */
        })

    load()
    const timer = setInterval(load, 60000)
    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [])

  // Load the wallet once; every later change comes back from the server.
  useEffect(() => {
    let cancelled = false
    fetchPaperAccount()
      .then((data) => {
        if (!cancelled) setAccount(data.account)
      })
      .catch((err) => {
        if (!cancelled) setError(err?.errors?.form || 'Could not load your paper wallet.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [])

  // Everything on screen that needs a price.
  const quoteSymbols = useMemo(() => {
    if (!account) return []
    return [
      ...new Set([...account.holdings.map((h) => h.symbol), ticketSymbol]),
    ].filter(Boolean)
  }, [account, ticketSymbol])

  const quoteKey = quoteSymbols.join(',')

  const refreshQuotes = useCallback(() => {
    if (!quoteKey) return
    fetchMarketQuotes(quoteKey.split(','))
      .then((data) => {
        setQuotes((prev) => {
          const next = { ...prev }
          for (const q of data.quotes || []) next[q.symbol] = q
          return next
        })
      })
      .catch(() => {
        /* a missed refresh just leaves the last price on screen */
      })
  }, [quoteKey])

  useEffect(() => {
    refreshQuotes()
    const timer = setInterval(refreshQuotes, QUOTE_REFRESH_MS)
    return () => clearInterval(timer)
  }, [refreshQuotes])

  // Daily closes for every stock the wallet has ever touched, for the value line.
  const closesKey = useMemo(() => {
    if (!account) return ''
    return [
      ...new Set([
        ...account.holdings.map((h) => h.symbol),
        ...account.orders.map((o) => o.symbol),
      ]),
    ]
      .sort()
      .join(',')
  }, [account])

  useEffect(() => {
    if (!closesKey) {
      setCloses(null)
      return
    }

    let cancelled = false
    fetchMarketCloses(closesKey.split(','), '1Y')
      .then((data) => {
        if (!cancelled) setCloses(data)
      })
      .catch(() => {
        if (!cancelled) setCloses(null)
      })

    return () => {
      cancelled = true
    }
  }, [closesKey])

  useEffect(() => {
    if (!flash) return
    const timer = setTimeout(() => setFlash(null), 4000)
    return () => clearTimeout(timer)
  }, [flash])

  useEffect(() => {
    if (!confirmReset) return
    const timer = setTimeout(() => setConfirmReset(false), 5000)
    return () => clearTimeout(timer)
  }, [confirmReset])

  useEffect(() => {
    if (!showPicker) return
    let cancelled = false
    const timer = setTimeout(() => {
      searchSymbols(pickerQuery)
        .then((data) => {
          if (!cancelled) setPickerResults(data.results || [])
        })
        .catch(() => {
          if (!cancelled) setPickerResults([])
        })
    }, 250)

    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [pickerQuery, showPicker])

  const priceOf = (symbol) => quotes[symbol]?.price ?? null

  const positions = (account?.holdings || []).map((h) => {
    const quote = quotes[h.symbol]
    // Until the first quote arrives the position is shown at its own cost, so
    // the page never invents a profit it cannot back up.
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
      dayPnl: dayPnlFor(h, account?.orders || [], quote),
    }
  })

  const pendingCount = (account?.orders || []).filter((o) => o.status === 'PENDING').length

  const cash = account?.cash ?? 0
  const realised = account?.realised ?? 0
  const startingCapital = account?.startingCapital ?? 1000000
  const invested = positions.reduce((sum, p) => sum + p.invested, 0)
  const currentValue = positions.reduce((sum, p) => sum + p.value, 0)
  const unrealised = currentValue - invested
  const dayPnl = positions.reduce((sum, p) => sum + p.dayPnl, 0)
  const portfolio = cash + currentValue
  const totalPnl = portfolio - startingCapital
  const totalPnlPct = (totalPnl / startingCapital) * 100

  // Order ticket
  const ticketLtp = priceOf(ticketSymbol)
  const heldQty = account?.holdings.find((h) => h.symbol === ticketSymbol)?.qty ?? 0
  const maxQty = side === 'BUY' ? (ticketLtp ? Math.floor(cash / ticketLtp) : 0) : heldQty
  const orderQty = Number(qty) || 0
  const orderValue = ticketLtp ? round2(orderQty * ticketLtp) : 0

  let ticketError = null
  if (!ticketLtp) ticketError = 'Waiting for a live price for this stock.'
  else if (orderQty <= 0) ticketError = 'Enter how many shares you want.'
  else if (side === 'BUY' && orderValue > cash) ticketError = 'Not enough cash in the wallet.'
  else if (side === 'SELL' && orderQty > heldQty)
    ticketError = heldQty === 0 ? 'You do not hold this stock.' : `You only hold ${heldQty} shares.`

  async function placeOrder() {
    if (ticketError || busy) return
    setBusy(true)

    try {
      const data = await placePaperOrder({ symbol: ticketSymbol, action: side, qty: orderQty })
      setAccount(data.account)
      setQty('1')

      if (data.queued) {
        const q = data.queued
        setFlash({
          tone: 'queued',
          text: `${q.action === 'BUY' ? 'Buy' : 'Sell'} ${q.qty} ${q.symbol} queued — it will fill when the market opens ${q.opensAt}, at whatever the price is then.`,
        })
        return
      }

      const { fill } = data
      setFlash({
        tone: 'ok',
        text:
          fill.action === 'BUY'
            ? `Bought ${fill.qty} ${fill.symbol} at ${inr(fill.price)}`
            : `Sold ${fill.qty} ${fill.symbol} at ${inr(fill.price)} — ${
                fill.realised >= 0 ? 'booked' : 'lost'
              } ${inr(Math.abs(fill.realised))}`,
      })
    } catch (err) {
      setFlash({ tone: 'error', text: err?.errors?.form || 'Could not place that order.' })
    } finally {
      setBusy(false)
    }
  }

  async function resetWallet() {
    if (!confirmReset) {
      setConfirmReset(true)
      return
    }

    setConfirmReset(false)
    setBusy(true)
    try {
      const data = await resetPaperAccount()
      setAccount(data.account)
      setSide('BUY')
      setQty('1')
      setFlash({ tone: 'ok', text: `Wallet reset to ${inr(startingCapital, 0)} in cash` })
    } catch (err) {
      setFlash({ tone: 'error', text: err?.errors?.form || 'Could not reset the wallet.' })
    } finally {
      setBusy(false)
    }
  }

  function openTicket(symbol, name, nextSide) {
    setTicketSymbol(symbol)
    setTicketName(name || symbol)
    setSide(nextSide)
    setQty('1')
  }

  const curve = useMemo(() => {
    if (!account || !closes?.dates?.length || account.orders.length === 0) return null
    return buildValueCurve({
      dates: closes.dates,
      closes: closes.closes,
      orders: account.orders,
      cash,
      holdings: account.holdings,
      liveValue: positions.every((p) => p.priced) ? portfolio : undefined,
    })
    // positions is rebuilt on every render, so the live value is taken from the
    // numbers it produced rather than from the array itself.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [account, closes, cash, portfolio])

  const equityChart = curve && {
    labels: curve.dates.map(shortLabel),
    datasets: [
      {
        label: 'Portfolio',
        data: curve.values,
        borderColor: totalPnl >= 0 ? '#10b981' : '#ef4444',
        backgroundColor: (ctx) => {
          const { chart } = ctx
          const { ctx: c, chartArea } = chart
          if (!chartArea) return 'transparent'
          const g = c.createLinearGradient(0, chartArea.top, 0, chartArea.bottom)
          g.addColorStop(0, totalPnl >= 0 ? 'rgba(16,185,129,0.20)' : 'rgba(239,68,68,0.20)')
          g.addColorStop(1, 'rgba(255,255,255,0)')
          return g
        },
        borderWidth: 2,
        pointRadius: 0,
        pointHoverRadius: 4,
        tension: 0.3,
        fill: true,
      },
    ],
  }

  const equityOptions = {
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
          callback: (v) => `₹${(v / 100000).toFixed(2)}L`,
        },
      },
    },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: '#111827',
        padding: 12,
        cornerRadius: 10,
        callbacks: { label: (ctx) => `Portfolio: ₹${ctx.parsed.y.toLocaleString('en-IN')}` },
      },
    },
  }

  const SLICE_COLORS = ['#2563eb', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444', '#06b6d4']

  const allocationChart = {
    labels: [...positions.map((p) => p.symbol), 'Cash'],
    datasets: [
      {
        data: [...positions.map((p) => round2(p.value)), round2(cash)],
        backgroundColor: [
          ...positions.map((_, i) => SLICE_COLORS[i % SLICE_COLORS.length]),
          '#e5e7eb',
        ],
        borderColor: '#fff',
        borderWidth: 2,
        hoverOffset: 6,
      },
    ],
  }

  const allocationOptions = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: '62%',
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: '#111827',
        padding: 10,
        cornerRadius: 10,
        callbacks: {
          label: (ctx) =>
            `${ctx.label}: ₹${ctx.parsed.toLocaleString('en-IN')} (${(
              (ctx.parsed / portfolio) *
              100
            ).toFixed(1)}%)`,
        },
      },
    },
  }

  const stats = [
    {
      label: 'Available Cash',
      value: inr(cash),
      note: 'Ready to invest',
      tone: 'text-gray-900',
      icon: Wallet,
    },
    {
      label: 'Invested',
      value: inr(invested),
      note: `${positions.length} open ${positions.length === 1 ? 'position' : 'positions'}`,
      tone: 'text-gray-900',
      icon: Briefcase,
    },
    {
      label: 'Current Value',
      value: inr(currentValue),
      note: `Unrealised ${signed(unrealised)}`,
      tone: unrealised >= 0 ? 'text-emerald-600' : 'text-red-500',
      icon: Activity,
    },
    {
      label: "Today's P&L",
      value: signed(dayPnl),
      note: 'Change since yesterday close',
      tone: dayPnl >= 0 ? 'text-emerald-600' : 'text-red-500',
      icon: dayPnl >= 0 ? TrendingUp : TrendingDown,
    },
  ]

  if (loading) {
    return (
      <div className="flex min-h-screen bg-[#f8f9fb]">
        <Sidebar />
        <div className="flex flex-1 flex-col items-center justify-center">
          <Loader2 className="h-7 w-7 animate-spin text-blue-600" />
          <p className="mt-3 text-sm text-gray-500">Loading your paper wallet…</p>
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
              <p className="font-semibold text-gray-900">Could not open the wallet</p>
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
        <main className="flex-1 space-y-5 p-8">
          {/* Heading */}
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Paper Trading</h1>
              <p className="mt-1 text-sm text-gray-500">
                Practise buying and selling real NSE stocks with virtual money.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold ${
                  isOpen ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-600'
                }`}
                title={
                  isOpen
                    ? 'NSE is trading'
                    : market?.opensAt
                      ? `Opens ${market.opensAt}`
                      : 'NSE is closed'
                }
              >
                <span
                  className={`h-1.5 w-1.5 rounded-full ${
                    isOpen ? 'animate-pulse bg-emerald-500' : 'bg-gray-400'
                  }`}
                />
                {isOpen
                  ? 'Market open'
                  : market?.holiday
                    ? 'Market holiday'
                    : 'Market closed'}
              </span>
              <button
                onClick={resetWallet}
                disabled={busy}
                className={`inline-flex items-center gap-1.5 rounded-xl border px-3.5 py-2 text-xs font-semibold transition disabled:opacity-50 ${
                  confirmReset
                    ? 'border-red-200 bg-red-50 text-red-600 hover:bg-red-100'
                    : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:bg-gray-50'
                }`}
              >
                <RotateCcw className="h-3.5 w-3.5" />
                {confirmReset ? 'Tap again to wipe all trades' : 'Reset Wallet'}
              </button>
            </div>
          </div>

          {flash && (
            <div
              className={`flex items-center gap-2.5 rounded-2xl border px-5 py-3.5 text-sm font-medium ${
                flash.tone === 'error'
                  ? 'border-red-200 bg-red-50/70 text-red-700'
                  : flash.tone === 'queued'
                    ? 'border-amber-200 bg-amber-50/70 text-amber-800'
                    : 'border-emerald-200 bg-emerald-50/70 text-emerald-800'
              }`}
            >
              {flash.tone === 'error' ? (
                <AlertCircle className="h-4 w-4 shrink-0" />
              ) : flash.tone === 'queued' ? (
                <Clock className="h-4 w-4 shrink-0" />
              ) : (
                <CheckCircle2 className="h-4 w-4 shrink-0" />
              )}
              {flash.text}
            </div>
          )}

          {/* Wallet */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <div className="relative overflow-hidden rounded-2xl bg-gray-900 p-6 text-white">
              <div className="absolute -top-10 -right-10 h-36 w-36 rounded-full border border-white/10" />
              <div className="absolute -top-2 -right-2 h-24 w-24 rounded-full border border-white/10" />
              <div className="relative flex items-center justify-between">
                <p className="text-xs text-gray-400">Portfolio Value</p>
                <button
                  onClick={() => setShowValues((v) => !v)}
                  className="text-gray-400 transition hover:text-white"
                  aria-label="Toggle amounts"
                >
                  {showValues ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                </button>
              </div>
              <p className="relative mt-2 text-3xl font-bold">
                {showValues ? inr(portfolio) : '••••••••'}
              </p>
              <div className="relative mt-3 flex flex-wrap items-center gap-2">
                <span
                  className={`inline-flex items-center gap-1 rounded-full bg-white/10 px-2.5 py-1 text-xs font-semibold ${
                    totalPnl >= 0 ? 'text-emerald-400' : 'text-red-400'
                  }`}
                >
                  {totalPnl >= 0 ? (
                    <TrendingUp className="h-3 w-3" />
                  ) : (
                    <TrendingDown className="h-3 w-3" />
                  )}
                  {pct(totalPnlPct)}
                </span>
                <span className="text-xs text-gray-400">
                  {showValues ? signed(totalPnl) : '•••••'} on {inr(startingCapital, 0)} start
                </span>
              </div>
              <div className="relative mt-5 grid grid-cols-2 gap-4 border-t border-white/10 pt-4">
                <div>
                  <p className="text-[11px] text-gray-400">Realised</p>
                  <p
                    className={`mt-0.5 text-sm font-semibold ${
                      realised >= 0 ? 'text-emerald-400' : 'text-red-400'
                    }`}
                  >
                    {showValues ? signed(realised) : '•••••'}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] text-gray-400">Unrealised</p>
                  <p
                    className={`mt-0.5 text-sm font-semibold ${
                      unrealised >= 0 ? 'text-emerald-400' : 'text-red-400'
                    }`}
                  >
                    {showValues ? signed(unrealised) : '•••••'}
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 lg:col-span-2">
              {stats.map(({ label, value, note, tone, icon: Icon }) => (
                <div key={label} className="rounded-2xl border border-gray-200 bg-white p-5">
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-gray-500">{label}</p>
                    <Icon className="h-4 w-4 text-gray-300" />
                  </div>
                  <p className={`mt-1.5 text-xl font-bold ${tone}`}>
                    {showValues ? value : '••••••'}
                  </p>
                  <p className="mt-0.5 text-xs text-gray-400">{showValues ? note : '•••••'}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Main grid */}
          <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
            <div className="space-y-5 xl:col-span-2">
              <Section
                icon={Activity}
                title="Portfolio Growth"
                subtitle="Wallet value rebuilt from your trades and real closing prices"
                right={
                  curve && (
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-bold ${
                        totalPnl >= 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'
                      }`}
                    >
                      {pct(totalPnlPct)}
                    </span>
                  )
                }
              >
                {curve ? (
                  <>
                    <div className="h-64">
                      <Line data={equityChart} options={equityOptions} />
                    </div>
                    {curve.missing.length > 0 && (
                      <p className="mt-3 text-xs text-amber-600">
                        Past prices for {curve.missing.join(', ')} were unavailable, so those days
                        are valued without them.
                      </p>
                    )}
                  </>
                ) : (
                  <div className="rounded-xl bg-gray-50 p-8 text-center">
                    <p className="text-sm font-medium text-gray-700">No trades yet</p>
                    <p className="mt-1 text-sm text-gray-500">
                      Your wallet is sitting in cash at {inr(startingCapital, 0)}. Place your first
                      order and this line starts tracking it.
                    </p>
                  </div>
                )}
              </Section>

              <Section
                icon={Briefcase}
                title="My Holdings"
                subtitle={`${positions.length} ${
                  positions.length === 1 ? 'stock' : 'stocks'
                } in the portfolio`}
              >
                {positions.length === 0 ? (
                  <p className="rounded-xl bg-gray-50 p-5 text-sm text-gray-500">
                    No open positions. Use the order ticket to buy your first stock.
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[720px] text-left">
                      <thead>
                        <tr className="border-b border-gray-200">
                          {['Stock', 'Qty', 'Avg Price', 'LTP', 'Invested', 'Current', 'P&L', ''].map(
                            (h) => (
                              <th
                                key={h}
                                className="pb-3 text-xs font-semibold tracking-wider text-gray-500 uppercase"
                              >
                                {h}
                              </th>
                            ),
                          )}
                        </tr>
                      </thead>
                      <tbody>
                        {positions.map((p) => (
                          <tr key={p.symbol} className="border-b border-gray-100 last:border-0">
                            <td className="py-3.5">
                              <p className="text-sm font-bold text-gray-900">{p.symbol}</p>
                              <p className="truncate text-xs text-gray-500">{p.name}</p>
                            </td>
                            <td className="py-3.5 text-sm text-gray-700">{p.qty}</td>
                            <td className="py-3.5 text-sm text-gray-700">{inr(p.avgPrice)}</td>
                            <td className="py-3.5 text-sm font-semibold text-gray-900">
                              {p.priced ? inr(p.ltp) : '—'}
                            </td>
                            <td className="py-3.5 text-sm text-gray-700">{inr(p.invested)}</td>
                            <td className="py-3.5 text-sm text-gray-700">
                              {p.priced ? inr(p.value) : '—'}
                            </td>
                            <td className="py-3.5">
                              {p.priced ? (
                                <>
                                  <p
                                    className={`text-sm font-bold ${
                                      p.pnl >= 0 ? 'text-emerald-600' : 'text-red-500'
                                    }`}
                                  >
                                    {signed(p.pnl)}
                                  </p>
                                  <p
                                    className={`text-xs ${
                                      p.pnl >= 0 ? 'text-emerald-600' : 'text-red-500'
                                    }`}
                                  >
                                    {pct(p.pnlPct)}
                                  </p>
                                </>
                              ) : (
                                <p className="text-xs text-gray-400">waiting for price</p>
                              )}
                            </td>
                            <td className="py-3.5">
                              <div className="flex justify-end gap-2">
                                <button
                                  onClick={() => openTicket(p.symbol, p.name, 'BUY')}
                                  className="rounded-lg bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700 transition hover:bg-emerald-100"
                                >
                                  Buy
                                </button>
                                <button
                                  onClick={() => openTicket(p.symbol, p.name, 'SELL')}
                                  className="rounded-lg bg-red-50 px-3 py-1.5 text-xs font-bold text-red-600 transition hover:bg-red-100"
                                >
                                  Sell
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Section>

              <Section
                icon={ListOrdered}
                title="Order History"
                subtitle={
                  account.orders.length
                    ? `${account.orders.length} orders — latest first${
                        pendingCount
                          ? ` · ${pendingCount} waiting for the open`
                          : ''
                      }`
                    : 'Your filled orders will be listed here'
                }
              >
                {account.orders.length === 0 ? (
                  <p className="rounded-xl bg-gray-50 p-5 text-sm text-gray-500">
                    No orders placed yet.
                  </p>
                ) : (
                  <div className="max-h-96 overflow-auto">
                    <table className="w-full min-w-[820px] text-left">
                      <thead className="sticky top-0 bg-white">
                        <tr className="border-b border-gray-200">
                          {[
                            'Order',
                            'Date & Time',
                            'Type',
                            'Stock',
                            'Qty',
                            'Price',
                            'Amount',
                            'Status',
                            'Booked P&L',
                          ].map((h) => (
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
                        {account.orders.map((o) => (
                          <tr
                            key={`${o.ref}-${o.placedAt}`}
                            className="border-b border-gray-100 last:border-0"
                          >
                            <td className="py-3 text-xs font-medium text-gray-400">{o.ref}</td>
                            <td className="py-3 text-sm text-gray-700">{stamp(o.placedAt)}</td>
                            <td className="py-3">
                              <span
                                className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold ${
                                  o.action === 'BUY'
                                    ? 'bg-emerald-100 text-emerald-700'
                                    : 'bg-red-100 text-red-700'
                                }`}
                              >
                                {o.action === 'BUY' ? (
                                  <TrendingUp className="h-3 w-3" />
                                ) : (
                                  <TrendingDown className="h-3 w-3" />
                                )}
                                {o.action}
                              </span>
                            </td>
                            <td className="py-3 text-sm font-semibold text-gray-900">{o.symbol}</td>
                            <td className="py-3 text-sm text-gray-700">{o.qty}</td>
                            <td className="py-3 text-sm text-gray-700">
                              {o.price === null ? <span className="text-gray-300">—</span> : inr(o.price)}
                            </td>
                            <td className="py-3 text-sm text-gray-700">
                              {o.amount === null ? (
                                <span className="text-gray-300">—</span>
                              ) : (
                                inr(o.amount)
                              )}
                            </td>
                            <td className="py-3">
                              <span
                                title={o.note || undefined}
                                className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                                  (STATUS_BADGES[o.status] || STATUS_BADGES.EXECUTED).className
                                }`}
                              >
                                {(STATUS_BADGES[o.status] || STATUS_BADGES.EXECUTED).label}
                              </span>
                            </td>
                            <td className="py-3 text-sm">
                              {o.realised === null ? (
                                <span className="text-gray-300">—</span>
                              ) : (
                                <span
                                  className={`font-semibold ${
                                    o.realised >= 0 ? 'text-emerald-600' : 'text-red-500'
                                  }`}
                                >
                                  {signed(o.realised)}
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Section>
            </div>

            {/* Right rail */}
            <div className="space-y-5">
              {/* Order ticket */}
              <section className="rounded-2xl border border-gray-200 bg-white p-6">
                <div className="flex items-start gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                    <Wallet className="h-4 w-4" />
                  </span>
                  <div>
                    <h2 className="text-base font-bold text-gray-900">Place an Order</h2>
                    <p className="mt-0.5 text-sm text-gray-500">
                      {isOpen ? 'Fills at the live market price' : 'Queued until the market opens'}
                    </p>
                  </div>
                </div>

                <div className="mt-5 grid grid-cols-2 gap-2 rounded-xl bg-gray-100 p-1">
                  {['BUY', 'SELL'].map((s) => (
                    <button
                      key={s}
                      onClick={() => setSide(s)}
                      className={`rounded-lg py-2 text-sm font-bold transition ${
                        side === s
                          ? s === 'BUY'
                            ? 'bg-emerald-600 text-white'
                            : 'bg-red-500 text-white'
                          : 'text-gray-500 hover:text-gray-900'
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>

                <div className="mt-4 space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700">Stock</label>
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setShowPicker((v) => !v)}
                        className={`${inputClass} mt-1.5 flex items-center justify-between text-left`}
                      >
                        <span className="truncate font-semibold">{ticketSymbol}</span>
                        <Search className="h-4 w-4 shrink-0 text-gray-400" />
                      </button>

                      {showPicker && (
                        <div className="absolute z-20 mt-2 w-full overflow-hidden rounded-xl border border-gray-200 bg-white shadow-lg">
                          <div className="relative border-b border-gray-100">
                            <Search className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-gray-400" />
                            <input
                              autoFocus
                              value={pickerQuery}
                              onChange={(e) => setPickerQuery(e.target.value)}
                              placeholder="Search any NSE stock"
                              className="w-full py-2.5 pr-4 pl-10 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none"
                            />
                          </div>
                          <div className="max-h-64 overflow-y-auto">
                            {pickerResults.length === 0 ? (
                              <p className="px-4 py-3 text-sm text-gray-500">No match found.</p>
                            ) : (
                              pickerResults.map((s) => (
                                <button
                                  key={s.symbol}
                                  type="button"
                                  onClick={() => {
                                    openTicket(s.symbol, s.name, side)
                                    setPickerQuery('')
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
                    <p className="mt-1 truncate text-xs text-gray-400">{ticketName}</p>
                  </div>

                  <div className="rounded-xl bg-gray-50 px-4 py-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-500">Last traded price</span>
                      <span className="text-sm font-bold text-gray-900">
                        {ticketLtp ? inr(ticketLtp) : '—'}
                      </span>
                    </div>
                    <div className="mt-1.5 flex items-center justify-between">
                      <span className="text-xs text-gray-500">
                        {side === 'BUY' ? 'Available cash' : 'Shares held'}
                      </span>
                      <span className="text-xs font-semibold text-gray-700">
                        {side === 'BUY' ? inr(cash) : `${heldQty}`}
                      </span>
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between">
                      <label className="block text-xs font-semibold text-gray-700">Quantity</label>
                      <span className="text-xs text-gray-400">Max {maxQty}</span>
                    </div>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={qty}
                      onChange={(e) => setQty(cleanNumber(e.target.value))}
                      className={`${inputClass} mt-1.5`}
                    />
                    <div className="mt-2 grid grid-cols-4 gap-2">
                      {[25, 50, 75, 100].map((share) => (
                        <button
                          key={share}
                          onClick={() => setQty(String(Math.floor((maxQty * share) / 100)))}
                          className="rounded-lg border border-gray-200 py-1.5 text-xs font-semibold text-gray-600 transition hover:border-gray-300 hover:bg-gray-50"
                        >
                          {share === 100 ? 'Max' : `${share}%`}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center justify-between border-t border-gray-100 pt-4">
                    <span className="text-sm text-gray-500">
                      {isOpen ? 'Order value' : 'Approximate value'}
                    </span>
                    <span className="text-lg font-bold text-gray-900">{inr(orderValue)}</span>
                  </div>

                  {!isOpen && (
                    <div className="flex items-start gap-2.5 rounded-xl bg-amber-50 px-3.5 py-3 text-xs text-amber-800">
                      <Clock className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      <p>
                        The market is {market?.holiday ? 'closed for a holiday' : 'closed'}. This
                        order will be held and filled at the opening price
                        {market?.opensAt ? ` ${market.opensAt}` : ''}, not at the last closing
                        price.
                      </p>
                    </div>
                  )}

                  {ticketError && orderQty > 0 && (
                    <p className="rounded-xl bg-red-50 px-3.5 py-2.5 text-xs font-medium text-red-600">
                      {ticketError}
                    </p>
                  )}

                  <button
                    onClick={placeOrder}
                    disabled={Boolean(ticketError) || busy}
                    className={`flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold text-white transition disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-gray-400 ${
                      side === 'BUY'
                        ? 'bg-emerald-600 hover:bg-emerald-700'
                        : 'bg-red-500 hover:bg-red-600'
                    }`}
                  >
                    {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                    {isOpen
                      ? `${side === 'BUY' ? 'Buy' : 'Sell'} ${ticketSymbol}`
                      : `Queue ${side === 'BUY' ? 'buy' : 'sell'} for the open`}
                  </button>
                </div>
              </section>

              {/* Allocation */}
              <Section icon={PieChart} title="Allocation" subtitle="Where the money sits">
                <div className="h-44">
                  <Doughnut data={allocationChart} options={allocationOptions} />
                </div>
                <div className="mt-4 space-y-2">
                  {[
                    ...positions.map((p, i) => ({
                      label: p.symbol,
                      value: p.value,
                      color: SLICE_COLORS[i % SLICE_COLORS.length],
                    })),
                    { label: 'Cash', value: cash, color: '#e5e7eb' },
                  ].map((row) => (
                    <div key={row.label} className="flex items-center gap-2.5 text-xs">
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{ backgroundColor: row.color }}
                      />
                      <span className="flex-1 font-medium text-gray-700">{row.label}</span>
                      <span className="text-gray-500">
                        {portfolio ? ((row.value / portfolio) * 100).toFixed(1) : '0.0'}%
                      </span>
                    </div>
                  ))}
                </div>
              </Section>

            </div>
          </div>

          {/* Disclaimer */}
          <div className="flex items-start gap-2.5 rounded-2xl border border-gray-200 bg-white p-5 text-sm text-gray-500">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" />
            <p>
              Prices come from Yahoo Finance and can be delayed by a few minutes, so a fill here
              may not match the exact price on the exchange. Orders placed while the market is
              shut wait for the next session and fill at the price then. Orders fill instantly and
              in full, and brokerage, taxes and slippage are ignored. The money is virtual —
              nothing is sent to a real broker.
            </p>
          </div>
        </main>
      </div>
    </div>
  )
}
