import { Suspense, lazy } from 'react'
import { Route, Routes } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import ErrorBoundary from './components/ErrorBoundary'
import ProtectedRoute from './components/ProtectedRoute'
import WelcomePage from './pages/WelcomePage'
import AuthPage from './pages/AuthPage'

// The landing and login pages load straight away because they are the first
// thing a visitor sees. The rest arrive on demand, which keeps the initial
// download small even though the charting library is heavy.
const DashboardPage = lazy(() => import('./pages/DashboardPage'))
const WatchlistPage = lazy(() => import('./pages/WatchlistPage'))
const StockAnalyserPage = lazy(() => import('./pages/StockAnalyserPage'))
const StockComparisonPage = lazy(() => import('./pages/StockComparisonPage'))
const BacktesterPage = lazy(() => import('./pages/BacktesterPage'))
const PaperTradingPage = lazy(() => import('./pages/PaperTradingPage'))
const ProfilePage = lazy(() => import('./pages/ProfilePage'))
const NotFoundPage = lazy(() => import('./pages/NotFoundPage'))

function PageLoader() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f8f9fb]">
      <Loader2 className="h-7 w-7 animate-spin text-blue-600" />
    </div>
  )
}

function Protected({ children }) {
  return (
    <ProtectedRoute>
      <Suspense fallback={<PageLoader />}>{children}</Suspense>
    </ProtectedRoute>
  )
}

function App() {
  return (
    <ErrorBoundary>
      <Routes>
        <Route path="/" element={<WelcomePage />} />
        <Route path="/auth" element={<AuthPage />} />
        <Route
          path="/dashboard"
          element={
            <Protected>
              <DashboardPage />
            </Protected>
          }
        />
        <Route
          path="/watchlist"
          element={
            <Protected>
              <WatchlistPage />
            </Protected>
          }
        />
        <Route
          path="/stock-analyser"
          element={
            <Protected>
              <StockAnalyserPage />
            </Protected>
          }
        />
        <Route
          path="/stock-comparison"
          element={
            <Protected>
              <StockComparisonPage />
            </Protected>
          }
        />
        <Route
          path="/backtester"
          element={
            <Protected>
              <BacktesterPage />
            </Protected>
          }
        />
        <Route
          path="/paper-trading"
          element={
            <Protected>
              <PaperTradingPage />
            </Protected>
          }
        />
        <Route
          path="/profile"
          element={
            <Protected>
              <ProfilePage />
            </Protected>
          }
        />
        <Route
          path="*"
          element={
            <Suspense fallback={<PageLoader />}>
              <NotFoundPage />
            </Suspense>
          }
        />
      </Routes>
    </ErrorBoundary>
  )
}

export default App
