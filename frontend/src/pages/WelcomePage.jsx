import { useEffect, useState } from 'react'
import {
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  GitCompare,
  LayoutGrid,
  LineChart,
  LogOut,
  Search,
  Star,
  TrendingDown,
  TrendingUp,
  Wallet,
} from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import Footer from '../components/Footer'
import { clearSession, getSession } from '../lib/auth'
import { fetchMarketQuotes } from '../lib/api'

const MARKET_SYMBOLS = ['RELIANCE', 'TCS', 'HDFCBANK', 'INFY']

const coreModules = [
  {
    icon: LayoutGrid,
    title: 'Dashboard',
    description: 'Your portfolio at a glance',
    to: '/dashboard',
  },
  {
    icon: Star,
    title: 'Watchlist',
    description: 'Track the stocks you follow',
    to: '/watchlist',
  },
  {
    icon: Search,
    title: 'Stock Analyser',
    description: 'Fundamentals & technicals',
    to: '/stock-analyser',
  },
  {
    icon: GitCompare,
    title: 'Comparison',
    description: 'Compare companies',
    to: '/stock-comparison',
  },
  {
    icon: LineChart,
    title: 'Backtester',
    description: 'Test historical strategies',
    to: '/backtester',
  },
  {
    icon: Wallet,
    title: 'Paper Trading',
    description: 'Trade with virtual money',
    to: '/paper-trading',
  },
]

const navLinks = [
  { label: 'Dashboard', to: '/dashboard' },
  { label: 'Watchlist', to: '/watchlist' },
  { label: 'Stock Analyser', to: '/stock-analyser' },
  { label: 'Comparison', to: '/stock-comparison' },
  { label: 'Backtester', to: '/backtester' },
  { label: 'Paper Trading', to: '/paper-trading' },
]

export default function WelcomePage() {
  const navigate = useNavigate()
  const [session, setSession] = useState(null)

  const [quotes, setQuotes] = useState([])
  const [quotesError, setQuotesError] = useState(null)

  useEffect(() => {
    setSession(getSession())
  }, [])

  useEffect(() => {
    let cancelled = false
    fetchMarketQuotes(MARKET_SYMBOLS)
      .then((data) => {
        if (!cancelled) setQuotes(data.quotes || [])
      })
      .catch(() => {
        if (!cancelled) setQuotesError('Live prices are unavailable right now.')
      })

    return () => {
      cancelled = true
    }
  }, [])

  function handleLogout() {
    clearSession()
    setSession(null)
    navigate('/')
  }

  return (
    <div className="min-h-screen bg-[#f8f9fb]">
      {/* Navbar */}
      <header className="flex items-center justify-between border-b border-gray-200 bg-white px-6 py-4 sm:px-10">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-7 w-7 text-blue-600" strokeWidth={2.5} />
          <span className="text-xl font-bold text-gray-900">FinScope</span>
        </div>

        <nav className="hidden items-center gap-7 lg:flex">
          {navLinks.map(({ label, to }) => (
            <Link
              key={label}
              to={session ? to : '/auth'}
              className="text-sm font-medium text-gray-600 transition hover:text-gray-900"
            >
              {label}
            </Link>
          ))}
        </nav>

        {session ? (
          <div className="flex items-center gap-4">
            <span className="text-sm font-medium text-gray-700">
              Hi, {session.user.name.split(' ')[0]}
            </span>
            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 rounded-full border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-600 transition hover:border-gray-300 hover:text-gray-900"
            >
              <LogOut className="h-4 w-4" />
              Logout
            </button>
          </div>
        ) : (
          <Link
            to="/auth"
            className="flex items-center gap-2 rounded-full bg-gray-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-black"
          >
            Get Started
            <ArrowRight className="h-4 w-4" />
          </Link>
        )}
      </header>

      {/* Hero */}
      <main className="mx-auto max-w-5xl px-6 pt-20 text-center sm:px-10">
        <h1 className="text-5xl font-extrabold tracking-tight text-gray-900 sm:text-6xl">
          From Market Data to
          <br />
          <span className="text-blue-600">Smarter Decisions.</span>
        </h1>

        <p className="mx-auto mt-6 max-w-2xl text-lg text-gray-500">
          Research NSE stocks with 5-year fundamentals, compare companies
          side-by-side, test Moving Average &amp; RSI strategies on historical
          data, track your own watchlists, and practice trading with a
          ₹10,00,000 virtual balance.
        </p>

        <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
          <Link
            to={session ? '/dashboard' : '/auth'}
            className="flex items-center gap-2 rounded-xl bg-gray-900 px-6 py-3.5 font-semibold text-white transition hover:bg-black"
          >
            Open Dashboard
            <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            to={session ? '/stock-analyser' : '/auth'}
            className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-6 py-3.5 font-semibold text-gray-900 shadow-sm transition hover:bg-gray-50"
          >
            <BarChart3 className="h-4 w-4 text-blue-600" />
            Explore Stock Analyser
          </Link>
        </div>

        {/* Core modules */}
        <div className="mt-16 grid grid-cols-1 gap-5 text-left sm:grid-cols-2 lg:grid-cols-3">
          {coreModules.map(({ icon: Icon, title, description, to }) => (
            <Link
              key={title}
              to={session ? to : '/auth'}
              className="block rounded-2xl border border-gray-200 bg-white p-6 transition hover:-translate-y-0.5 hover:border-gray-300 hover:shadow-md"
            >
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                <Icon className="h-5 w-5" strokeWidth={2.2} />
              </span>
              <p className="mt-4 text-lg font-bold text-gray-900">{title}</p>
              <p className="mt-1 text-sm text-gray-500">{description}</p>
            </Link>
          ))}
        </div>

        {/* Live market */}
        <div className="mx-auto mt-16 mb-24 rounded-2xl border border-gray-100 bg-white p-8 text-left shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-gray-900">Live Market</h2>
              <p className="mt-1 text-sm text-gray-500">
                Real NSE prices, updated every time you open this page
              </p>
            </div>
            <Link
              to={session ? '/stock-analyser' : '/auth'}
              className="flex items-center gap-1 text-sm font-semibold text-blue-600 hover:text-blue-700"
            >
              Open Stock Analyser
              <ArrowUpRight className="h-4 w-4" />
            </Link>
          </div>

          {quotesError ? (
            <p className="mt-7 rounded-xl bg-gray-50 p-5 text-sm text-gray-500">{quotesError}</p>
          ) : quotes.length === 0 ? (
            <div className="mt-7 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {MARKET_SYMBOLS.map((s) => (
                <div
                  key={s}
                  className="h-28 animate-pulse rounded-xl border border-gray-200 bg-gray-50"
                />
              ))}
            </div>
          ) : (
            <div className="mt-7 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {quotes.map((q) => {
                const up = q.changePct >= 0
                return (
                  <Link
                    key={q.symbol}
                    to={session ? '/stock-analyser' : '/auth'}
                    className="rounded-xl border border-gray-200 p-6 transition hover:border-gray-300 hover:shadow-md"
                  >
                    <p className="text-sm font-semibold text-gray-900">{q.symbol}</p>
                    <p className="truncate text-xs text-gray-500">{q.name}</p>
                    <p className="mt-3 text-xl font-bold text-gray-900">
                      ₹{q.price.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </p>
                    <p
                      className={`mt-1 flex items-center gap-1 text-xs font-semibold ${
                        up ? 'text-emerald-600' : 'text-red-500'
                      }`}
                    >
                      {up ? (
                        <TrendingUp className="h-3 w-3" />
                      ) : (
                        <TrendingDown className="h-3 w-3" />
                      )}
                      {up ? '+' : '−'}₹
                      {Math.abs(q.change).toLocaleString('en-IN', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}{' '}
                      ({up ? '+' : ''}
                      {q.changePct.toFixed(2)}%)
                    </p>
                  </Link>
                )
              })}
            </div>
          )}
        </div>
      </main>

      <Footer />
    </div>
  )
}
