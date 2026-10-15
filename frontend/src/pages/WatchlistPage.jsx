import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  AlertCircle,
  ArrowDownRight,
  ArrowUpRight,
  Check,
  Loader2,
  Pencil,
  Plus,
  Search,
  Star,
  Trash2,
  TrendingDown,
  TrendingUp,
  X,
} from 'lucide-react'
import Sidebar from '../components/dashboard/Sidebar'
import {
  addWatchlistStock,
  createWatchlist,
  deleteWatchlist,
  fetchMarketCloses,
  fetchMarketQuotes,
  fetchWatchlists,
  removeWatchlistStock,
  renameWatchlist,
  searchSymbols,
} from '../lib/api'

const QUOTE_REFRESH_MS = 30000

function inr(value, digits = 2) {
  if (value === null || value === undefined) return '—'
  return `₹${Number(value).toLocaleString('en-IN', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })}`
}

function pct(value) {
  return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`
}

function Sparkline({ values, up }) {
  if (!values || values.length < 2) return <span className="inline-block h-7 w-24" />

  const min = Math.min(...values)
  const max = Math.max(...values)
  const span = max - min || 1
  const points = values
    .map((v, i) => `${(i / (values.length - 1)) * 90},${26 - ((v - min) / span) * 24}`)
    .join(' ')

  return (
    <svg viewBox="0 0 90 28" className="h-7 w-24" preserveAspectRatio="none">
      <polyline
        points={points}
        fill="none"
        stroke={up ? '#10b981' : '#ef4444'}
        strokeWidth="1.5"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  )
}

const inputClass =
  'w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 focus:outline-none'

export default function WatchlistPage() {
  const [data, setData] = useState(null)
  const [activeId, setActiveId] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [flash, setFlash] = useState(null)

  const [quotes, setQuotes] = useState({})
  const [closes, setCloses] = useState(null)

  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [renaming, setRenaming] = useState(false)
  const [editName, setEditName] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)

  const [showAdd, setShowAdd] = useState(false)
  const [addQuery, setAddQuery] = useState('')
  const [addResults, setAddResults] = useState([])

  const lists = data?.lists || []
  const active = lists.find((l) => l.id === activeId) || lists[0] || null

  const apply = useCallback(
    (next, keepId) => {
      setData(next)
      const stillThere = next.lists.some((l) => l.id === (keepId ?? activeId))
      if (!stillThere) setActiveId(next.lists[0]?.id ?? null)
      else if (keepId) setActiveId(keepId)
    },
    [activeId],
  )

  useEffect(() => {
    let cancelled = false
    fetchWatchlists()
      .then((payload) => {
        if (cancelled) return
        setData(payload)
        setActiveId(payload.lists[0]?.id ?? null)
      })
      .catch((err) => {
        if (!cancelled) setError(err?.errors?.form || 'Could not load your watchlists.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!flash) return
    const timer = setTimeout(() => setFlash(null), 4000)
    return () => clearTimeout(timer)
  }, [flash])

  useEffect(() => {
    if (!confirmDelete) return
    const timer = setTimeout(() => setConfirmDelete(false), 5000)
    return () => clearTimeout(timer)
  }, [confirmDelete])

  const symbolKey = (active?.stocks || []).join(',')

  const refreshQuotes = useCallback(() => {
    if (!symbolKey) return
    fetchMarketQuotes(symbolKey.split(','))
      .then((payload) => {
        setQuotes((prev) => {
          const next = { ...prev }
          for (const q of payload.quotes || []) next[q.symbol] = q
          return next
        })
      })
      .catch(() => {
        /* keep whatever price is already on screen */
      })
  }, [symbolKey])

  useEffect(() => {
    refreshQuotes()
    const timer = setInterval(refreshQuotes, QUOTE_REFRESH_MS)
    return () => clearInterval(timer)
  }, [refreshQuotes])

  useEffect(() => {
    if (!symbolKey) {
      setCloses(null)
      return
    }

    let cancelled = false
    fetchMarketCloses(symbolKey.split(','), '1MO')
      .then((payload) => {
        if (!cancelled) setCloses(payload)
      })
      .catch(() => {
        if (!cancelled) setCloses(null)
      })

    return () => {
      cancelled = true
    }
  }, [symbolKey])

  useEffect(() => {
    if (!showAdd) return
    let cancelled = false
    const timer = setTimeout(() => {
      searchSymbols(addQuery)
        .then((payload) => {
          if (!cancelled) setAddResults(payload.results || [])
        })
        .catch(() => {
          if (!cancelled) setAddResults([])
        })
    }, 250)

    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [addQuery, showAdd])

  const rows = (active?.stocks || []).map((symbol) => {
    const quote = quotes[symbol]
    const series = (closes?.closes?.[symbol] || []).filter((v) => v !== null)
    return {
      symbol,
      name: quote?.name || symbol,
      price: quote?.price ?? null,
      change: quote?.change ?? null,
      changePct: quote?.changePct ?? null,
      spark: series,
    }
  })

  const priced = rows.filter((r) => r.changePct !== null)
  const gainers = priced.filter((r) => r.changePct > 0)
  const losers = priced.filter((r) => r.changePct < 0)
  const best = useMemo(
    () =>
      priced.length
        ? priced.reduce((top, r) => (r.changePct > top.changePct ? r : top))
        : null,
    [priced],
  )

  async function handleCreate() {
    const name = newName.trim()
    if (!name) return

    try {
      const next = await createWatchlist(name)
      const added = next.lists[next.lists.length - 1]
      apply(next, added.id)
      setNewName('')
      setCreating(false)
      setFlash({ tone: 'ok', text: `"${added.name}" created` })
    } catch (err) {
      setFlash({ tone: 'error', text: err?.errors?.name || err?.errors?.form || 'Could not create that list.' })
    }
  }

  async function handleRename() {
    const name = editName.trim()
    if (!name || !active) return

    try {
      apply(await renameWatchlist(active.id, name), active.id)
      setRenaming(false)
    } catch (err) {
      setFlash({ tone: 'error', text: err?.errors?.name || err?.errors?.form || 'Could not rename.' })
    }
  }

  async function handleDelete() {
    if (!active) return
    if (!confirmDelete) {
      setConfirmDelete(true)
      return
    }

    setConfirmDelete(false)
    try {
      const name = active.name
      apply(await deleteWatchlist(active.id))
      setFlash({ tone: 'ok', text: `"${name}" deleted` })
    } catch (err) {
      setFlash({ tone: 'error', text: err?.errors?.form || 'Could not delete that list.' })
    }
  }

  async function handleAdd(symbol, name) {
    if (!active) return
    try {
      apply(await addWatchlistStock(active.id, symbol), active.id)
      setFlash({ tone: 'ok', text: `${name || symbol} added to ${active.name}` })
      setAddQuery('')
      setShowAdd(false)
    } catch (err) {
      setFlash({ tone: 'error', text: err?.errors?.form || 'Could not add that stock.' })
    }
  }

  async function handleRemove(symbol) {
    if (!active) return
    try {
      apply(await removeWatchlistStock(active.id, symbol), active.id)
    } catch (err) {
      setFlash({ tone: 'error', text: err?.errors?.form || 'Could not remove that stock.' })
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen bg-[#f8f9fb]">
        <Sidebar />
        <div className="flex flex-1 flex-col items-center justify-center">
          <Loader2 className="h-7 w-7 animate-spin text-blue-600" />
          <p className="mt-3 text-sm text-gray-500">Loading your watchlists…</p>
        </div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="flex min-h-screen bg-[#f8f9fb]">
        <Sidebar />
        <main className="flex-1 p-8">
          <div className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50/50 p-6">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-500" />
            <div>
              <p className="font-semibold text-gray-900">Could not open your watchlists</p>
              <p className="mt-1 text-sm text-gray-600">{error}</p>
            </div>
          </div>
        </main>
      </div>
    )
  }

  const full = active && active.stocks.length >= data.maxSymbols

  const stats = [
    { label: 'Stocks tracked', value: `${rows.length}`, sub: `of ${data.maxSymbols} allowed`, tone: 'text-gray-900' },
    { label: 'Up today', value: `${gainers.length}`, sub: 'since yesterday close', tone: 'text-emerald-600' },
    { label: 'Down today', value: `${losers.length}`, sub: 'since yesterday close', tone: 'text-red-500' },
    {
      label: 'Best today',
      value: best ? best.symbol : '—',
      sub: best ? pct(best.changePct) : 'waiting for prices',
      tone: best && best.changePct >= 0 ? 'text-emerald-600' : 'text-gray-900',
    },
  ]

  return (
    <div className="flex min-h-screen bg-[#f8f9fb]">
      <Sidebar />

      <div className="flex min-w-0 flex-1 flex-col">
        <main className="flex-1 space-y-5 p-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Watchlist</h1>
            <p className="mt-1 text-sm text-gray-500">
              Keep an eye on the stocks you care about — up to {data.maxLists} lists, {data.maxSymbols}{' '}
              stocks in each.
            </p>
          </div>

          {flash && (
            <div
              className={`flex items-center gap-2.5 rounded-2xl border px-5 py-3.5 text-sm font-medium ${
                flash.tone === 'error'
                  ? 'border-red-200 bg-red-50/70 text-red-700'
                  : 'border-emerald-200 bg-emerald-50/70 text-emerald-800'
              }`}
            >
              {flash.tone === 'error' ? (
                <AlertCircle className="h-4 w-4 shrink-0" />
              ) : (
                <Check className="h-4 w-4 shrink-0" />
              )}
              {flash.text}
            </div>
          )}

          {/* List tabs */}
          <div className="flex flex-wrap items-center gap-2">
            {lists.map((list) => (
              <button
                key={list.id}
                onClick={() => {
                  setActiveId(list.id)
                  setRenaming(false)
                  setConfirmDelete(false)
                  setShowAdd(false)
                }}
                className={`flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold transition ${
                  active?.id === list.id
                    ? 'border-blue-500 bg-blue-50/60 text-blue-700 ring-1 ring-blue-500'
                    : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:text-gray-900'
                }`}
              >
                <Star
                  className={`h-3.5 w-3.5 ${
                    active?.id === list.id ? 'fill-amber-400 text-amber-400' : 'text-gray-300'
                  }`}
                />
                {list.name}
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                    active?.id === list.id ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'
                  }`}
                >
                  {list.stocks.length}
                </span>
              </button>
            ))}

            {creating ? (
              <div className="flex items-center gap-1.5 rounded-xl border border-blue-500 bg-white px-2 py-1.5 ring-1 ring-blue-500">
                <input
                  autoFocus
                  value={newName}
                  maxLength={30}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleCreate()
                    if (e.key === 'Escape') setCreating(false)
                  }}
                  placeholder="List name"
                  className="w-36 px-1.5 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none"
                />
                <button
                  onClick={handleCreate}
                  className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-600 text-white transition hover:bg-blue-700"
                  aria-label="Create list"
                >
                  <Check className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => {
                    setCreating(false)
                    setNewName('')
                  }}
                  className="flex h-7 w-7 items-center justify-center rounded-lg text-gray-400 transition hover:bg-gray-100"
                  aria-label="Cancel"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : (
              lists.length < data.maxLists && (
                <button
                  onClick={() => setCreating(true)}
                  className="flex items-center gap-1.5 rounded-xl border border-dashed border-gray-300 px-4 py-2.5 text-sm font-semibold text-gray-500 transition hover:border-gray-400 hover:text-gray-700"
                >
                  <Plus className="h-4 w-4" />
                  New watchlist
                </button>
              )
            )}

            {lists.length >= data.maxLists && (
              <span className="text-xs text-gray-400">
                All {data.maxLists} watchlists in use
              </span>
            )}
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {stats.map((s) => (
              <div key={s.label} className="rounded-2xl border border-gray-200 bg-white p-5">
                <p className="text-xs text-gray-500">{s.label}</p>
                <p className={`mt-1.5 text-xl font-bold ${s.tone}`}>{s.value}</p>
                <p className="mt-0.5 text-xs text-gray-400">{s.sub}</p>
              </div>
            ))}
          </div>

          {/* The list itself */}
          <section className="rounded-2xl border border-gray-200 bg-white p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
                  <Star className="h-4 w-4" />
                </span>
                <div>
                  {renaming ? (
                    <div className="flex items-center gap-1.5">
                      <input
                        autoFocus
                        value={editName}
                        maxLength={30}
                        onChange={(e) => setEditName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleRename()
                          if (e.key === 'Escape') setRenaming(false)
                        }}
                        className="w-48 rounded-lg border border-blue-500 px-2 py-1 text-base font-bold text-gray-900 focus:outline-none"
                      />
                      <button
                        onClick={handleRename}
                        className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-600 text-white transition hover:bg-blue-700"
                        aria-label="Save name"
                      >
                        <Check className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => setRenaming(false)}
                        className="flex h-7 w-7 items-center justify-center rounded-lg text-gray-400 transition hover:bg-gray-100"
                        aria-label="Cancel"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ) : (
                    <h2 className="text-base font-bold text-gray-900">{active?.name}</h2>
                  )}
                  <p className="mt-0.5 text-sm text-gray-500">
                    {rows.length} {rows.length === 1 ? 'stock' : 'stocks'} · prices refresh every 30
                    seconds
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {!renaming && active && (
                  <button
                    onClick={() => {
                      setEditName(active.name)
                      setRenaming(true)
                    }}
                    className="flex h-9 w-9 items-center justify-center rounded-xl border border-gray-200 text-gray-500 transition hover:border-gray-300 hover:bg-gray-50"
                    aria-label="Rename list"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                )}
                {lists.length > 1 && (
                  <button
                    onClick={handleDelete}
                    className={`flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold transition ${
                      confirmDelete
                        ? 'border-red-200 bg-red-50 text-red-600 hover:bg-red-100'
                        : 'border-gray-200 text-gray-500 hover:border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    <Trash2 className="h-4 w-4" />
                    {confirmDelete && 'Tap again to delete'}
                  </button>
                )}
                <button
                  onClick={() => setShowAdd((v) => !v)}
                  disabled={full}
                  className="flex items-center gap-1.5 rounded-xl bg-gray-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-black disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-gray-400"
                >
                  {showAdd ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                  {full ? 'List full' : 'Add stock'}
                </button>
              </div>
            </div>

            {showAdd && !full && (
              <div className="relative mt-5">
                <div className="overflow-hidden rounded-xl border border-gray-200">
                  <div className="relative border-b border-gray-100">
                    <Search className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-gray-400" />
                    <input
                      autoFocus
                      value={addQuery}
                      onChange={(e) => setAddQuery(e.target.value)}
                      placeholder="Search any NSE stock"
                      className="w-full py-3 pr-4 pl-10 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none"
                    />
                  </div>
                  <div className="max-h-64 overflow-y-auto">
                    {addResults.length === 0 ? (
                      <p className="px-4 py-3 text-sm text-gray-500">No match found.</p>
                    ) : (
                      addResults.map((s) => {
                        const already = active?.stocks.includes(s.symbol)
                        return (
                          <button
                            key={s.symbol}
                            disabled={already}
                            onClick={() => handleAdd(s.symbol, s.name)}
                            className="flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:bg-gray-50"
                          >
                            <span className="shrink-0 text-sm font-semibold text-gray-900">
                              {s.symbol}
                            </span>
                            <span className="truncate text-xs text-gray-500">{s.name}</span>
                            {already && (
                              <span className="shrink-0 text-[10px] font-bold text-emerald-600">
                                ADDED
                              </span>
                            )}
                          </button>
                        )
                      })
                    )}
                  </div>
                </div>
              </div>
            )}

            <div className="mt-5">
              {rows.length === 0 ? (
                <div className="rounded-xl bg-gray-50 p-8 text-center">
                  <p className="text-sm font-medium text-gray-700">This list is empty</p>
                  <p className="mt-1 text-sm text-gray-500">
                    Use "Add stock" to put your first company on {active?.name}.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[760px] text-left">
                    <thead>
                      <tr className="border-b border-gray-200">
                        {['Stock', 'LTP', 'Change', '% Change', '1 Month', ''].map((h) => (
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
                      {rows.map((r) => {
                        const up = (r.changePct ?? 0) >= 0
                        return (
                          <tr key={r.symbol} className="group border-b border-gray-100 last:border-0">
                            <td className="py-3.5">
                              <p className="text-sm font-bold text-gray-900">{r.symbol}</p>
                              <p className="truncate text-xs text-gray-500">{r.name}</p>
                            </td>
                            <td className="py-3.5 text-sm font-semibold text-gray-900">
                              {r.price === null ? '—' : inr(r.price)}
                            </td>
                            <td
                              className={`py-3.5 text-sm font-medium ${
                                r.change === null
                                  ? 'text-gray-400'
                                  : up
                                    ? 'text-emerald-600'
                                    : 'text-red-500'
                              }`}
                            >
                              {r.change === null
                                ? '—'
                                : `${up ? '+' : '−'}${inr(Math.abs(r.change))}`}
                            </td>
                            <td className="py-3.5">
                              {r.changePct === null ? (
                                <span className="text-sm text-gray-400">—</span>
                              ) : (
                                <span
                                  className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold ${
                                    up
                                      ? 'bg-emerald-50 text-emerald-700'
                                      : 'bg-red-50 text-red-600'
                                  }`}
                                >
                                  {up ? (
                                    <ArrowUpRight className="h-3 w-3" />
                                  ) : (
                                    <ArrowDownRight className="h-3 w-3" />
                                  )}
                                  {pct(r.changePct)}
                                </span>
                              )}
                            </td>
                            <td className="py-3.5">
                              <Sparkline values={r.spark} up={up} />
                            </td>
                            <td className="py-3.5">
                              <div className="flex items-center justify-end gap-2">
                                <Link
                                  to={`/paper-trading?symbol=${r.symbol}`}
                                  className="rounded-lg bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700 transition hover:bg-emerald-100"
                                >
                                  Trade
                                </Link>
                                <button
                                  onClick={() => handleRemove(r.symbol)}
                                  className="flex h-7 w-7 items-center justify-center rounded-lg text-gray-300 transition hover:bg-gray-100 hover:text-gray-600"
                                  aria-label={`Remove ${r.symbol}`}
                                >
                                  <X className="h-4 w-4" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </section>

          {/* Movers */}
          {priced.length > 1 && (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {[
                { title: 'Gaining today', rows: gainers, icon: TrendingUp, tone: 'emerald' },
                { title: 'Falling today', rows: losers, icon: TrendingDown, tone: 'red' },
              ].map(({ title, rows: group, icon: Icon, tone }) => (
                <section key={title} className="rounded-2xl border border-gray-200 bg-white p-6">
                  <div className="flex items-center gap-3">
                    <span
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                        tone === 'emerald'
                          ? 'bg-emerald-50 text-emerald-600'
                          : 'bg-red-50 text-red-500'
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                    </span>
                    <h2 className="text-base font-bold text-gray-900">{title}</h2>
                  </div>

                  <div className="mt-4 space-y-1">
                    {group.length === 0 ? (
                      <p className="rounded-xl bg-gray-50 p-4 text-sm text-gray-500">
                        Nothing here right now.
                      </p>
                    ) : (
                      [...group]
                        .sort((a, b) =>
                          tone === 'emerald' ? b.changePct - a.changePct : a.changePct - b.changePct,
                        )
                        .slice(0, 5)
                        .map((r) => (
                          <div
                            key={r.symbol}
                            className="flex items-center gap-3 rounded-xl px-2 py-2 transition hover:bg-gray-50"
                          >
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-bold text-gray-900">{r.symbol}</p>
                              <p className="truncate text-xs text-gray-500">{r.name}</p>
                            </div>
                            <span className="shrink-0 text-sm font-semibold text-gray-900">
                              {inr(r.price)}
                            </span>
                            <span
                              className={`w-20 shrink-0 text-right text-sm font-bold ${
                                r.changePct >= 0 ? 'text-emerald-600' : 'text-red-500'
                              }`}
                            >
                              {pct(r.changePct)}
                            </span>
                          </div>
                        ))
                    )}
                  </div>
                </section>
              ))}
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
