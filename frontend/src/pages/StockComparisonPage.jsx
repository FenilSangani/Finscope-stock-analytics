import { useEffect, useMemo, useState } from 'react'
import {
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Filler,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  Tooltip,
} from 'chart.js'
import { Bar, Line } from 'react-chartjs-2'
import {
  Activity,
  AlertCircle,
  BarChart3,
  Crown,
  Gauge,
  Info,
  Loader2,
  Plus,
  Scale,
  Search,
  Sparkles,
  Trophy,
  TrendingDown,
  TrendingUp,
  X,
} from 'lucide-react'
import Sidebar from '../components/dashboard/Sidebar'
import { fetchComparison, searchSymbols } from '../lib/api'

const COMPARE_RANGES = [
  { label: '1 Month' },
  { label: '3 Month' },
  { label: '6 Month' },
  { label: '1 Year' },
  { label: '5 Year' },
]

// Each stock keeps one colour across every chart and table on the page.
const PALETTE = [
  { color: '#2563eb', accent: 'bg-blue-100 text-blue-700' },
  { color: '#10b981', accent: 'bg-emerald-100 text-emerald-700' },
  { color: '#f59e0b', accent: 'bg-amber-100 text-amber-700' },
  { color: '#8b5cf6', accent: 'bg-violet-100 text-violet-700' },
]

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Filler,
  Legend,
  Tooltip,
)

function inr(value, digits = 2) {
  if (value === null || value === undefined) return '—'
  return `₹${Number(value).toLocaleString('en-IN', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })}`
}

function crore(value) {
  if (value === null || value === undefined) return '—'
  if (Math.abs(value) >= 100000) return `₹${(value / 100000).toFixed(2)} L Cr`
  return `₹${Number(value).toLocaleString('en-IN')} Cr`
}

function times(value) {
  return `${Number(value).toFixed(1)}x`
}

function percent(value, digits = 1) {
  return `${Number(value).toFixed(digits)}%`
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

// Each row says which direction counts as better, so the winner can be marked.
const METRIC_ROWS = [
  { label: 'Current Price', get: (s) => s.price, format: inr, better: null },
  { label: 'Market Cap', get: (s) => s.marketCap, format: crore, better: 'high' },
  { label: 'P/E Ratio', get: (s) => s.ratios.peRatio, format: times, better: 'low', hint: 'Lower is cheaper' },
  { label: 'Price to Book', get: (s) => s.ratios.priceToBook, format: times, better: 'low' },
  { label: 'ROE', get: (s) => s.ratios.roe, format: percent, better: 'high', hint: 'Higher is better' },
  { label: 'Net Profit Margin', get: (s) => s.ratios.profitMargin, format: percent, better: 'high' },
  { label: 'Debt to Equity', get: (s) => s.ratios.debtToEquity, format: (v) => Number(v).toFixed(2), better: 'low', hint: 'Lower is safer' },
  { label: 'Dividend Yield', get: (s) => s.ratios.dividendYield, format: percent, better: 'high' },
  { label: 'EPS (TTM)', get: (s) => s.ratios.eps, format: inr, better: 'high' },
  { label: 'Free Cash Flow', get: (s) => s.balanceSheet.freeCashFlow, format: crore, better: 'high' },
  { label: 'Analyst Upside', get: (s) => s.analystRating?.upside, format: percent, better: 'high' },
]

// Year-on-year change between the last two financial years.
function yoy(stock, key) {
  const rows = stock.financials.filter((f) => f[key] !== null && f[key] !== undefined)
  if (rows.length < 2) return null
  const prev = rows.at(-2)[key]
  const last = rows.at(-1)[key]
  if (!prev) return null
  return Number((((last - prev) / Math.abs(prev)) * 100).toFixed(1))
}

// Compound annual growth rate across the whole available history.
function cagr(stock, key) {
  const rows = stock.financials.filter((f) => f[key] > 0)
  if (rows.length < 2) return null
  const years = rows.length - 1
  const start = rows[0][key]
  const end = rows.at(-1)[key]
  return Number(((Math.pow(end / start, 1 / years) - 1) * 100).toFixed(1))
}

const GROWTH_ROWS = [
  { label: 'Revenue Growth (YoY)', get: (s) => yoy(s, 'revenue'), format: percent, better: 'high' },
  { label: 'Net Profit Growth (YoY)', get: (s) => yoy(s, 'profit'), format: percent, better: 'high' },
  { label: 'EPS Growth (YoY)', get: (s) => yoy(s, 'eps'), format: percent, better: 'high' },
  { label: 'Revenue CAGR', get: (s) => cagr(s, 'revenue'), format: percent, better: 'high', hint: 'Average yearly growth' },
  { label: 'Net Profit CAGR', get: (s) => cagr(s, 'profit'), format: percent, better: 'high', hint: 'Average yearly growth' },
  { label: 'ROCE', get: (s) => s.ratios.roce, format: percent, better: 'high', hint: 'Return on capital employed' },
  { label: 'Operating Margin', get: (s) => s.ratios.operatingMargin, format: percent, better: 'high' },
  { label: 'Net Profit Margin', get: (s) => s.ratios.profitMargin, format: percent, better: 'high' },
]

const TREND_TABS = [
  { key: 'revenue', label: 'Revenue', unit: 'Cr' },
  { key: 'profit', label: 'Net Profit', unit: 'Cr' },
  { key: 'eps', label: 'EPS', unit: '' },
]

function winnerOf(stocks, row) {
  if (!row.better) return null
  const values = stocks.map((s) => row.get(s)).filter((v) => v !== null && v !== undefined)
  if (values.length < 2) return null
  const best = row.better === 'high' ? Math.max(...values) : Math.min(...values)
  const winners = stocks.filter((s) => row.get(s) === best)
  return winners.length === 1 ? winners[0].symbol : null
}

function MetricTable({ stocks, rows }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[620px] text-left">
        <thead>
          <tr className="border-b border-gray-200">
            <th className="pb-3 text-xs font-semibold tracking-wider text-gray-500 uppercase">
              Metric
            </th>
            {stocks.map((s) => (
              <th
                key={s.symbol}
                className="pb-3 text-xs font-semibold tracking-wider uppercase"
                style={{ color: s.color }}
              >
                {s.symbol}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const winner = winnerOf(stocks, row)
            return (
              <tr key={row.label} className="border-b border-gray-100 last:border-0">
                <td className="py-3.5 pr-4">
                  <p className="text-sm font-medium text-gray-900">{row.label}</p>
                  {row.hint && <p className="text-xs text-gray-400">{row.hint}</p>}
                </td>
                {stocks.map((s) => {
                  const value = row.get(s)
                  const isWinner = winner === s.symbol
                  const negative = typeof value === 'number' && value < 0
                  return (
                    <td key={s.symbol} className="py-3.5">
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-sm ${
                          isWinner
                            ? 'bg-emerald-50 font-bold text-emerald-700'
                            : negative
                              ? 'font-medium text-red-500'
                              : 'text-gray-700'
                        }`}
                      >
                        {value === null || value === undefined ? '—' : row.format(value)}
                        {isWinner && <Crown className="h-3.5 w-3.5" />}
                      </span>
                    </td>
                  )
                })}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

export default function StockComparisonPage() {
  const [selected, setSelected] = useState(['TCS', 'INFY', 'WIPRO'])
  const [range, setRange] = useState('1 Year')
  const [trendTab, setTrendTab] = useState('revenue')
  const [query, setQuery] = useState('')
  const [showPicker, setShowPicker] = useState(false)
  const [stocks, setStocks] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [results, setResults] = useState([])
  const [searching, setSearching] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)

    fetchComparison(selected)
      .then((data) => {
        if (cancelled) return
        setStocks(
          data.stocks.map((s, i) => ({
            ...s,
            color: PALETTE[i % PALETTE.length].color,
            accent: PALETTE[i % PALETTE.length].accent,
          })),
        )
      })
      .catch((err) => {
        if (cancelled) return
        setStocks([])
        setError(err?.errors?.form || 'Could not load comparison data. Please try again.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [selected])

  // Type-ahead across every NSE listed stock, debounced so each keystroke
  // does not fire its own request.
  useEffect(() => {
    if (!showPicker) return

    let cancelled = false
    setSearching(true)
    const timer = setTimeout(() => {
      searchSymbols(query)
        .then((data) => {
          if (!cancelled) setResults(data.results || [])
        })
        .catch(() => {
          if (!cancelled) setResults([])
        })
        .finally(() => {
          if (!cancelled) setSearching(false)
        })
    }, 250)

    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [query, showPicker])

  const available = useMemo(
    () => results.filter((s) => !selected.includes(s.symbol)).slice(0, 8),
    [results, selected],
  )

  function addStock(symbol) {
    if (selected.length >= 4 || selected.includes(symbol)) return
    setSelected([...selected, symbol])
    setQuery('')
    setShowPicker(false)
  }

  function removeStock(symbol) {
    if (selected.length <= 2) return
    setSelected(selected.filter((s) => s !== symbol))
  }

  // Price rebased to 100 so companies at different price levels compare fairly.
  const performanceData = {
    labels: stocks[0]?.timeframes[range].prices.map((_, i) => i) || [],
    datasets: stocks.map((s) => {
      const prices = s.timeframes[range].prices
      const base = prices[0]
      return {
        label: s.symbol,
        data: prices.map((p) => Number(((p / base) * 100).toFixed(2))),
        borderColor: s.color,
        backgroundColor: s.color,
        borderWidth: 2,
        pointRadius: 0,
        pointHoverRadius: 4,
        tension: 0.25,
        fill: false,
      }
    }),
  }

  const performanceOptions = {
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
          callback: (v) => `${v}`,
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
          title: () => '',
          label: (ctx) => {
            const changed = (ctx.parsed.y - 100).toFixed(1)
            return `${ctx.dataset.label}: ${changed >= 0 ? '+' : ''}${changed}%`
          },
        },
      },
    },
  }

  function barChart(label, getValue, formatTick) {
    return {
      data: {
        labels: stocks.map((s) => s.symbol),
        datasets: [
          {
            label,
            data: stocks.map(getValue),
            backgroundColor: stocks.map((s) => s.color),
            borderRadius: 8,
            barPercentage: 0.6,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: { grid: { display: false }, ticks: { color: '#6b7280', font: { size: 11 } } },
          y: {
            beginAtZero: true,
            grid: { color: '#f1f5f9' },
            ticks: { color: '#9ca3af', font: { size: 11 }, callback: formatTick },
          },
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#111827',
            padding: 10,
            cornerRadius: 10,
            displayColors: false,
            callbacks: { label: (ctx) => `${label}: ${formatTick(ctx.parsed.y)}` },
          },
        },
      },
    }
  }

  const revenueChart = barChart(
    'Revenue',
    (s) => s.financials.at(-1).revenue,
    (v) => `₹${(v / 1000).toFixed(0)}k Cr`,
  )
  const profitChart = barChart(
    'Net Profit',
    (s) => s.financials.at(-1).profit,
    (v) => `₹${(v / 1000).toFixed(0)}k Cr`,
  )

  const activeTrend = TREND_TABS.find((t) => t.key === trendTab)

  const trendData = {
    labels: stocks[0]?.financials.map((f) => f.period) || [],
    datasets: stocks.map((s) => ({
      label: s.symbol,
      data: s.financials.map((f) => f[trendTab]),
      borderColor: s.color,
      backgroundColor: s.color,
      borderWidth: 2.5,
      pointRadius: 4,
      pointHoverRadius: 6,
      pointBackgroundColor: '#fff',
      pointBorderColor: s.color,
      pointBorderWidth: 2,
      tension: 0.3,
      fill: false,
    })),
  }

  const trendOptions = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    scales: {
      x: { grid: { display: false }, ticks: { color: '#6b7280', font: { size: 11 } } },
      y: {
        grid: { color: '#f1f5f9' },
        ticks: {
          color: '#9ca3af',
          font: { size: 11 },
          callback: (v) =>
            activeTrend.unit === 'Cr'
              ? `₹${(v / 1000).toFixed(0)}k Cr`
              : `₹${v.toLocaleString('en-IN')}`,
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
          label: (ctx) =>
            activeTrend.unit === 'Cr'
              ? `${ctx.dataset.label}: ₹${ctx.parsed.y.toLocaleString('en-IN')} Cr`
              : `${ctx.dataset.label}: ₹${ctx.parsed.y}`,
        },
      },
    },
  }

  // Headline verdicts, each computed from the numbers above.
  const verdicts = [
    { title: 'Cheapest Valuation', row: METRIC_ROWS.find((r) => r.label === 'P/E Ratio') },
    { title: 'Best Returns on Capital', row: METRIC_ROWS.find((r) => r.label === 'ROE') },
    { title: 'Safest Balance Sheet', row: METRIC_ROWS.find((r) => r.label === 'Debt to Equity') },
    { title: 'Highest Dividend', row: METRIC_ROWS.find((r) => r.label === 'Dividend Yield') },
  ]
    .map((v) => {
      const symbol = winnerOf(stocks, v.row)
      const stock = stocks.find((s) => s.symbol === symbol)
      return stock
        ? { ...v, stock, value: v.row.format(v.row.get(stock)) }
        : null
    })
    .filter(Boolean)

  const scoreboard = stocks
    .map((s) => ({
      stock: s,
      wins: METRIC_ROWS.filter((row) => winnerOf(stocks, row) === s.symbol).length,
    }))
    .sort((a, b) => b.wins - a.wins)

  return (
    <div className="flex min-h-screen bg-[#f8f9fb]">
      <Sidebar />

      <div className="flex min-w-0 flex-1 flex-col">

        <main className="flex-1 space-y-5 p-8">
          {/* Heading + picker */}
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Stock Comparison</h1>
            <p className="mt-1 text-sm text-gray-500">
              Put two to four companies side by side and see who wins on each number.
            </p>

            <div className="relative mt-4 flex flex-wrap items-center gap-2">
              {selected.map((symbol, i) => (
                <span
                  key={symbol}
                  className="flex items-center gap-2 rounded-full border border-gray-200 bg-white py-1.5 pr-2 pl-3 text-sm font-semibold text-gray-900"
                >
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: PALETTE[i % PALETTE.length].color }}
                  />
                  {symbol}
                  <button
                    onClick={() => removeStock(symbol)}
                    disabled={selected.length <= 2}
                    className="rounded-full p-0.5 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700 disabled:cursor-not-allowed disabled:opacity-30"
                    aria-label={`Remove ${symbol}`}
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </span>
              ))}

              {selected.length < 4 && (
                <button
                  onClick={() => setShowPicker((v) => !v)}
                  className="flex items-center gap-1.5 rounded-full border border-dashed border-gray-300 px-3 py-1.5 text-sm font-semibold text-gray-500 transition hover:border-blue-400 hover:text-blue-600"
                >
                  <Plus className="h-4 w-4" />
                  Add stock
                </button>
              )}

              {showPicker && (
                <div className="absolute top-11 left-0 z-20 w-72 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-lg">
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

                  <div className="max-h-72 overflow-y-auto">
                    {searching && available.length === 0 ? (
                      <p className="px-4 py-3 text-sm text-gray-500">Searching…</p>
                    ) : available.length === 0 ? (
                      <p className="px-4 py-3 text-sm text-gray-500">
                        No NSE stock matches “{query.trim()}”.
                      </p>
                    ) : (
                      available.map((s) => (
                        <button
                          key={s.symbol}
                          onClick={() => addStock(s.symbol)}
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
                <p className="font-semibold text-gray-900">Could not load the comparison</p>
                <p className="mt-1 text-sm text-gray-600">{error}</p>
              </div>
            </div>
          )}

          {!loading && stocks.length > 0 && (
            <>
          {/* Company cards */}
          <div
            className="grid grid-cols-1 gap-5 sm:grid-cols-2"
            style={{ gridTemplateColumns: `repeat(${Math.min(stocks.length, 4)}, minmax(0, 1fr))` }}
          >
            {stocks.map((s) => {
              const up = s.changePct >= 0
              return (
                <div
                  key={s.symbol}
                  className="rounded-2xl border border-gray-200 bg-white p-5"
                  style={{ borderTopColor: s.color, borderTopWidth: 3 }}
                >
                  <div className="flex items-center gap-2.5">
                    <span
                      className={`flex h-10 w-10 items-center justify-center rounded-xl text-sm font-bold ${s.accent}`}
                    >
                      {s.symbol[0]}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-gray-900">{s.symbol}</p>
                      <p className="truncate text-xs text-gray-500">{s.name}</p>
                    </div>
                  </div>

                  <p className="mt-4 text-xl font-bold text-gray-900">{inr(s.price)}</p>
                  <p
                    className={`flex items-center gap-1 text-sm font-semibold ${
                      up ? 'text-emerald-600' : 'text-red-500'
                    }`}
                  >
                    {up ? (
                      <TrendingUp className="h-3.5 w-3.5" />
                    ) : (
                      <TrendingDown className="h-3.5 w-3.5" />
                    )}
                    {up ? '+' : ''}
                    {s.changePct}%
                  </p>

                  <div className="mt-4 space-y-1.5 border-t border-gray-100 pt-3 text-xs">
                    <div className="flex justify-between">
                      <span className="text-gray-500">Market Cap</span>
                      <span className="font-semibold text-gray-900">{crore(s.marketCap)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">52W Range</span>
                      <span className="font-semibold text-gray-900">
                        {s.low52} – {s.high52}
                      </span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Performance */}
          <Section
            icon={Activity}
            title="Price Performance"
            subtitle="All stocks rebased to 100 so they can be compared fairly"
            right={
              <div className="flex flex-wrap justify-end gap-2">
                {COMPARE_RANGES.map((r) => (
                  <button
                    key={r.label}
                    onClick={() => setRange(r.label)}
                    className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                      range === r.label
                        ? 'bg-gray-900 text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
            }
          >
            <div className="mb-4 flex flex-wrap gap-4">
              {stocks.map((s) => {
                const ret = s.timeframes[range].changePct
                const up = ret >= 0
                return (
                  <div key={s.symbol} className="flex items-center gap-2">
                    <span
                      className="h-0.5 w-5 rounded"
                      style={{ backgroundColor: s.color }}
                    />
                    <span className="text-sm font-semibold text-gray-900">{s.symbol}</span>
                    <span
                      className={`text-sm font-bold ${up ? 'text-emerald-600' : 'text-red-500'}`}
                    >
                      {up ? '+' : ''}
                      {ret}%
                    </span>
                  </div>
                )
              })}
            </div>

            <div className="h-72">
              <Line data={performanceData} options={performanceOptions} />
            </div>

            <p className="mt-3 text-xs text-gray-400">
              Every line starts at 100. A line at 120 means that stock is up 20% over this
              period, whatever its actual share price is.
            </p>
          </Section>

          {/* Head to head table */}
          <Section
            icon={Scale}
            title="Head to Head Metrics"
            subtitle="Green marks the better number in each row"
          >
            <MetricTable stocks={stocks} rows={METRIC_ROWS} />
          </Section>

          {/* Revenue and profit */}
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            <Section
              icon={BarChart3}
              title="Revenue"
              subtitle="Latest financial year (₹ in Crore)"
            >
              <div className="h-64">
                <Bar data={revenueChart.data} options={revenueChart.options} />
              </div>
            </Section>

            <Section
              icon={BarChart3}
              title="Net Profit"
              subtitle="Latest financial year (₹ in Crore)"
            >
              <div className="h-64">
                <Bar data={profitChart.data} options={profitChart.options} />
              </div>
            </Section>
          </div>

          {/* Growth trends */}
          <Section
            icon={TrendingUp}
            title="Financial Growth Comparison"
            subtitle="Five year trend, so you can see who grows consistently and who had one good year"
            right={
              <div className="flex gap-2">
                {TREND_TABS.map((tab) => (
                  <button
                    key={tab.key}
                    onClick={() => setTrendTab(tab.key)}
                    className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                      trendTab === tab.key
                        ? 'bg-gray-900 text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            }
          >
            <div className="mb-4 flex flex-wrap gap-4">
              {stocks.map((s) => {
                const growth = yoy(s, trendTab)
                return (
                  <div key={s.symbol} className="flex items-center gap-2">
                    <span className="h-0.5 w-5 rounded" style={{ backgroundColor: s.color }} />
                    <span className="text-sm font-semibold text-gray-900">{s.symbol}</span>
                    {growth !== null && (
                      <span
                        className={`text-sm font-bold ${
                          growth >= 0 ? 'text-emerald-600' : 'text-red-500'
                        }`}
                      >
                        {growth >= 0 ? '+' : ''}
                        {growth}% YoY
                      </span>
                    )}
                  </div>
                )
              })}
            </div>

            <div className="h-72">
              <Line data={trendData} options={trendOptions} />
            </div>

            <p className="mt-3 text-xs text-gray-400">
              A steadily rising line means growth every year. A line that jumps and falls means
              the company had one strong year rather than steady progress.
            </p>
          </Section>

          {/* Profitability and growth metrics */}
          <Section
            icon={Sparkles}
            title="Profitability & Growth Metrics"
            subtitle="Growth rates and business quality side by side"
          >
            <MetricTable stocks={stocks} rows={GROWTH_ROWS} />
          </Section>

          {/* Analyst view */}
          <Section
            icon={Gauge}
            title="What Analysts Say"
            subtitle="Consensus and target price for each company"
          >
            <div
              className="grid grid-cols-1 gap-5 sm:grid-cols-2"
              style={{
                gridTemplateColumns: `repeat(${Math.min(stocks.length, 4)}, minmax(0, 1fr))`,
              }}
            >
              {stocks.map((s) => {
                const { buy, hold, sell, total, consensus, targetPrice, upside } = s.analystRating
                return (
                  <div key={s.symbol} className="rounded-xl border border-gray-200 p-5">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-bold text-gray-900">{s.symbol}</p>
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-bold ${
                          consensus === 'BUY'
                            ? 'bg-emerald-100 text-emerald-700'
                            : consensus === 'SELL'
                              ? 'bg-red-100 text-red-700'
                              : 'bg-amber-100 text-amber-700'
                        }`}
                      >
                        {consensus}
                      </span>
                    </div>

                    <div className="mt-4 flex h-2.5 w-full overflow-hidden rounded-full bg-gray-100">
                      <div className="bg-emerald-500" style={{ width: `${(buy / total) * 100}%` }} />
                      <div className="bg-amber-500" style={{ width: `${(hold / total) * 100}%` }} />
                      <div className="bg-red-500" style={{ width: `${(sell / total) * 100}%` }} />
                    </div>
                    <p className="mt-2 text-xs text-gray-500">
                      {buy} buy · {hold} hold · {sell} sell
                    </p>

                    <div className="mt-4 border-t border-gray-100 pt-3">
                      <p className="text-xs text-gray-500">Target Price</p>
                      <p className="text-lg font-bold text-gray-900">{inr(targetPrice)}</p>
                      <p
                        className={`text-xs font-semibold ${
                          upside >= 0 ? 'text-emerald-600' : 'text-red-500'
                        }`}
                      >
                        {upside >= 0 ? '+' : ''}
                        {upside}% from current price
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
          </Section>

          {/* Verdict */}
          <Section
            icon={Trophy}
            title="Who Wins What"
            subtitle="Based only on the numbers above, not on opinion"
          >
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {verdicts.map((v) => (
                <div key={v.title} className="rounded-xl border border-gray-200 p-5">
                  <p className="text-xs text-gray-500">{v.title}</p>
                  <p className="mt-2 flex items-center gap-2 text-lg font-bold text-gray-900">
                    <span
                      className="h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: v.stock.color }}
                    />
                    {v.stock.symbol}
                  </p>
                  <p className="mt-0.5 text-sm font-semibold text-emerald-600">{v.value}</p>
                </div>
              ))}
            </div>

            <div className="mt-6 border-t border-gray-100 pt-5">
              <p className="mb-3 text-sm font-semibold text-gray-900">
                Scoreboard — metrics won out of {METRIC_ROWS.filter((r) => r.better).length}
              </p>
              <div className="space-y-3">
                {scoreboard.map(({ stock, wins }) => (
                  <div key={stock.symbol} className="flex items-center gap-3">
                    <span className="w-20 shrink-0 text-sm font-semibold text-gray-900">
                      {stock.symbol}
                    </span>
                    <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-gray-100">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${(wins / METRIC_ROWS.filter((r) => r.better).length) * 100}%`,
                          backgroundColor: stock.color,
                        }}
                      />
                    </div>
                    <span className="w-8 shrink-0 text-right text-sm font-bold text-gray-900">
                      {wins}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </Section>

          {/* Disclaimer */}
          <div className="flex items-start gap-2.5 rounded-2xl border border-gray-200 bg-white p-5 text-sm text-gray-500">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" />
            <p>
              Live market data from Yahoo Finance. Figures reported in another currency are
              converted to rupees at today's rate. This comparison is for learning, not
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
