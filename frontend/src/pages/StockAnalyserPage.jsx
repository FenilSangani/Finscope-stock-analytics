import { useEffect, useState } from 'react'
import {
  BarController,
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Filler,
  Legend,
  LinearScale,
  LineController,
  LineElement,
  PointElement,
  Tooltip,
} from 'chart.js'
import { Chart, Line } from 'react-chartjs-2'
import {
  AlertCircle,
  AlertTriangle,
  BarChart3 as BarChartIcon,
  Building2,
  CalendarDays,
  CheckCircle2,
  ExternalLink,
  Eye,
  Gauge,
  Info,
  LineChart as LineChartIcon,
  Loader2,
  Newspaper,
  PieChart,
  Scale,
  Search,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Users,
} from 'lucide-react'
import Sidebar from '../components/dashboard/Sidebar'
import { fetchStock, searchSymbols } from '../lib/api'

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  BarController,
  LineController,
  Filler,
  Legend,
  Tooltip,
)

const ACCENTS = [
  'bg-amber-100 text-amber-700',
  'bg-blue-100 text-blue-700',
  'bg-sky-100 text-sky-700',
  'bg-emerald-100 text-emerald-700',
  'bg-indigo-100 text-indigo-700',
  'bg-rose-100 text-rose-700',
]

function accentFor(symbol) {
  const sum = [...symbol].reduce((a, c) => a + c.charCodeAt(0), 0)
  return ACCENTS[sum % ACCENTS.length]
}

function inr(value, digits = 2) {
  if (value === null || value === undefined) return '—'
  return `₹${Number(value).toLocaleString('en-IN', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })}`
}

function crore(value) {
  if (value === null || value === undefined) return '—'
  const abs = Math.abs(value)
  if (abs >= 100000) return `₹${(value / 100000).toFixed(2)} L Cr`
  return `₹${Number(value).toLocaleString('en-IN')} Cr`
}

function pct(value, digits = 2) {
  if (value === null || value === undefined) return '—'
  return `${Number(value).toFixed(digits)}%`
}

function multiple(value) {
  if (value === null || value === undefined) return '—'
  return `${Number(value).toFixed(1)}x`
}

// Chart axis labels, scaled so small and large companies both read clearly.
function axisTick(value) {
  const abs = Math.abs(value)
  if (abs >= 100000) return `₹${(value / 100000).toFixed(1)}L Cr`
  if (abs >= 1000) return `₹${(value / 1000).toFixed(abs >= 10000 ? 0 : 1)}k Cr`
  return `₹${value.toLocaleString('en-IN')} Cr`
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

function Fact({ label, value }) {
  if (value === null || value === undefined || value === '') return null
  return (
    <div className="rounded-xl bg-gray-50 p-4">
      <p className="text-xs text-gray-500">{label}</p>
      <p className="mt-1 text-sm font-semibold break-words text-gray-900">{value}</p>
    </div>
  )
}

export default function StockAnalyserPage() {
  const [query, setQuery] = useState('')
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [stock, setStock] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [activeRange, setActiveRange] = useState('1 Year')
  const [suggestions, setSuggestions] = useState([])

  useEffect(() => {
    loadStock('RELIANCE')
  }, [])

  async function loadStock(symbol) {
    setLoading(true)
    setError(null)
    setQuery('')
    setShowSuggestions(false)
    window.scrollTo({ top: 0, behavior: 'smooth' })
    try {
      const data = await fetchStock(symbol)
      setStock(data)
      const ranges = Object.keys(data.timeframes || {})
      if (!ranges.includes(activeRange)) setActiveRange(ranges.at(-3) || ranges[0])
    } catch (err) {
      setStock(null)
      setError(err?.errors?.form || 'Could not load this stock. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  // Type-ahead across every NSE listed stock, debounced so each keystroke
  // does not fire its own request.
  useEffect(() => {
    if (!showSuggestions) return

    let cancelled = false
    const timer = setTimeout(() => {
      searchSymbols(query)
        .then((data) => {
          if (!cancelled) setSuggestions(data.results || [])
        })
        .catch(() => {
          if (!cancelled) setSuggestions([])
        })
    }, 250)

    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [query, showSuggestions])

  function submitSearch() {
    const typed = query.trim().toUpperCase()
    if (!typed) return
    loadStock(suggestions[0]?.symbol === typed ? typed : suggestions[0]?.symbol || typed)
  }

  const timeframes = stock?.timeframes || {}
  const ranges = Object.keys(timeframes)
  const frame = timeframes[activeRange] || timeframes[ranges[0]]
  const frameUp = (frame?.changePct ?? 0) >= 0
  const lineColor = frameUp ? '#10b981' : '#ef4444'

  const chartData = frame && {
    labels: frame.labels,
    datasets: [
      {
        label: 'Price',
        data: frame.prices,
        borderColor: lineColor,
        backgroundColor: (ctx) => {
          const { chart } = ctx
          const { ctx: c, chartArea } = chart
          if (!chartArea) return 'transparent'
          const g = c.createLinearGradient(0, chartArea.top, 0, chartArea.bottom)
          g.addColorStop(0, frameUp ? 'rgba(16,185,129,0.22)' : 'rgba(239,68,68,0.22)')
          g.addColorStop(1, 'rgba(255,255,255,0)')
          return g
        },
        borderWidth: 2,
        pointRadius: 0,
        pointHoverRadius: 5,
        pointHoverBackgroundColor: lineColor,
        pointHoverBorderColor: '#fff',
        pointHoverBorderWidth: 2,
        tension: 0.25,
        fill: true,
      },
      {
        label: '200 EMA',
        data: frame.ema200,
        borderColor: '#6366f1',
        borderWidth: 1.5,
        borderDash: [5, 4],
        pointRadius: 0,
        pointHoverRadius: 0,
        tension: 0.25,
        fill: false,
      },
    ],
  }

  const chartOptions = {
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
        usePointStyle: true,
        boxWidth: 8,
        boxHeight: 8,
        callbacks: {
          label: (ctx) => `${ctx.dataset.label}: ${inr(ctx.parsed.y)}`,
        },
      },
    },
  }

  // Profit shares the revenue axis, so the profit line always sits inside the
  // bars and its height reads as a share of revenue.
  const comboOptions = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    scales: {
      x: { grid: { display: false }, ticks: { color: '#6b7280', font: { size: 11 } } },
      y: {
        beginAtZero: true,
        grid: { color: '#f1f5f9' },
        ticks: {
          color: '#9ca3af',
          font: { size: 11 },
          callback: axisTick,
        },
      },
    },
    plugins: {
      legend: {
        display: true,
        position: 'top',
        align: 'end',
        labels: { usePointStyle: true, boxWidth: 8, boxHeight: 8, font: { size: 11 } },
      },
      tooltip: {
        backgroundColor: '#111827',
        padding: 12,
        cornerRadius: 10,
        usePointStyle: true,
        callbacks: {
          label: (ctx) => {
            const value = `₹${ctx.parsed.y.toLocaleString('en-IN')} Cr`
            if (ctx.dataset.label !== 'Net Profit') return `Revenue: ${value}`
            const revenue = ctx.chart.data.datasets[0].data[ctx.dataIndex]
            const share = revenue ? ((ctx.parsed.y / revenue) * 100).toFixed(1) : null
            return share
              ? `Net Profit: ${value} (${share}% of revenue)`
              : `Net Profit: ${value}`
          },
        },
      },
    },
  }

  function comboData(rows) {
    return {
      labels: rows.map((r) => r.shortPeriod || r.period),
      datasets: [
        {
          label: 'Revenue',
          data: rows.map((r) => r.revenue),
          backgroundColor: '#3b82f6',
          borderRadius: 8,
          barPercentage: 0.9,
          categoryPercentage: 0.65,
        },
        {
          label: 'Net Profit',
          data: rows.map((r) => r.profit),
          // A loss-making quarter shows red instead of green.
          backgroundColor: rows.map((r) => (r.profit < 0 ? '#ef4444' : '#10b981')),
          borderRadius: 8,
          barPercentage: 0.9,
          categoryPercentage: 0.65,
        },
      ],
    }
  }

  const ratioCards = stock && [
    { label: 'P/E Ratio', value: multiple(stock.ratios.peRatio), note: 'Price vs earnings' },
    { label: 'ROE', value: pct(stock.ratios.roe), note: 'Return on equity' },
    { label: 'Debt to Equity', value: stock.ratios.debtToEquity ?? '—', note: 'Below 1 is healthy' },
    { label: 'EPS (TTM)', value: inr(stock.ratios.eps), note: 'Earnings per share' },
    { label: 'Book Value', value: inr(stock.ratios.bookValue), note: 'Per share' },
    { label: 'Dividend Yield', value: pct(stock.ratios.dividendYield), note: 'Annual payout' },
    { label: 'Price to Book', value: multiple(stock.ratios.priceToBook), note: 'Value measure' },
    { label: 'Net Margin', value: pct(stock.ratios.profitMargin), note: 'Profit per ₹100 sales' },
  ]

  const positive = (stock?.changePct ?? 0) >= 0
  const maxRevenue = stock?.financials?.length
    ? Math.max(...stock.financials.map((f) => f.revenue))
    : 0

  return (
    <div className="flex min-h-screen bg-[#f8f9fb]">
      <Sidebar />

      <div className="flex min-w-0 flex-1 flex-col">

        <main className="flex-1 space-y-5 p-8">
          {/* Heading + search */}
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Stock Analyser</h1>
              <p className="mt-1 text-sm text-gray-500">
                Search any NSE listed stock to read a live company report in plain English.
              </p>
            </div>

            <div className="relative w-full lg:max-w-sm">
              <Search className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value)
                  setShowSuggestions(true)
                }}
                onFocus={() => setShowSuggestions(true)}
                onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    submitSearch()
                    e.currentTarget.blur()
                  }
                }}
                placeholder="Search any NSE stock (RELIANCE, TCS, SBIN…)"
                className="w-full rounded-xl border border-gray-200 bg-white py-2.5 pr-4 pl-10 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 focus:outline-none"
              />

              {showSuggestions && (
                <div className="absolute z-20 mt-2 max-h-72 w-full overflow-y-auto rounded-xl border border-gray-200 bg-white shadow-lg">
                  {suggestions.length === 0 ? (
                    <button
                      onMouseDown={() => loadStock(query.trim().toUpperCase())}
                      className="w-full px-4 py-3 text-left text-sm text-gray-600 hover:bg-gray-50"
                    >
                      Search NSE for “{query.trim().toUpperCase()}”
                    </button>
                  ) : (
                    suggestions.map((s) => (
                      <button
                        key={s.symbol}
                        onMouseDown={() => loadStock(s.symbol)}
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
              )}
            </div>
          </div>

          {loading && (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-gray-200 bg-white py-24">
              <Loader2 className="h-7 w-7 animate-spin text-blue-600" />
              <p className="mt-3 text-sm text-gray-500">Loading live market data…</p>
            </div>
          )}

          {!loading && error && (
            <div className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50/50 p-6">
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-500" />
              <div>
                <p className="font-semibold text-gray-900">Could not load this stock</p>
                <p className="mt-1 text-sm text-gray-600">{error}</p>
              </div>
            </div>
          )}

          {!loading && stock && (
            <>
              {/* Company header */}
              <div className="rounded-2xl border border-gray-200 bg-white p-6">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <span
                      className={`flex h-14 w-14 items-center justify-center rounded-2xl text-xl font-bold ${accentFor(stock.symbol)}`}
                    >
                      {stock.symbol[0]}
                    </span>
                    <div>
                      <h2 className="text-xl font-bold text-gray-900">
                        {stock.name}{' '}
                        <span className="text-base font-semibold text-gray-400">
                          ({stock.exchange}: {stock.symbol})
                        </span>
                      </h2>
                      <p className="mt-0.5 text-sm text-gray-500">
                        {[stock.sector, stock.industry].filter(Boolean).join(' · ')}
                      </p>
                    </div>
                  </div>

                  <div className="text-right">
                    <p className="text-2xl font-bold text-gray-900">{inr(stock.price)}</p>
                    <p
                      className={`flex items-center justify-end gap-1 text-sm font-semibold ${
                        positive ? 'text-emerald-600' : 'text-red-500'
                      }`}
                    >
                      {positive ? (
                        <TrendingUp className="h-3.5 w-3.5" />
                      ) : (
                        <TrendingDown className="h-3.5 w-3.5" />
                      )}
                      {positive ? '+' : ''}
                      {stock.change} ({stock.changePct}%)
                    </p>
                  </div>
                </div>

                <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
                  <Fact label="Market Cap" value={crore(stock.marketCap)} />
                  <Fact label="52 Week High" value={inr(stock.high52)} />
                  <Fact label="52 Week Low" value={inr(stock.low52)} />
                  <Fact label="Listed On" value="NSE, BSE" />
                </div>
              </div>

              {/* Overview */}
              {stock.overview?.description && (
                <Section
                  icon={Building2}
                  title="Company Overview"
                  subtitle="What this company actually does"
                >
                  <p className="text-sm leading-relaxed text-gray-600">
                    {stock.overview.description}
                  </p>

                  <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                    <Fact label="Established" value={stock.overview.founded} />
                    <Fact label="Headquarters" value={stock.overview.headquarters} />
                    <Fact
                      label="Employees"
                      value={
                        stock.overview.employees
                          ? Number(stock.overview.employees).toLocaleString('en-IN')
                          : null
                      }
                    />
                    <Fact label="IPO Date" value={stock.overview.ipoDate} />
                    <Fact label="IPO Price" value={stock.overview.ipoPrice} />
                    <Fact label="Presence" value={stock.overview.presence} />
                    <Fact label="Website" value={stock.overview.website} />
                  </div>
                </Section>
              )}

              {/* Segments (curated only) */}
              {stock.segments?.length > 0 && (
                <Section
                  icon={PieChart}
                  title="Main Business Segments"
                  subtitle="Where the money comes from"
                >
                  <div className="space-y-4">
                    {stock.segments.map((seg) => (
                      <div key={seg.name}>
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-semibold text-gray-900">{seg.name}</p>
                          <p className="text-sm font-bold text-blue-600">{seg.share}%</p>
                        </div>
                        {seg.note && <p className="mt-0.5 text-xs text-gray-500">{seg.note}</p>}
                        <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-gray-100">
                          <div
                            className="h-full rounded-full bg-blue-500"
                            style={{ width: `${seg.share}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </Section>
              )}

              {/* Price chart */}
              {frame && (
                <Section
                  icon={LineChartIcon}
                  title="Price Chart"
                  subtitle="Live historical prices from the market"
                  right={
                    <div
                      className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-bold ${
                        frameUp ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-500'
                      }`}
                    >
                      {frameUp ? (
                        <TrendingUp className="h-4 w-4" />
                      ) : (
                        <TrendingDown className="h-4 w-4" />
                      )}
                      {frameUp ? '+' : ''}
                      {frame.changePct}%
                      <span className="font-medium text-gray-400">in {activeRange}</span>
                    </div>
                  }
                >
                  <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex flex-wrap gap-2">
                      {ranges.map((range) => (
                        <button
                          key={range}
                          onClick={() => setActiveRange(range)}
                          className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                            activeRange === range
                              ? 'bg-gray-900 text-white'
                              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                          }`}
                        >
                          {range}
                        </button>
                      ))}
                    </div>

                    <div className="flex items-center gap-4 text-xs text-gray-500">
                      <span className="flex items-center gap-1.5">
                        <span className="h-0.5 w-5 rounded" style={{ backgroundColor: lineColor }} />
                        Price
                      </span>
                      <span className="flex items-center gap-1.5">
                        <span className="h-0.5 w-5 rounded border-t-2 border-dashed border-indigo-500" />
                        200 EMA
                      </span>
                    </div>
                  </div>

                  <div className="h-72">
                    <Line data={chartData} options={chartOptions} />
                  </div>

                  <p className="mt-3 text-xs text-gray-400">
                    Hover anywhere on the chart to see the price and the 200 EMA at that point.
                    When price stays above the 200 EMA the trend is usually up, and below it the
                    trend is usually down.
                  </p>
                </Section>
              )}

              {/* Ratios */}
              <Section
                icon={Sparkles}
                title="Key Fundamental Ratios"
                subtitle="The numbers investors check first"
              >
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                  {ratioCards.map((r) => (
                    <div key={r.label} className="rounded-xl border border-gray-200 p-4">
                      <p className="text-xs text-gray-500">{r.label}</p>
                      <p className="mt-1 text-lg font-bold text-gray-900">{r.value}</p>
                      <p className="mt-0.5 text-xs text-gray-400">{r.note}</p>
                    </div>
                  ))}
                </div>
              </Section>

              {/* Yearly revenue & profit */}
              {stock.financials?.length > 0 && (
                <Section
                  icon={BarChartIcon}
                  title="Revenue & Net Profit"
                  subtitle="Yearly performance (₹ in Crore)"
                >
                  <div className="space-y-5">
                    {stock.financials.map((f) => (
                      <div key={f.period}>
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="text-sm font-semibold text-gray-900">{f.period}</p>
                          <p className="text-xs text-gray-500">
                            Revenue:{' '}
                            <span className="font-semibold text-gray-900">
                              ₹{f.revenue.toLocaleString('en-IN')} Cr
                            </span>
                            <span className="mx-2 text-gray-300">|</span>
                            Profit:{' '}
                            <span className="font-semibold text-emerald-600">
                              {f.profit !== null ? `₹${f.profit.toLocaleString('en-IN')} Cr` : '—'}
                            </span>
                          </p>
                        </div>
                        <div className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-gray-100">
                          <div
                            className="h-full rounded-full bg-blue-500"
                            style={{ width: `${(f.revenue / maxRevenue) * 100}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="mt-8 border-t border-gray-100 pt-6">
                    <p className="mb-4 text-sm font-semibold text-gray-900">
                      Revenue and net profit side by side
                    </p>
                    <div className="h-72">
                      <Chart type="bar" data={comboData(stock.financials)} options={comboOptions} />
                    </div>
                  </div>
                </Section>
              )}

              {/* Quarterly */}
              {stock.quarterly?.length > 0 && (
                <Section
                  icon={CalendarDays}
                  title="Recent Quarterly Results"
                  subtitle="Most recent quarter last (₹ in Crore)"
                >
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[480px] text-left">
                      <thead>
                        <tr className="border-b border-gray-200">
                          {['Quarter', 'Revenue', 'Net Profit', 'Net Margin'].map((h) => (
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
                        {[...stock.quarterly].reverse().map((q) => (
                          <tr key={q.period} className="border-b border-gray-100 last:border-0">
                            <td className="py-3.5 text-sm font-semibold text-gray-900">
                              {q.period}
                            </td>
                            <td className="py-3.5 text-sm text-gray-700">
                              ₹{q.revenue.toLocaleString('en-IN')} Cr
                            </td>
                            <td className="py-3.5 text-sm text-gray-700">
                              {q.profit !== null ? `₹${q.profit.toLocaleString('en-IN')} Cr` : '—'}
                            </td>
                            <td className="py-3.5 text-sm text-gray-700">
                              {q.profit !== null && q.revenue
                                ? `${((q.profit / q.revenue) * 100).toFixed(1)}%`
                                : '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="mt-8 border-t border-gray-100 pt-6">
                    <p className="mb-4 text-sm font-semibold text-gray-900">
                      Quarterly revenue and net profit side by side
                    </p>
                    <div className="h-72">
                      <Chart type="bar" data={comboData(stock.quarterly)} options={comboOptions} />
                    </div>
                  </div>

                  {stock.quarterly.length < 4 && (
                    <p className="mt-4 flex items-start gap-2 rounded-xl bg-amber-50 p-3 text-xs text-amber-800">
                      <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      Only {stock.quarterly.length} quarter
                      {stock.quarterly.length === 1 ? '' : 's'} of data is published for this
                      company by our data source. Nothing has been estimated to fill the gap.
                    </p>
                  )}
                </Section>
              )}

              {/* Shareholding (curated only) */}
              {stock.shareholding && (
                <Section
                  icon={Users}
                  title="Shareholding Pattern"
                  subtitle="Who owns the company"
                >
                  <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                    {Object.entries(stock.shareholding)
                      .filter(([k]) => k !== 'asOf')
                      .map(([key, value]) => (
                        <div key={key} className="rounded-xl border border-gray-200 p-4">
                          <p className="text-xs text-gray-500 capitalize">{key}</p>
                          <p className="mt-2 text-lg font-bold text-gray-900">{value}%</p>
                        </div>
                      ))}
                  </div>
                </Section>
              )}

              {/* Balance sheet */}
              {stock.balanceSheet && (
                <Section
                  icon={Scale}
                  title="Balance Sheet Snapshot"
                  subtitle="What the company owns, what it owes, and the cash it generates"
                >
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {[
                      { label: 'Total Assets', key: 'totalAssets', tone: 'text-gray-900', note: 'Everything the company owns' },
                      { label: 'Total Liabilities', key: 'totalLiabilities', tone: 'text-gray-900', note: 'Everything it owes' },
                      { label: 'Shareholder Equity', key: 'totalEquity', tone: 'text-blue-600', note: 'Assets minus liabilities' },
                      { label: 'Cash & Equivalents', key: 'cash', tone: 'text-emerald-600', note: 'Ready money in hand' },
                      { label: 'Total Debt', key: 'totalDebt', tone: 'text-red-500', note: 'Borrowed money' },
                      { label: 'Free Cash Flow', key: 'freeCashFlow', tone: 'text-emerald-600', note: 'Cash left after spending' },
                    ].map((item) => (
                      <div key={item.key} className="rounded-xl border border-gray-200 p-4">
                        <p className="text-xs text-gray-500">{item.label}</p>
                        <p className={`mt-1 text-lg font-bold ${item.tone}`}>
                          {crore(stock.balanceSheet[item.key])}
                        </p>
                        <p className="mt-0.5 text-xs text-gray-400">{item.note}</p>
                      </div>
                    ))}
                  </div>

                  {stock.balanceSheet.totalAssets && stock.balanceSheet.totalEquity && (
                    <div className="mt-6">
                      <div className="mb-2 flex items-center justify-between text-xs text-gray-500">
                        <span>Assets vs Liabilities</span>
                        <span>
                          Equity is{' '}
                          {Math.round(
                            (stock.balanceSheet.totalEquity / stock.balanceSheet.totalAssets) * 100,
                          )}
                          % of total assets
                        </span>
                      </div>
                      <div className="flex h-3 w-full overflow-hidden rounded-full bg-gray-100">
                        <div
                          className="bg-red-400"
                          style={{
                            width: `${(stock.balanceSheet.totalLiabilities / stock.balanceSheet.totalAssets) * 100}%`,
                          }}
                        />
                        <div
                          className="bg-blue-500"
                          style={{
                            width: `${(stock.balanceSheet.totalEquity / stock.balanceSheet.totalAssets) * 100}%`,
                          }}
                        />
                      </div>
                      <div className="mt-2 flex gap-4 text-xs text-gray-500">
                        <span className="flex items-center gap-1.5">
                          <span className="h-2.5 w-2.5 rounded-full bg-red-400" /> Liabilities
                        </span>
                        <span className="flex items-center gap-1.5">
                          <span className="h-2.5 w-2.5 rounded-full bg-blue-500" /> Equity
                        </span>
                      </div>
                    </div>
                  )}
                </Section>
              )}

              {/* Peers */}
              {stock.peers?.length > 0 && (
                <Section
                  icon={Users}
                  title="Peer Comparison"
                  subtitle="How it stacks up against similar companies"
                >
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[560px] text-left">
                      <thead>
                        <tr className="border-b border-gray-200">
                          {['Company', 'Price', 'P/E', 'ROE', 'Market Cap'].map((h) => (
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
                        {stock.peers.map((p) => (
                          <tr
                            key={p.symbol}
                            className={`border-b border-gray-100 last:border-0 ${
                              p.self ? 'bg-blue-50/50' : ''
                            }`}
                          >
                            <td className="py-3.5 text-sm font-semibold text-gray-900">
                              {p.symbol}
                              {p.self && (
                                <span className="ml-2 rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-700">
                                  THIS STOCK
                                </span>
                              )}
                            </td>
                            <td className="py-3.5 text-sm text-gray-700">{inr(p.price)}</td>
                            <td className="py-3.5 text-sm text-gray-700">{multiple(p.peRatio)}</td>
                            <td className="py-3.5 text-sm text-gray-700">{pct(p.roe, 1)}</td>
                            <td className="py-3.5 text-sm text-gray-700">{crore(p.marketCap)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Section>
              )}

              {/* Pros and cons */}
              {(stock.pros?.length > 0 || stock.cons?.length > 0) && (
                <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
                  <section className="rounded-2xl border border-emerald-200 bg-emerald-50/40 p-6">
                    <div className="flex items-center gap-3">
                      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
                        <CheckCircle2 className="h-4 w-4" />
                      </span>
                      <h2 className="text-base font-bold text-gray-900">Advantages</h2>
                    </div>
                    {stock.pros?.length > 0 ? (
                      <ul className="mt-4 space-y-3">
                        {stock.pros.map((p) => (
                          <li key={p} className="flex gap-2.5 text-sm text-gray-700">
                            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                            {p}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="mt-4 text-sm text-gray-500">
                        No clear advantage found in the numbers we check.
                      </p>
                    )}
                  </section>

                  <section className="rounded-2xl border border-red-200 bg-red-50/40 p-6">
                    <div className="flex items-center gap-3">
                      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-red-100 text-red-700">
                        <AlertTriangle className="h-4 w-4" />
                      </span>
                      <h2 className="text-base font-bold text-gray-900">Risks</h2>
                    </div>
                    {stock.cons?.length > 0 ? (
                      <ul className="mt-4 space-y-3">
                        {stock.cons.map((c) => (
                          <li key={c} className="flex gap-2.5 text-sm text-gray-700">
                            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
                            {c}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="mt-4 text-sm text-gray-500">
                        No risk found in the numbers we check.
                      </p>
                    )}
                  </section>
                </div>
              )}

              {/* Analyst rating */}
              {stock.analystRating && (
                <Section
                  icon={Gauge}
                  title="Analyst Rating"
                  subtitle={`What ${stock.analystRating.total} market analysts recommend`}
                  right={
                    <span
                      className={`rounded-full px-4 py-1.5 text-sm font-bold ${
                        stock.analystRating.consensus === 'BUY'
                          ? 'bg-emerald-100 text-emerald-700'
                          : stock.analystRating.consensus === 'SELL'
                            ? 'bg-red-100 text-red-700'
                            : 'bg-amber-100 text-amber-700'
                      }`}
                    >
                      {stock.analystRating.consensus}
                    </span>
                  }
                >
                  {(() => {
                    const { buy, hold, sell, total } = stock.analystRating
                    const rows = [
                      { label: 'Buy', count: buy, color: 'bg-emerald-500', text: 'text-emerald-600' },
                      { label: 'Hold', count: hold, color: 'bg-amber-500', text: 'text-amber-600' },
                      { label: 'Sell', count: sell, color: 'bg-red-500', text: 'text-red-500' },
                    ]
                    return (
                      <>
                        <div className="mb-5 flex h-3 w-full overflow-hidden rounded-full bg-gray-100">
                          {rows.map((r) => (
                            <div
                              key={r.label}
                              className={r.color}
                              style={{ width: `${(r.count / total) * 100}%` }}
                            />
                          ))}
                        </div>

                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                          {rows.map((r) => (
                            <div key={r.label} className="rounded-xl border border-gray-200 p-4">
                              <div className="flex items-center gap-2">
                                <span className={`h-2.5 w-2.5 rounded-full ${r.color}`} />
                                <p className="text-xs text-gray-500">{r.label}</p>
                              </div>
                              <p className={`mt-2 text-lg font-bold ${r.text}`}>
                                {r.count}{' '}
                                <span className="text-sm font-medium text-gray-400">
                                  ({Math.round((r.count / total) * 100)}%)
                                </span>
                              </p>
                            </div>
                          ))}
                        </div>

                        {stock.analystRating.targetPrice && (
                          <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
                            <div className="rounded-xl bg-gray-50 p-4">
                              <p className="text-xs text-gray-500">Average Target Price</p>
                              <p className="mt-1 text-xl font-bold text-gray-900">
                                {inr(stock.analystRating.targetPrice)}
                              </p>
                            </div>
                            <div className="rounded-xl bg-gray-50 p-4">
                              <p className="text-xs text-gray-500">Potential Upside</p>
                              <p
                                className={`mt-1 text-xl font-bold ${
                                  stock.analystRating.upside >= 0
                                    ? 'text-emerald-600'
                                    : 'text-red-500'
                                }`}
                              >
                                {stock.analystRating.upside >= 0 ? '+' : ''}
                                {stock.analystRating.upside}%
                              </p>
                            </div>
                          </div>
                        )}
                      </>
                    )
                  })()}
                </Section>
              )}

              {/* Latest news */}
              {stock.news?.length > 0 && (
                <Section
                  icon={Newspaper}
                  title="Latest News"
                  subtitle={`Recent headlines about ${stock.name}`}
                >
                  <div className="space-y-2">
                    {stock.news.map((item) => (
                      <a
                        key={item.link || item.title}
                        href={item.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="group flex items-start justify-between gap-4 rounded-xl border border-gray-200 p-4 transition hover:border-gray-300 hover:bg-gray-50"
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-900 group-hover:text-blue-700">
                            {item.title}
                          </p>
                          <p className="mt-1 text-xs text-gray-500">
                            {[item.source, item.ago].filter(Boolean).join(' · ')}
                          </p>
                        </div>
                        <ExternalLink className="mt-0.5 h-4 w-4 shrink-0 text-gray-400 group-hover:text-blue-600" />
                      </a>
                    ))}
                  </div>
                </Section>
              )}

              {/* Key points */}
              {stock.keyPoints?.length > 0 && (
                <Section
                  icon={Eye}
                  title="Key Points to Watch"
                  subtitle="What to keep an eye on in this company, good and bad"
                >
                  <div className="space-y-3">
                    {stock.keyPoints.map((point) => {
                      const tone =
                        point.type === 'good'
                          ? { border: 'border-emerald-200', bg: 'bg-emerald-50/50', dot: 'bg-emerald-500' }
                          : point.type === 'bad'
                            ? { border: 'border-red-200', bg: 'bg-red-50/50', dot: 'bg-red-500' }
                            : { border: 'border-amber-200', bg: 'bg-amber-50/50', dot: 'bg-amber-500' }

                      return (
                        <div
                          key={point.text}
                          className={`flex gap-3 rounded-xl border p-4 ${tone.border} ${tone.bg}`}
                        >
                          <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${tone.dot}`} />
                          <p className="text-sm text-gray-700">{point.text}</p>
                        </div>
                      )
                    })}
                  </div>
                </Section>
              )}

              {/* Disclaimer */}
              <div className="flex items-start gap-2.5 rounded-2xl border border-gray-200 bg-white p-5 text-sm text-gray-500">
                <Info className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" />
                <p>
                  Live market data from Yahoo Finance, last fetched{' '}
                  {stock.fetchedAt
                    ? new Date(stock.fetchedAt).toLocaleString('en-IN')
                    : 'just now'}
                  . Prices may be delayed. This report is for learning, not investment advice.
                </p>
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  )
}
