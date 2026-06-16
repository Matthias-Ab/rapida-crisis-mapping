import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useStore, BADGE_MILESTONES } from '../store'
import { useOfflineQueue } from '../hooks/useOfflineQueue'
import { useBandwidth } from '../hooks/useBandwidth'
import { getAnalytics } from '../services/api'
import LanguageSwitcher from '../components/LanguageSwitcher'
import ReportForm from '../components/ReportForm'
import LoadingSpinner from '../components/shared/LoadingSpinner'

// Sync icon SVG
function SyncIcon({ className, spinning }) {
  return (
    <svg
      className={`${className} ${spinning ? 'animate-spin' : ''}`}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
    </svg>
  )
}

export default function Submit() {
  const { t } = useTranslation()
  const sessionId = useStore((s) => s.sessionId)
  const badges = useStore((s) => s.badges)
  const submissionCount = useStore((s) => s.submissionCount)
  const submittedReportIds = useStore((s) => s.submittedReportIds)
  const { queueCount, isSyncing, sync } = useOfflineQueue()
  const isLowBandwidth = useBandwidth()
  const [isOnline, setIsOnline] = useState(navigator.onLine)
  const [analytics, setAnalytics] = useState(null)
  const [reportMode, setReportMode] = useState(null) // null | 'quick' | 'full'
  const [showContributions, setShowContributions] = useState(false)

  useEffect(() => {
    const onOnline = () => setIsOnline(true)
    const onOffline = () => setIsOnline(false)
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    return () => {
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
    }
  }, [])

  useEffect(() => {
    getAnalytics()
      .then((res) => setAnalytics(res.data))
      .catch(() => {})
  }, [])

  // Find next badge
  const nextBadge = BADGE_MILESTONES.find((b) => b.count > submissionCount)

  const showOfflineBanner = !isOnline || queueCount > 0

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="bg-undp-blue text-white shadow-md flex-shrink-0 z-10">
        <div className="flex items-center justify-between px-4 py-3 max-w-lg mx-auto w-full">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center">
              <span className="text-undp-blue font-black text-xs">UN</span>
            </div>
            <h1 className="font-bold text-base leading-tight">
              {t('app_name')}
            </h1>
          </div>
          <div className="flex items-center gap-2">
            {/* Offline queue badge / sync indicator */}
            {queueCount > 0 && (
              <button
                onClick={sync}
                disabled={isSyncing || !isOnline}
                className="relative flex items-center gap-1.5 px-2.5 py-1.5 bg-undp-amber text-white rounded-full text-xs font-bold active:scale-95 transition-all disabled:opacity-70"
                title={t('offline_queue', { count: queueCount })}
                aria-label={`${queueCount} reports queued, ${isSyncing ? 'syncing' : 'tap to sync'}`}
              >
                {isSyncing ? (
                  <SyncIcon className="w-4 h-4" spinning />
                ) : (
                  <SyncIcon className="w-4 h-4" />
                )}
                {/* Red count badge */}
                <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] bg-red-500 text-white rounded-full text-[10px] font-black flex items-center justify-center px-1 leading-none">
                  {queueCount}
                </span>
              </button>
            )}
            <LanguageSwitcher />
          </div>
        </div>

        {/* Animated offline / queued banner */}
        {showOfflineBanner && (
          <div className="bg-undp-amber/10 border-b-2 border-undp-amber text-amber-800 py-2 px-4 flex items-center gap-3">
            {/* Pulsing amber dot */}
            <span className="flex-shrink-0 relative flex h-3 w-3" aria-hidden="true">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-undp-amber opacity-75" />
              <span className="relative inline-flex rounded-full h-3 w-3 bg-undp-amber" />
            </span>

            <span className="text-xs font-semibold flex-1">
              {!isOnline
                ? <>📴&nbsp; You&apos;re offline{queueCount > 0 ? ` · ${queueCount} ${queueCount === 1 ? 'report' : 'reports'} queued` : ''}</>
                : <>📥&nbsp; {queueCount} {queueCount === 1 ? 'report' : 'reports'} queued</>
              }
            </span>

            {isOnline && (
              <button
                onClick={sync}
                disabled={isSyncing}
                className="flex-shrink-0 flex items-center gap-1 text-xs font-bold text-undp-amber hover:text-amber-700 transition-colors disabled:opacity-60"
                aria-label="Sync queued reports now"
              >
                {isSyncing ? (
                  <>
                    <SyncIcon className="w-3.5 h-3.5" spinning />
                    <span>{t('syncing')}</span>
                  </>
                ) : (
                  <>
                    <SyncIcon className="w-3.5 h-3.5" />
                    <span>Sync now when connected →</span>
                  </>
                )}
              </button>
            )}

            {!isOnline && (
              <span className="flex-shrink-0 text-xs text-amber-600 font-medium">
                Sync when connected →
              </span>
            )}
          </div>
        )}
      </header>

      {/* Global stats banner */}
      {analytics?.total_reports > 0 && (
        <div className="bg-undp-blue/5 border-b border-undp-blue/10 px-4 py-2 text-center">
          <p className="text-xs text-undp-blue font-semibold">
            {t('global_stats', {
              reporters: analytics.unique_reporters?.toLocaleString() || '—',
              reports: analytics.total_reports?.toLocaleString() || '—'
            })}
          </p>
        </div>
      )}

      {/* My Contributions (collapsible) */}
      {submissionCount > 0 && (
        <div className="max-w-lg mx-auto w-full px-4 pt-3">
          <button
            onClick={() => setShowContributions((v) => !v)}
            className="w-full flex items-center justify-between bg-white rounded-xl border border-gray-200 px-4 py-3 shadow-sm"
            aria-expanded={showContributions}
          >
            <div className="flex items-center gap-3">
              <span className="text-2xl" aria-hidden="true">🏆</span>
              <div className="text-left">
                <p className="font-semibold text-gray-800 text-sm">{t('my_contributions')}</p>
                <p className="text-xs text-gray-500">{submissionCount} {t('reports_submitted')}</p>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              {badges.slice(-3).map((badge) => (
                <span key={badge.id} className="text-xl" title={badge.name}>{badge.icon}</span>
              ))}
              <svg
                className={`w-4 h-4 text-gray-400 ml-1 transition-transform ${showContributions ? 'rotate-180' : ''}`}
                fill="none" stroke="currentColor" viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </button>

          {showContributions && (
            <div className="bg-white border border-gray-200 border-t-0 rounded-b-xl px-4 pb-4 shadow-sm">
              {/* Badge grid */}
              <div className="grid grid-cols-5 gap-2 py-3">
                {BADGE_MILESTONES.map((milestone) => {
                  const earned = badges.find((b) => b.id === milestone.id)
                  return (
                    <div
                      key={milestone.id}
                      className={`flex flex-col items-center gap-1 p-2 rounded-xl transition-all
                        ${earned ? 'bg-yellow-50 border border-yellow-200' : 'bg-gray-50 border border-gray-100 opacity-40'}`}
                      title={`${milestone.name} (${milestone.count} reports)`}
                    >
                      <span className="text-2xl">{milestone.icon}</span>
                      <span className="text-[9px] text-center font-semibold text-gray-600 leading-tight">{milestone.count}</span>
                    </div>
                  )
                })}
              </div>

              {/* My submitted reports list */}
              {submittedReportIds.length > 0 && (
                <div className="mb-3">
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">My Reports</p>
                  <div className="space-y-1 max-h-40 overflow-y-auto">
                    {[...submittedReportIds].reverse().map((id, i) => (
                      <Link
                        key={id}
                        to={`/reports/${id}`}
                        className="flex items-center justify-between px-3 py-2 rounded-lg bg-gray-50 hover:bg-undp-blue/5 hover:text-undp-blue transition-colors group"
                      >
                        <span className="text-xs font-mono text-gray-500 group-hover:text-undp-blue truncate flex-1">
                          #{submittedReportIds.length - i} · {id.slice(0, 8)}…
                        </span>
                        <svg className="w-3.5 h-3.5 text-gray-400 group-hover:text-undp-blue flex-shrink-0 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              {nextBadge && (
                <div className="bg-blue-50 rounded-xl p-3">
                  <p className="text-xs text-undp-blue font-semibold">
                    Next badge at {nextBadge.count} reports: {nextBadge.icon} {nextBadge.name}
                  </p>
                  <div className="mt-1.5 h-2 bg-blue-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-undp-blue rounded-full transition-all"
                      style={{
                        width: `${Math.min(100, (submissionCount / nextBadge.count) * 100)}%`
                      }}
                    />
                  </div>
                  <p className="text-[10px] text-blue-400 mt-1">
                    {submissionCount} / {nextBadge.count}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Low bandwidth banner */}
      {isLowBandwidth && (
        <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 flex items-center gap-2 text-xs text-amber-700 font-medium flex-shrink-0">
          <span aria-hidden="true">📡</span>
          Slow connection — photos will be auto-compressed and AI classification is disabled
        </div>
      )}

      {/* Mode selector — shown before the form */}
      {!reportMode && (
        <main className="flex-1 max-w-lg mx-auto w-full px-4 pt-6 pb-10">
          <p className="text-center text-gray-500 text-sm mb-6">How would you like to report?</p>
          <div className="space-y-3">
            <button
              onClick={() => setReportMode('quick')}
              className="w-full flex items-start gap-4 p-5 bg-undp-blue text-white rounded-2xl shadow-lg hover:bg-blue-700 active:scale-[.98] transition-all text-left"
            >
              <span className="text-3xl flex-shrink-0" aria-hidden="true">🚶</span>
              <div>
                <p className="font-bold text-base">Quick Report</p>
                <p className="text-blue-200 text-sm mt-0.5">3 steps — Photo, Location, Damage type. Fast, simple, for anyone.</p>
              </div>
            </button>
            <button
              onClick={() => setReportMode('full')}
              className="w-full flex items-start gap-4 p-5 bg-white border-2 border-gray-200 rounded-2xl hover:border-undp-blue active:scale-[.98] transition-all text-left"
            >
              <span className="text-3xl flex-shrink-0" aria-hidden="true">📋</span>
              <div>
                <p className="font-bold text-base text-gray-800">Detailed Report</p>
                <p className="text-gray-500 text-sm mt-0.5">5 steps — includes infrastructure details, electricity, health services, pressing needs. For responders and field teams.</p>
              </div>
            </button>
          </div>
        </main>
      )}

      {/* Form */}
      {reportMode && (
        <main className="flex-1 max-w-lg mx-auto w-full">
          <ReportForm
            quickMode={reportMode === 'quick'}
            onModeChange={() => setReportMode(null)}
          />
        </main>
      )}

      {/* Footer */}
      <footer className="bg-white border-t border-gray-100 py-3 px-4 text-center text-xs text-gray-400 flex-shrink-0">
        <p className="mb-1">{t('data_notice')}</p>
        <div className="flex items-center justify-center gap-3">
          <Link to="/privacy" className="text-undp-blue hover:underline">{t('privacy_policy')}</Link>
          <span>·</span>
          <Link to="/reports" className="text-undp-blue hover:underline">All Reports</Link>
          <span>·</span>
          <Link to="/dashboard" className="text-undp-blue hover:underline">{t('dashboard')}</Link>
          <span>·</span>
          <Link to="/map" className="text-undp-blue hover:underline">{t('view_map')}</Link>
          <span>·</span>
          <Link to="/situation-report" className="text-undp-blue hover:underline">Situation Report</Link>
        </div>
      </footer>
    </div>
  )
}
