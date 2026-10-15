import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import {
  ArrowLeftRight,
  BarChart3,
  ChevronRight,
  Eye,
  EyeOff,
  History,
  Home,
  LayoutGrid,
  LineChart,
  Star,
  TrendingDown,
  TrendingUp,
  Wallet,
} from 'lucide-react'
import { getSession } from '../../lib/auth'
import { fetchPaperSummary } from '../../lib/api'

const modules = [
  { icon: Home, label: 'Welcome / Home', to: '/' },
  { icon: LayoutGrid, label: 'Dashboard', to: '/dashboard' },
  { icon: Star, label: 'Watchlist', to: '/watchlist' },
  { icon: LineChart, label: 'Stock Analyser', to: '/stock-analyser' },
  { icon: ArrowLeftRight, label: 'Stock Comparison', to: '/stock-comparison' },
  { icon: History, label: 'Strategy Backtester', to: '/backtester' },
  { icon: Wallet, label: 'Paper Trading', to: '/paper-trading', badge: '₹10L' },
]

function inr(value) {
  return `₹${Number(value).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`
}

export default function Sidebar() {
  const [visible, setVisible] = useState(true)
  const [user, setUser] = useState(null)
  const [summary, setSummary] = useState(null)
  const { pathname } = useLocation()

  useEffect(() => {
    const session = getSession()
    if (session) setUser(session.user)
  }, [])

  // The card shows the real paper trading wallet, so it has to be re-read when
  // the page changes — an order placed on another screen moves this number.
  useEffect(() => {
    let cancelled = false
    fetchPaperSummary()
      .then((data) => {
        if (!cancelled) setSummary(data.summary)
      })
      .catch(() => {
        if (!cancelled) setSummary(null)
      })

    return () => {
      cancelled = true
    }
  }, [pathname])

  const up = (summary?.totalPnl ?? 0) >= 0

  return (
    <aside className="sticky top-0 flex h-screen w-64 shrink-0 flex-col border-r border-gray-200 bg-white px-4 py-6">
      <div className="mb-6 flex items-center gap-2 px-2">
        <BarChart3 className="h-6 w-6 text-blue-600" strokeWidth={2.5} />
        <span className="text-lg font-bold text-gray-900">FinScope</span>
      </div>

      <div className="relative mb-6 overflow-hidden rounded-2xl bg-gray-900 p-5 text-white">
        <div className="absolute -top-8 -right-8 h-28 w-28 rounded-full border border-white/10" />
        <div className="absolute -top-2 -right-2 h-20 w-20 rounded-full border border-white/10" />
        <div className="relative flex items-center justify-between">
          <p className="text-xs text-gray-400">Portfolio Value</p>
          <button
            onClick={() => setVisible((v) => !v)}
            className="text-gray-400 hover:text-white"
            aria-label="Toggle visibility"
          >
            {visible ? (
              <Eye className="h-4 w-4" />
            ) : (
              <EyeOff className="h-4 w-4" />
            )}
          </button>
        </div>
        <p className="relative mt-2 text-2xl font-bold">
          {!summary ? '—' : visible ? inr(summary.portfolio) : '••••••'}
        </p>
        {summary && (
          <span
            className={`relative mt-3 inline-flex items-center gap-1 rounded-full bg-white/10 px-2.5 py-1 text-xs font-semibold ${
              up ? 'text-emerald-400' : 'text-red-400'
            }`}
          >
            {up ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
            {up ? '+' : ''}
            {summary.totalPnlPct.toFixed(2)}%
          </span>
        )}
        <p className="relative mt-2 text-[11px] text-gray-500">
          {summary
            ? `Paper wallet · ${summary.positions} ${
                summary.positions === 1 ? 'holding' : 'holdings'
              }`
            : 'Paper wallet'}
        </p>
      </div>

      <p className="mb-2 px-2 text-xs font-semibold tracking-wider text-gray-400 uppercase">
        Core Modules
      </p>

      <nav className="flex flex-1 flex-col gap-1 overflow-y-auto">
        {modules.map(({ icon: Icon, label, to, badge }) => (
          <Link
            key={label}
            to={to}
            className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
              pathname === to
                ? 'bg-blue-50 text-blue-700'
                : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
            }`}
          >
            <Icon className="h-[18px] w-[18px]" strokeWidth={2} />
            <span className="flex-1">{label}</span>
            {badge && (
              <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-bold text-gray-600">
                {badge}
              </span>
            )}
          </Link>
        ))}
      </nav>

      <Link
        to="/profile"
        className={`mt-4 flex items-center gap-3 rounded-xl border p-3 transition ${
          pathname === '/profile'
            ? 'border-blue-200 bg-blue-50'
            : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
        }`}
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-100 text-sm font-bold text-blue-700">
          {user?.name?.[0]?.toUpperCase() || 'U'}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold text-gray-900">
            {user?.name || 'My Account'}
          </span>
          <span className="block truncate text-xs text-gray-500">{user?.email || ''}</span>
        </span>
        <ChevronRight className="h-4 w-4 shrink-0 text-gray-400" />
      </Link>
    </aside>
  )
}
