import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'

const MAX_DESC = 500

// Electricity options aligned with UNDP Appendix 1
const ELECTRICITY_OPTIONS = [
  { value: 'no_damage',   key: 'electricity_no_damage',   emoji: '✅' },
  { value: 'minor',       key: 'electricity_minor',       emoji: '💡' },
  { value: 'moderate',    key: 'electricity_moderate',    emoji: '⚡' },
  { value: 'severe',      key: 'electricity_severe',      emoji: '⚠️' },
  { value: 'destroyed',   key: 'electricity_destroyed',   emoji: '🔌' },
  { value: 'unknown',     key: 'electricity_unknown',     emoji: '❓' }
]

// Health options aligned with UNDP Appendix 1
const HEALTH_OPTIONS = [
  { value: 'functional',   key: 'health_functional',   emoji: '🏥' },
  { value: 'partial',      key: 'health_partial',      emoji: '⚠️' },
  { value: 'disrupted',    key: 'health_disrupted',    emoji: '🔧' },
  { value: 'not_functioning', key: 'health_not_functioning', emoji: '🚫' },
  { value: 'unknown',      key: 'health_unknown',      emoji: '❓' }
]

// Pressing needs aligned with UNDP Appendix 1
const NEEDS = [
  { value: 'food_water',    key: 'need_food_water',    emoji: '🍲' },
  { value: 'cash',          key: 'need_cash',          emoji: '💵' },
  { value: 'healthcare',    key: 'need_healthcare',    emoji: '🩺' },
  { value: 'shelter',       key: 'need_shelter',       emoji: '🏠' },
  { value: 'livelihoods',   key: 'need_livelihoods',   emoji: '💼' },
  { value: 'wash',          key: 'need_wash',          emoji: '🚿' },
  { value: 'infrastructure',key: 'need_infrastructure',emoji: '🔧' },
  { value: 'protection',    key: 'need_protection',    emoji: '🛡️' },
  { value: 'community_support', key: 'need_community_support', emoji: '🤝' },
]

export default function AdditionalStep({ value, onChange }) {
  const { t } = useTranslation()
  const [expanded, setExpanded] = useState(false)

  const update = (field, val) => onChange({ ...value, [field]: val })

  const toggleNeed = (need) => {
    const current = value.pressingNeeds || []
    if (current.includes(need)) {
      update('pressingNeeds', current.filter((n) => n !== need))
    } else if (current.length < 3) {
      update('pressingNeeds', [...current, need])
    }
  }

  const descLength = (value.description || '').length
  const remaining = MAX_DESC - descLength

  return (
    <div className="space-y-5">
      {/* Collapsible toggle */}
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-200 text-left"
        aria-expanded={expanded}
      >
        <div>
          <p className="font-semibold text-gray-800">{t('optional_details')}</p>
          <p className="text-xs text-gray-500 mt-0.5">{t('skip')}</p>
        </div>
        <svg
          className={`w-5 h-5 text-gray-500 transition-transform ${expanded ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {expanded && (
        <div className="space-y-5">
          {/* Electricity */}
          <div>
            <p className="label-text">{t('electricity_status')}</p>
            <div className="grid grid-cols-2 gap-2">
              {ELECTRICITY_OPTIONS.map((opt) => {
                const isSelected = value.electricityStatus === opt.value
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => update('electricityStatus', opt.value)}
                    className={`flex items-center gap-2 p-3 rounded-xl border-2 text-left transition-all active:scale-95
                      ${isSelected
                        ? 'border-undp-blue bg-blue-50 text-undp-blue font-bold'
                        : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                      }`}
                    aria-pressed={isSelected}
                  >
                    <span className="text-xl" aria-hidden="true">{opt.emoji}</span>
                    <span className="text-xs leading-tight">{t(opt.key)}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Health services */}
          <div>
            <p className="label-text">{t('health_status')}</p>
            <div className="grid grid-cols-2 gap-2">
              {HEALTH_OPTIONS.map((opt) => {
                const isSelected = value.healthStatus === opt.value
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => update('healthStatus', opt.value)}
                    className={`flex items-center gap-2 p-3 rounded-xl border-2 text-left transition-all active:scale-95
                      ${isSelected
                        ? 'border-undp-teal bg-teal-50 text-undp-teal font-bold'
                        : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                      }`}
                    aria-pressed={isSelected}
                  >
                    <span className="text-xl" aria-hidden="true">{opt.emoji}</span>
                    <span className="text-xs leading-tight">{t(opt.key)}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Pressing needs */}
          <div>
            <p className="label-text">
              {t('pressing_needs')}
              <span className="text-xs font-normal text-gray-400 ml-2">({t('pressing_needs_max')})</span>
            </p>
            <div className="grid grid-cols-2 gap-2">
              {NEEDS.map((need) => {
                const current = value.pressingNeeds || []
                const isSelected = current.includes(need.value)
                const isDisabled = !isSelected && current.length >= 3
                return (
                  <button
                    key={need.value}
                    type="button"
                    onClick={() => toggleNeed(need.value)}
                    disabled={isDisabled}
                    className={`flex items-center gap-2 p-3 rounded-xl border-2 text-left transition-all active:scale-95
                      ${isSelected
                        ? 'border-undp-amber bg-amber-50 text-yellow-800 font-bold'
                        : isDisabled
                          ? 'border-gray-100 bg-gray-50 text-gray-300 cursor-not-allowed'
                          : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                      }`}
                    aria-pressed={isSelected}
                  >
                    <span className="text-xl" aria-hidden="true">{need.emoji}</span>
                    <span className="text-xs leading-tight">{t(need.key)}</span>
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* Description (always visible) */}
      <div>
        <label htmlFor="description" className="label-text">
          {t('description_placeholder')}
        </label>
        <textarea
          id="description"
          value={value.description || ''}
          onChange={(e) => {
            if (e.target.value.length <= MAX_DESC) {
              update('description', e.target.value)
            }
          }}
          placeholder={t('description_placeholder')}
          rows={4}
          className="input-field resize-none"
          maxLength={MAX_DESC}
        />
        <p className={`text-xs text-right mt-1 ${remaining < 50 ? 'text-undp-amber font-semibold' : 'text-gray-400'}`}>
          {remaining} {t('chars_remaining')}
        </p>
      </div>
    </div>
  )
}
