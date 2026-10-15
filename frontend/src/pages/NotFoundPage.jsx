import { Link } from 'react-router-dom'
import { BarChart3, Compass } from 'lucide-react'

export default function NotFoundPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#f8f9fb] px-6 text-center">
      <div className="flex items-center gap-2">
        <BarChart3 className="h-7 w-7 text-blue-600" strokeWidth={2.5} />
        <span className="text-xl font-bold text-gray-900">FinScope</span>
      </div>

      <span className="mt-10 flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
        <Compass className="h-6 w-6" />
      </span>
      <p className="mt-5 text-5xl font-bold text-gray-900">404</p>
      <h1 className="mt-2 text-lg font-bold text-gray-900">This page does not exist</h1>
      <p className="mt-1 max-w-sm text-sm text-gray-500">
        The link may be mistyped, or the page may have moved.
      </p>

      <Link
        to="/"
        className="mt-6 rounded-xl bg-gray-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-black"
      >
        Back to home
      </Link>
    </div>
  )
}
