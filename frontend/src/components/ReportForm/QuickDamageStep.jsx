import React from 'react'
import { useTranslation } from 'react-i18next'

const DAMAGE_OPTIONS = [
  { value: 'none',     emoji: '✅', labelKey: 'damage_none',     descKey: 'damage_none_desc',     bg: 'bg-green-50',  border: 'border-undp-green',  text: 'text-undp-green' },
  { value: 'partial',  emoji: '⚠️', labelKey: 'damage_partial',  descKey: 'damage_partial_desc',  bg: 'bg-amber-50',  border: 'border-undp-amber',  text: 'text-undp-amber' },
  { value: 'complete', emoji: '🔴', labelKey: 'damage_complete', descKey: 'damage_complete_desc', bg: 'bg-red-50',    border: 'border-undp-red',    text: 'text-undp-red' },
]

const CRISIS_OPTIONS = [
  { value: 'earthquake',      emoji: '🌍', labelKey: 'crisis_earthquake' },
  { value: 'flood',           emoji: '🌊', labelKey: 'crisis_flood' },
  { value: 'hurricane_cyclone', emoji: '🌀', labelKey: 'crisis_hurricane' },
  { value: 'wildfire',        emoji: '🔥', labelKey: 'crisis_wildfire' },
  { value: 'explosion',       emoji: '💥', labelKey: 'crisis_explosion' },
  { value: 'chemical_incident', emoji: '☣️', labelKey: 'crisis_chemical' },
  { value: 'conflict',        emoji: '⚔️', labelKey: 'crisis_conflict' },
  { value: 'civil_unrest',    emoji: '🚧', labelKey: 'crisis_civil_unrest' },
  { value: 'tsunami',         emoji: '🌊', labelKey: 'crisis_tsunami' },
]

export default function QuickDamageStep({ damageLevel, crisisType, onDamageChange, onCrisisChange, errors }) {
  const { t } = useTranslation()

  return (
    <div className="space-y-6">
      {/* Damage level */}
      <div>
        <p className="label-text mb-3">
          How severe is the damage? <span className="text-undp-red">*</span>
        </p>
        <div className="space-y-2.5">
          {DAMAGE_OPTIONS.map((opt) => {
            const selected = damageLevel === opt.value
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => onDamageChange(opt.value)}
                className={`w-full flex items-center gap-3 p-4 rounded-2xl border-2 text-left transition-all active:scale-[.98]
                  ${selected ? `${opt.bg} ${opt.border}` : 'border-gray-200 bg-white hover:border-gray-300'}`}
                aria-pressed={selected}
              >
                <span className="text-2xl flex-shrink-0" aria-hidden="true">{opt.emoji}</span>
                <div>
                  <p className={`font-bold text-sm ${selected ? opt.text : 'text-gray-800'}`}>{t(opt.labelKey)}</p>
                  <p className="text-xs text-gray-500">{t(opt.descKey)}</p>
                </div>
                {selected && <span className={`ml-auto text-xl ${opt.text}`} aria-hidden="true">✓</span>}
              </button>
            )
          })}
        </div>
        {errors?.damageLevel && (
          <p role="alert" className="text-undp-red text-sm mt-1">{errors.damageLevel}</p>
        )}
      </div>

      {/* Crisis type */}
      <div>
        <p className="label-text mb-2">
          What caused the damage? <span className="text-undp-red">*</span>
        </p>
        <div className="grid grid-cols-3 gap-2">
          {CRISIS_OPTIONS.map((opt) => {
            const selected = crisisType === opt.value
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => onCrisisChange(opt.value)}
                className={`flex flex-col items-center gap-1 p-2.5 rounded-xl border-2 text-center transition-all active:scale-95
                  ${selected
                    ? 'border-undp-blue bg-blue-50 text-undp-blue font-bold'
                    : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                  }`}
                aria-pressed={selected}
              >
                <span className="text-xl" aria-hidden="true">{opt.emoji}</span>
                <span className="text-[10px] leading-tight">{t(opt.labelKey)}</span>
              </button>
            )
          })}
        </div>
        {errors?.crisisType && (
          <p role="alert" className="text-undp-red text-sm mt-1">{errors.crisisType}</p>
        )}
      </div>
    </div>
  )
}
