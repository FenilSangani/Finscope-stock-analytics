import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertCircle, AlertTriangle, CalendarDays, Hash, Loader2, LogOut, Mail, Trash2, User } from 'lucide-react'
import Sidebar from '../components/dashboard/Sidebar'
import { clearSession, getSession } from '../lib/auth'
import { deleteAccount, fetchAccount } from '../lib/api'

function Row({ icon: Icon, label, value }) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-gray-200 p-4">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0">
        <p className="text-xs text-gray-500">{label}</p>
        <p className="mt-0.5 text-sm font-semibold break-all text-gray-900">{value || '—'}</p>
      </div>
    </div>
  )
}

export default function ProfilePage() {
  const navigate = useNavigate()
  const [account, setAccount] = useState(getSession()?.user || null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [confirming, setConfirming] = useState(false)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    fetchAccount()
      .then((data) => setAccount(data.user))
      .catch((err) => setError(err?.errors?.form || 'Could not load your account.'))
      .finally(() => setLoading(false))
  }, [])

  function handleLogout() {
    clearSession()
    navigate('/')
  }

  async function handleDelete() {
    setDeleting(true)
    setError(null)
    try {
      await deleteAccount()
      clearSession()
      navigate('/')
    } catch (err) {
      setError(err?.errors?.form || 'Could not delete your account. Please try again.')
      setDeleting(false)
    }
  }

  const joined = account?.createdAt
    ? new Date(account.createdAt).toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : null

  return (
    <div className="flex min-h-screen bg-[#f8f9fb]">
      <Sidebar />

      <div className="flex min-w-0 flex-1 flex-col">
        <main className="flex-1 p-8">
          <div className="mx-auto max-w-2xl space-y-5">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Profile</h1>
              <p className="mt-1 text-sm text-gray-500">
                Your account details and settings.
              </p>
            </div>

            {error && (
              <div className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50/50 p-4">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
                <p className="text-sm text-gray-700">{error}</p>
              </div>
            )}

            {/* Identity card */}
            <section className="rounded-2xl border border-gray-200 bg-white p-6">
              <div className="flex items-center gap-4">
                <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-100 text-2xl font-bold text-blue-700">
                  {account?.name?.[0]?.toUpperCase() || 'U'}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-xl font-bold text-gray-900">
                    {account?.name || 'Loading…'}
                  </p>
                  <p className="truncate text-sm text-gray-500">{account?.email}</p>
                </div>
                {loading && <Loader2 className="ml-auto h-4 w-4 animate-spin text-gray-400" />}
              </div>
            </section>

            {/* Account details */}
            <section className="rounded-2xl border border-gray-200 bg-white p-6">
              <h2 className="text-base font-bold text-gray-900">Account Details</h2>
              <div className="mt-4 space-y-3">
                <Row icon={User} label="Username" value={account?.name} />
                <Row icon={Mail} label="Email Address" value={account?.email} />
                <Row icon={Hash} label="Account ID" value={account?.id} />
                {joined && <Row icon={CalendarDays} label="Member Since" value={joined} />}
              </div>
            </section>

            {/* Session */}
            <section className="rounded-2xl border border-gray-200 bg-white p-6">
              <h2 className="text-base font-bold text-gray-900">Session</h2>
              <p className="mt-1 text-sm text-gray-500">
                Logging out takes you back to the welcome page.
              </p>
              <button
                onClick={handleLogout}
                className="mt-4 flex items-center gap-2 rounded-xl bg-gray-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-black"
              >
                <LogOut className="h-4 w-4" />
                Log Out
              </button>
            </section>

            {/* Danger zone */}
            <section className="rounded-2xl border border-red-200 bg-red-50/40 p-6">
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-red-100 text-red-700">
                  <AlertTriangle className="h-4 w-4" />
                </span>
                <h2 className="text-base font-bold text-gray-900">Delete Account</h2>
              </div>
              <p className="mt-3 text-sm text-gray-600">
                This removes your account and everything saved with it. It cannot be undone.
              </p>

              {confirming ? (
                <div className="mt-4 rounded-xl border border-red-200 bg-white p-4">
                  <p className="text-sm font-semibold text-gray-900">
                    Delete this account permanently?
                  </p>
                  <div className="mt-4 flex gap-3">
                    <button
                      onClick={handleDelete}
                      disabled={deleting}
                      className="flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-60"
                    >
                      {deleting ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                      Yes, delete it
                    </button>
                    <button
                      onClick={() => setConfirming(false)}
                      disabled={deleting}
                      className="rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setConfirming(true)}
                  className="mt-4 flex items-center gap-2 rounded-xl border border-red-300 bg-white px-5 py-2.5 text-sm font-semibold text-red-600 transition hover:bg-red-50"
                >
                  <Trash2 className="h-4 w-4" />
                  Delete Account
                </button>
              )}
            </section>
          </div>
        </main>
      </div>
    </div>
  )
}
