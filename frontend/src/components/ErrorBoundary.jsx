import { Component } from 'react'
import { AlertTriangle } from 'lucide-react'

/**
 * Last line of defence. If any page throws while rendering, React would
 * otherwise unmount the whole tree and leave a blank white screen; this catches
 * it and shows something the person can act on instead.
 */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { failed: false }
  }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch(error, info) {
    console.error('Render failed:', error, info)
  }

  render() {
    if (!this.state.failed) return this.props.children

    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f8f9fb] px-6">
        <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-8 text-center">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-50 text-amber-600">
            <AlertTriangle className="h-6 w-6" />
          </span>
          <h1 className="mt-5 text-lg font-bold text-gray-900">Something went wrong</h1>
          <p className="mt-2 text-sm text-gray-500">
            This page hit an unexpected error. Reloading usually clears it.
          </p>
          <div className="mt-6 flex justify-center gap-3">
            <button
              onClick={() => window.location.reload()}
              className="rounded-xl bg-gray-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-black"
            >
              Reload page
            </button>
            <a
              href="/"
              className="rounded-xl border border-gray-200 px-5 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
            >
              Go home
            </a>
          </div>
        </div>
      </div>
    )
  }
}
