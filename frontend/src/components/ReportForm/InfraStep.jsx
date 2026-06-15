import React from 'react'
import { useTranslation } from 'react-i18next'

const INFRA_TYPES = [
  { value: 'residential', emoji: '🏠', key: 'infra_residential' },
  { value: 'commercial', emoji: '🏪', key: 'infra_commercial' },
  { value: 'government', emoji: '🏛️', key: 'infra_government' },
  { value: 'utility', emoji: '⚡', key: 'infra_utility' },
  { value: 'transport_communication', emoji: '🚉', key: 'infra_transport' },
  { value: 'community', emoji: '🏫', key: 'infra_community' },
  { value: 'public_recreation', emoji: '🌳', key: 'infra_recreation' },
  { value: 'other', emoji: '🏗️', key: 'infra_other' }
]

const CRISIS_GROUPS = [
  {
    key: 'crisis_natural',
    items: [
      { value: 'earthquake', emoji: '🌍', key: 'crisis_earthquake' },
      { value: 'flood', emoji: '🌊', key: 'crisis_flood' },
      { value: 'tsunami', emoji: '🌊', key: 'crisis_tsunami' },
      { value: 'hurricane_cyclone', emoji: '🌀', key: 'crisis_hurricane' },
      { value: 'wildfire', emoji: '🔥', key: 'crisis_wildfire' }
    ]
  },
  {
    key: 'crisis_industrial',
    items: [
      { value: 'explosion', emoji: '💥', key: 'crisis_explosion' },
      { value: 'chemical_incident', emoji: '☣️', key: 'crisis_chemical' }
    ]
  },
  {
    key: 'crisis_human',
    items: [
      { value: 'conflict', emoji: '⚔️', key: 'crisis_conflict' },
      { value: 'civil_unrest', emoji: '🚧', key: 'crisis_civil_unrest' }
    ]
  }
]

const DEBRIS_OPTIONS = [
  { value: 'yes', key: 'debris_yes', color: 'bg-undp-red text-white border-undp-red' },
  { value: 'no', key: 'debris_no', color: 'bg-undp-green text-white border-undp-green' },
  { value: 'unknown', key: 'debris_unknown', color: 'bg-gray-400 text-white border-gray-400' }
]

export default function InfraStep({ value, onChange, errors }) {
  const { t } = useTranslation()

  const update = (field, val) => onChange({ ...value, [field]: val })

  return (
    <div className="space-y-6">
      {/* Infrastructure type */}
      <div>
        <label className="label-text">{t('infra_type')} <span className="text-undp-red">*</span></label>
        <div className="grid grid-cols-2 gap-2">
          {INFRA_TYPES.map((type) => {
            const isSelected = value.infraType === type.value
            return (
              <button
                key={type.value}
                type="button"
                onClick={() => update('infraType', type.value)}
                className={`flex items-center gap-2.5 p-3 rounded-xl border-2 text-left transition-all active:scale-95
                  ${isSelected
                    ? 'border-undp-blue bg-blue-50 text-undp-blue font-bold'
                    : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
                  }`}
                aria-pressed={isSelected}
              >
                <span className="text-xl flex-shrink-0" aria-hidden="true">{type.emoji}</span>
                <span className="text-sm leading-tight">{t(type.key)}</span>
              </button>
            )
          })}
        </div>
        {errors?.infraType && (
          <p role="alert" className="text-undp-red text-sm mt-1">{errors.infraType}</p>
        )}
      </div>

      {/* Infrastructure name */}
      <div>
        <label htmlFor="infra-name" className="label-text">
          {t('infra_name_placeholder')}
        </label>
        <input
          id="infra-name"
          type="text"
          value={value.infraName || ''}
          onChange={(e) => update('infraName', e.target.value)}
          placeholder={t('infra_name_placeholder')}
          className="input-field"
          maxLength={120}
        />
      </div>

      {/* Crisis type */}
      <div>
        <p className="label-text">{t('crisis_type')} <span className="text-undp-red">*</span></p>
        {CRISIS_GROUPS.map((group) => (
          <div key={group.key} className="mb-4">
            <p className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">
              {t(group.key)}
            </p>
            <div className="space-y-1.5">
              {group.items.map((item) => {
                const isSelected = value.crisisType === item.value
                return (
                  <label
                    key={item.value}
                    className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all
                      ${isSelected
                        ? 'border-undp-blue bg-blue-50'
                        : 'border-gray-200 bg-white hover:border-gray-300'
                      }`}
                  >
                    <input
                      type="radio"
                      name="crisis-type"
                      value={item.value}
                      checked={isSelected}
                      onChange={() => update('crisisType', item.value)}
                      className="w-5 h-5 text-undp-blue"
                    />
                    <span className="text-xl" aria-hidden="true">{item.emoji}</span>
                    <span className={`text-sm font-medium ${isSelected ? 'text-undp-blue' : 'text-gray-700'}`}>
                      {t(item.key)}
                    </span>
                  </label>
                )
              })}
            </div>
          </div>
        ))}
        {errors?.crisisType && (
          <p role="alert" className="text-undp-red text-sm mt-1">{errors.crisisType}</p>
        )}
      </div>

      {/* Debris */}
      <div>
        <p className="label-text">{t('debris_question')}</p>
        <div className="grid grid-cols-3 gap-2">
          {DEBRIS_OPTIONS.map((opt) => {
            const isSelected = value.debris === opt.value
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => update('debris', opt.value)}
                className={`py-3 px-2 rounded-xl border-2 font-bold text-sm transition-all active:scale-95
                  ${isSelected ? opt.color : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'}`}
                aria-pressed={isSelected}
              >
                {t(opt.key)}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
