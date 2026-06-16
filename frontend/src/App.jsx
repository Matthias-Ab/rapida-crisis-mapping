import React, { useEffect, Suspense, lazy } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

// Submit is the critical path — load eagerly (fast first paint on /submit)
import Submit from './pages/Submit'
import Privacy from './pages/Privacy'

// Everything else is lazy — saves ~600KB on initial load
const Dashboard     = lazy(() => import('./pages/Dashboard'))
const MapPage       = lazy(() => import('./pages/Map'))
const ReportDetail  = lazy(() => import('./pages/ReportDetail'))
const Reports       = lazy(() => import('./pages/Reports'))
const SituationReport = lazy(() => import('./pages/SituationReport'))
const Overview      = lazy(() => import('./pages/Overview'))

function PageLoader() {
  return (
    <div className="flex items-center justify-center h-screen bg-gray-50">
      <div className="flex flex-col items-center gap-3">
        <div className="w-10 h-10 border-4 border-undp-blue border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-gray-500 font-medium">Loading…</p>
      </div>
    </div>
  )
}

function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center h-screen bg-gray-50 p-6 text-center">
      <div className="text-7xl mb-4">🗺️</div>
      <h1 className="text-2xl font-bold text-gray-800 mb-2">Page not found</h1>
      <p className="text-gray-500 mb-6 max-w-xs">
        This page doesn't exist. Use the links below to navigate.
      </p>
      <div className="flex gap-3">
        <a href="/submit" className="px-5 py-2.5 bg-undp-blue text-white rounded-xl font-semibold text-sm hover:bg-blue-700 transition-colors">
          Submit Report
        </a>
        <a href="/dashboard" className="px-5 py-2.5 border-2 border-undp-blue text-undp-blue rounded-xl font-semibold text-sm hover:bg-undp-blue/5 transition-colors">
          Dashboard
        </a>
      </div>
    </div>
  )
}

class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { hasError: false } }
  static getDerivedStateFromError() { return { hasError: true } }
  componentDidCatch(error, info) { console.error('RAPIDA Error:', error, info) }
  render() {
    if (this.state.hasError) return (
      <div className="flex items-center justify-center h-screen p-4 text-center bg-gray-50">
        <div className="max-w-sm">
          <div className="text-6xl mb-4">⚠️</div>
          <h1 className="text-2xl font-bold text-undp-red mb-2">Something went wrong</h1>
          <p className="text-gray-600 mb-6">An unexpected error occurred. Please reload the page.</p>
          <button onClick={() => window.location.reload()} className="px-6 py-3 bg-undp-blue text-white rounded-xl font-semibold w-full">
            Reload App
          </button>
        </div>
      </div>
    )
    return this.props.children
  }
}

function AppRoutes() {
  const { i18n } = useTranslation()
  useEffect(() => {
    document.documentElement.dir = i18n.language === 'ar' ? 'rtl' : 'ltr'
    document.documentElement.lang = i18n.language
  }, [i18n.language])

  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route path="/"                element={<Navigate to="/overview" replace />} />
        <Route path="/overview"        element={<Overview />} />
        <Route path="/submit"          element={<Submit />} />
        <Route path="/privacy"         element={<Privacy />} />
        <Route path="/dashboard"       element={<Dashboard />} />
        <Route path="/map"             element={<MapPage />} />
        <Route path="/reports"         element={<Reports />} />
        <Route path="/reports/:id"     element={<ReportDetail />} />
        <Route path="/situation-report" element={<SituationReport />} />
        <Route path="*"                element={<NotFound />} />
      </Routes>
    </Suspense>
  )
}

export default function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </ErrorBoundary>
  )
}
