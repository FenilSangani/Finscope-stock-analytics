import { BarChart3, Mail } from 'lucide-react'

function GithubIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M12 .5C5.73.5.5 5.73.5 12c0 5.08 3.29 9.39 7.86 10.91.58.1.79-.25.79-.56 0-.27-.01-1.17-.02-2.13-3.2.7-3.88-1.36-3.88-1.36-.52-1.33-1.28-1.68-1.28-1.68-1.04-.72.08-.7.08-.7 1.15.08 1.76 1.19 1.76 1.19 1.03 1.75 2.69 1.25 3.35.96.1-.74.4-1.25.73-1.54-2.56-.29-5.25-1.28-5.25-5.72 0-1.26.45-2.29 1.19-3.1-.12-.29-.52-1.47.11-3.06 0 0 .97-.31 3.18 1.18a11 11 0 0 1 5.79 0c2.21-1.49 3.18-1.18 3.18-1.18.63 1.59.23 2.77.11 3.06.74.81 1.19 1.84 1.19 3.1 0 4.45-2.7 5.43-5.27 5.71.41.36.78 1.07.78 2.16 0 1.56-.01 2.82-.01 3.2 0 .31.21.67.8.56A10.52 10.52 0 0 0 23.5 12C23.5 5.73 18.27.5 12 .5Z" />
    </svg>
  )
}

function LinkedinIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M20.45 20.45h-3.56v-5.57c0-1.33-.02-3.04-1.85-3.04-1.86 0-2.14 1.45-2.14 2.94v5.67H9.34V9h3.42v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28ZM5.34 7.43a2.07 2.07 0 1 1 0-4.14 2.07 2.07 0 0 1 0 4.14ZM7.12 20.45H3.56V9h3.56v11.45Z" />
    </svg>
  )
}

const platformLinks = [
  'Dashboard',
  'Watchlist',
  'Stock Analyser',
  'Stock Comparison',
  'Strategy Backtester',
  'Paper Trading',
]

const companyLinks = ['About', 'Privacy Policy', 'Terms of Use', 'Contact']

export default function Footer() {
  return (
    <footer className="bg-gray-950 px-6 py-14 text-gray-400 sm:px-10">
      <div className="mx-auto grid max-w-6xl grid-cols-1 gap-12 sm:grid-cols-2 lg:grid-cols-[1.3fr_1fr_1fr]">
        <div>
          <div className="flex items-center gap-2">
            <BarChart3 className="h-6 w-6 text-blue-500" strokeWidth={2.5} />
            <span className="text-lg font-bold text-white">
              Fin<span className="text-blue-500">Scope</span>
            </span>
          </div>
          <p className="mt-4 max-w-xs text-sm leading-relaxed text-gray-400">
            An Indian stock market analytics, strategy backtesting and paper
            trading suite — research, test, practice, and track it all in one
            place.
          </p>
        </div>

        <div>
          <p className="text-xs font-semibold tracking-wider text-gray-500 uppercase">
            Platform
          </p>
          <ul className="mt-4 space-y-3">
            {platformLinks.map((link) => (
              <li key={link}>
                <a
                  href="#"
                  className="text-sm transition hover:text-white"
                >
                  {link}
                </a>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <p className="text-xs font-semibold tracking-wider text-gray-500 uppercase">
            Company
          </p>
          <ul className="mt-4 space-y-3">
            {companyLinks.map((link) => (
              <li key={link}>
                <a
                  href="#"
                  className="text-sm transition hover:text-white"
                >
                  {link}
                </a>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="mx-auto mt-12 flex max-w-6xl flex-col items-center justify-between gap-4 border-t border-gray-800 pt-6 sm:flex-row">
        <p className="text-xs text-gray-500">
          © {new Date().getFullYear()} FinScope. Built for learning — not
          investment advice.
        </p>
        <div className="flex items-center gap-4">
          <a href="#" aria-label="GitHub" className="text-gray-500 transition hover:text-white">
            <GithubIcon className="h-4 w-4" />
          </a>
          <a href="#" aria-label="LinkedIn" className="text-gray-500 transition hover:text-white">
            <LinkedinIcon className="h-4 w-4" />
          </a>
          <a href="#" aria-label="Email" className="text-gray-500 transition hover:text-white">
            <Mail className="h-4 w-4" />
          </a>
        </div>
      </div>
    </footer>
  )
}
