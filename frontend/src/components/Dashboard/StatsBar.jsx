import React, { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { getAnalytics } from '../../services/api'
import LoadingSpinner from '../shared/LoadingSpinner'

const DAMAGE_LABELS = { none: 'No Damage', partial: 'Partial', complete: 'Complete' }
const DAMAGE_COLORS = {
  none: { text: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200', hex: '#059669' },
  partial: { text: 'text-amber-500', bg: 'bg-amber-50', border: 'border-amber-200', hex: '#F5A623' },
  complete: { text: 'text-red-600', bg: 'bg-red-50', border: 'border-red-200', hex: '#D12800' }
}

const CRISIS_TYPE_EMOJI = {
  flood: '🌊',
  earthquake: '🌍',
  fire: '🔥',
  storm: '🌪️',
  landslide: '⛰️',
  drought: '☀️',
  tsunami: '🌊',
  conflict: '⚠️',
  infrastructure: '🏗️',
  other: '📌'
}

function getCrisisEmoji(type) {
  if (!type) return '📌'
  const lower = type.toLowerCase()
  for (const [key, emoji] of Object.entries(CRISIS_TYPE_EMOJI)) {
    if (lower.includes(key)) return emoji
  }
  return '📌'
}

function TrendIcon({ value }) {
  if (!value || value === 0) return <span className="text-gray-300 text-xs">—</span>
  if (value > 0) return (
    <span className="text-emerald-500 text-xs font-bold" aria-label="trending up">▲</span>
  )
  return (
    <span className="text-red-400 text-xs font-bold" aria-label="trending down">▼</span>
  )
}

function StatCard({ label, value, icon, colorClass, borderClass, bgClass, trend }) {
  return (
    <div className={`bg-white rounded-xl border ${borderClass || 'border-gray-100'} shadow-sm p-4 flex flex-col gap-1 transition-shadow hover:shadow-md`}>
      <div className="flex items-center justify-between mb-0.5">
        <span className="text-xs font-semibold text-gray-400 uppercase tracking-widest leading-tight">{label}</span>
        <span className="text-lg" aria-hidden="true">{icon}</span>
      </div>
      <div className="flex items-end gap-2">
        <span className={`text-3xl font-extrabold leading-none ${colorClass}`}>{value}</span>
        <TrendIcon value={trend} />
      </div>
    </div>
  )
}

function DamageBar({ none, partial, complete, total }) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    const t = requestAnimationFrame(() => setMounted(true))
    return () => cancelAnimationFrame(t)
  }, [])

  if (total === 0) return (
    <div className="h-8 bg-gray-100 rounded-full flex items-center justify-center text-xs text-gray-400">
      No data
    </div>
  )

  const pNone = (none / total) * 100
  const pPartial = (partial / total) * 100
  const pComplete = (complete / total) * 100

  const segments = [
    { key: 'none', pct: pNone, color: 'bg-emerald-500', label: `${Math.round(pNone)}%` },
    { key: 'partial', pct: pPartial, color: 'bg-amber-400', label: `${Math.round(pPartial)}%` },
    { key: 'complete', pct: pComplete, color: 'bg-red-500', label: `${Math.round(pComplete)}%` }
  ]

  return (
    <div className="flex h-8 rounded-full overflow-hidden gap-px bg-gray-100">
      {segments.map((seg) => (
        <div
          key={seg.key}
          className={`${seg.color} flex items-center justify-center transition-all duration-700 ease-out overflow-hidden`}
          style={{ width: mounted ? `${seg.pct}%` : '0%' }}
          title={`${seg.key}: ${seg.label}`}
        >
          {seg.pct > 8 && (
            <span className="text-white text-xs font-bold select-none">{seg.label}</span>
          )}
        </div>
      ))}
    </div>
  )
}

export default function StatsBar() {
  const { t } = useTranslation()
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getAnalytics()
      .then((res) => setStats(res.data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex justify-center py-4">
        <LoadingSpinner size="sm" label={t('loading')} />
      </div>
    )
  }

  if (!stats) return null

  const mostCommon = stats.most_common_damage || 'partial'
  const damageStyle = DAMAGE_COLORS[mostCommon] || DAMAGE_COLORS.partial

  // Damage distribution counts
  const byDamage = stats.by_damage_level || {}
  const noneCount = byDamage.none ?? 0
  const partialCount = byDamage.partial ?? 0
  const completeCount = byDamage.complete ?? 0
  const total = stats.total_reports || (noneCount + partialCount + completeCount) || 0

  const pNone = total > 0 ? Math.round((noneCount / total) * 100) : 0
  const pPartial = total > 0 ? Math.round((partialCount / total) * 100) : 0
  const pComplete = total > 0 ? Math.round((completeCount / total) * 100) : 0

  // Top crisis type
  const byCrisisType = stats.by_crisis_type || {}
  let topCrisis = null
  let topCrisisCount = 0
  for (const [type, count] of Object.entries(byCrisisType)) {
    if (count > topCrisisCount) {
      topCrisis = type
      topCrisisCount = count
    }
  }

  const statCards = [
    {
      label: t('total_reports'),
      value: stats.total_reports?.toLocaleString() ?? '—',
      icon: '📋',
      colorClass: 'text-[#0468B1]',
      borderClass: 'border-blue-100',
    },
    {
      label: t('reports_today'),
      value: stats.reports_today?.toLocaleString() ?? '—',
      icon: '📅',
      colorClass: 'text-[#00A19D]',
      borderClass: 'border-teal-100',
    },
    {
      label: t('unique_buildings'),
      value: stats.unique_buildings?.toLocaleString() ?? '—',
      icon: '🏢',
      colorClass: 'text-[#F5A623]',
      borderClass: 'border-amber-100',
    },
    {
      label: t('most_common_damage'),
      value: DAMAGE_LABELS[mostCommon] ?? mostCommon ?? '—',
      icon: mostCommon === 'complete' ? '🔴' : mostCommon === 'partial' ? '⚠️' : '✅',
      colorClass: damageStyle.text,
      borderClass: damageStyle.border,
    }
  ]

  return (
    <div className="px-4 pt-3 pb-2 space-y-3 flex-shrink-0">
      {/* Top row: stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {statCards.map((card) => (
          <StatCard key={card.label} {...card} />
        ))}
      </div>

      {/* Bottom row: damage distribution */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest">
            Damage Distribution
          </h3>
          {topCrisis && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-100">
              <span>{getCrisisEmoji(topCrisis)}</span>
              <span>Top: {topCrisis.charAt(0).toUpperCase() + topCrisis.slice(1)}</span>
              <span className="ml-0.5 text-blue-400">({topCrisisCount})</span>
            </span>
          )}
        </div>

        <DamageBar
          none={noneCount}
          partial={partialCount}
          complete={completeCount}
          total={total}
        />

        {/* Legend */}
        <div className="flex flex-wrap gap-x-5 gap-y-1 mt-3">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-emerald-500 inline-block flex-shrink-0" />
            <span className="text-xs text-gray-600">
              None: <span className="font-semibold">{noneCount.toLocaleString()}</span>
              <span className="text-gray-400 ml-1">({pNone}%)</span>
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-amber-400 inline-block flex-shrink-0" />
            <span className="text-xs text-gray-600">
              Partial: <span className="font-semibold">{partialCount.toLocaleString()}</span>
              <span className="text-gray-400 ml-1">({pPartial}%)</span>
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-red-500 inline-block flex-shrink-0" />
            <span className="text-xs text-gray-600">
              Complete: <span className="font-semibold">{completeCount.toLocaleString()}</span>
              <span className="text-gray-400 ml-1">({pComplete}%)</span>
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
