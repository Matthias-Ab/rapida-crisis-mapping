import React from 'react'
import { useTranslation } from 'react-i18next'

const DAMAGE_OPTIONS = [
  { value: 'none', label: 'damage_none', color: 'bg-undp-green' },
  { value: 'partial', label: 'damage_partial', color: 'bg-undp-amber' },
  { value: 'complete', label: 'damage_complete', color: 'bg-undp-red' }
]

const INFRA_OPTIONS = [
  { value: 'residential', label: 'infra_residential', emoji: '🏠' },
  { value: 'commercial', label: 'infra_commercial', emoji: '🏪' },
  { value: 'government', label: 'infra_government', emoji: '🏛️' },
  { value: 'utility', label: 'infra_utility', emoji: '⚡' },
  { value: 'transport', label: 'infra_transport', emoji: '🚉' },
  { value: 'community', label: 'infra_community', emoji: '🏫' },
  { value: 'recreation', label: 'infra_recreation', emoji: '🌳' },
  { value: 'other', label: 'infra_other', emoji: '🏗️' }
]

const CRISIS_OPTIONS = [
  { value: 'earthquake', label: 'crisis_earthquake', emoji: '🌍' },
  { value: 'flood', label: 'crisis_flood', emoji: '🌊' },
  { value: 'hurricane', label: 'crisis_hurricane', emoji: '🌀' },
  { value: 'wildfire', label: 'crisis_wildfire', emoji: '🔥' },
  { value: 'tsunami', label: 'crisis_tsunami', emoji: '🌊' },
  { value: 'explosion', label: 'crisis_explosion', emoji: '💥' },
  { value: 'chemical', label: 'crisis_chemical', emoji: '☣️' },
  { value: 'conflict', label: 'crisis_conflict', emoji: '⚔️' },
  { value: 'civil_unrest', label: 'crisis_civil_unrest', emoji: '🚧' }
]

export default function FilterSidebar({ filters, onFiltersChange, resultCount, totalCount }) {
  const { t } = useTranslation()

  const toggleArray = (field, value) => {
    const current = filters[field] || []
    const updated = current.includes(value)
      ? current.filter((v) => v !== value)
      : [...current, value]
    onFiltersChange({ ...filters, [field]: updated })
  }

  const handleClear = () => {
    onFiltersChange({
      damageLevels: [],
      infraTypes: [],
      crisisTypes: [],
      dateFrom: '',
      dateTo: '',
      unverifiedOnly: false,
      flaggedOnly: false
    })
  }

  return (
    <aside className="bg-white border-r border-gray-100 w-full md:w-64 flex-shrink-0 overflow-y-auto">
      <div className="p-4 space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h2 className="font-bold text-gray-800 text-sm uppercase tracking-wide">Filters</h2>
          <button
            onClick={handleClear}
            className="text-xs text-undp-blue font-semibold hover:underline"
          >
            {t('filter_clear')}
          </button>
        </div>

        {/* Result count */}
        <p className="text-xs text-gray-500">
          {t('showing_results', { shown: resultCount, total: totalCount })}
        </p>

        {/* Date range */}
        <div className="space-y-2">
          <p className="text-xs font-bold uppercase tracking-wide text-gray-500">Date Range</p>
          <input
            type="date"
            value={filters.dateFrom || ''}
            onChange={(e) => onFiltersChange({ ...filters, dateFrom: e.target.value })}
            className="w-full text-sm border border-gray-200 rounded-lg px-2 py-2 focus:border-undp-blue focus:outline-none"
            aria-label={t('filter_date_from')}
          />
          <input
            type="date"
            value={filters.dateTo || ''}
            onChange={(e) => onFiltersChange({ ...filters, dateTo: e.target.value })}
            className="w-full text-sm border border-gray-200 rounded-lg px-2 py-2 focus:border-undp-blue focus:outline-none"
            aria-label={t('filter_date_to')}
          />
        </div>

        {/* Damage level */}
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-gray-500 mb-2">
            {t('filter_damage')}
          </p>
          <div className="space-y-1">
            {DAMAGE_OPTIONS.map((opt) => (
              <label key={opt.value} className="flex items-center gap-2.5 cursor-pointer py-1.5">
                <input
                  type="checkbox"
                  checked={(filters.damageLevels || []).includes(opt.value)}
                  onChange={() => toggleArray('damageLevels', opt.value)}
                  className="w-4 h-4 rounded"
                  style={{ accentColor: '#0468B1' }}
                />
                <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${opt.color}`} aria-hidden="true" />
                <span className="text-sm text-gray-700">{t(opt.label)}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Infrastructure type */}
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-gray-500 mb-2">
            {t('filter_infra')}
          </p>
          <div className="space-y-1 max-h-48 overflow-y-auto">
            {INFRA_OPTIONS.map((opt) => (
              <label key={opt.value} className="flex items-center gap-2.5 cursor-pointer py-1">
                <input
                  type="checkbox"
                  checked={(filters.infraTypes || []).includes(opt.value)}
                  onChange={() => toggleArray('infraTypes', opt.value)}
                  className="w-4 h-4 rounded"
                  style={{ accentColor: '#0468B1' }}
                />
                <span className="text-base" aria-hidden="true">{opt.emoji}</span>
                <span className="text-sm text-gray-700">{t(opt.label)}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Crisis type */}
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-gray-500 mb-2">
            {t('filter_crisis')}
          </p>
          <div className="space-y-1 max-h-48 overflow-y-auto">
            {CRISIS_OPTIONS.map((opt) => (
              <label key={opt.value} className="flex items-center gap-2.5 cursor-pointer py-1">
                <input
                  type="checkbox"
                  checked={(filters.crisisTypes || []).includes(opt.value)}
                  onChange={() => toggleArray('crisisTypes', opt.value)}
                  className="w-4 h-4 rounded"
                  style={{ accentColor: '#0468B1' }}
                />
                <span className="text-base" aria-hidden="true">{opt.emoji}</span>
                <span className="text-sm text-gray-700">{t(opt.label)}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Toggles */}
        <div className="space-y-2">
          <label className="flex items-center justify-between cursor-pointer py-1">
            <span className="text-sm text-gray-700">{t('filter_unverified')}</span>
            <div
              onClick={() => onFiltersChange({ ...filters, unverifiedOnly: !filters.unverifiedOnly })}
              className={`relative w-10 h-6 rounded-full transition-colors ${filters.unverifiedOnly ? 'bg-undp-blue' : 'bg-gray-300'}`}
              role="switch"
              aria-checked={filters.unverifiedOnly}
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === ' ' || e.key === 'Enter') onFiltersChange({ ...filters, unverifiedOnly: !filters.unverifiedOnly }) }}
            >
              <div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${filters.unverifiedOnly ? 'translate-x-4' : ''}`} />
            </div>
          </label>
          <label className="flex items-center justify-between cursor-pointer py-1">
            <span className="text-sm text-gray-700">{t('filter_flagged')}</span>
            <div
              onClick={() => onFiltersChange({ ...filters, flaggedOnly: !filters.flaggedOnly })}
              className={`relative w-10 h-6 rounded-full transition-colors ${filters.flaggedOnly ? 'bg-undp-red' : 'bg-gray-300'}`}
              role="switch"
              aria-checked={filters.flaggedOnly}
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === ' ' || e.key === 'Enter') onFiltersChange({ ...filters, flaggedOnly: !filters.flaggedOnly }) }}
            >
              <div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${filters.flaggedOnly ? 'translate-x-4' : ''}`} />
            </div>
          </label>
        </div>
      </div>
    </aside>
  )
}
