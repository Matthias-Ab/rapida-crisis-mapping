import React from 'react'
import { useTranslation } from 'react-i18next'
import { CheckCircleIcon, WarningIcon, XCircleIcon } from '../shared/Icons'

const DAMAGE_OPTIONS = [
  {
    value: 'none',
    Icon: CheckCircleIcon,
    labelKey: 'damage_none',
    descKey: 'damage_none_desc',
    borderColor: 'border-undp-green',
    bgColor: 'bg-green-50',
    textColor: 'text-undp-green',
    iconColor: 'text-undp-green',
    hoverBg: 'hover:bg-green-50'
  },
  {
    value: 'partial',
    Icon: WarningIcon,
    labelKey: 'damage_partial',
    descKey: 'damage_partial_desc',
    borderColor: 'border-undp-amber',
    bgColor: 'bg-amber-50',
    textColor: 'text-yellow-700',
    iconColor: 'text-undp-amber',
    hoverBg: 'hover:bg-amber-50'
  },
  {
    value: 'complete',
    Icon: XCircleIcon,
    labelKey: 'damage_complete',
    descKey: 'damage_complete_desc',
    borderColor: 'border-undp-red',
    bgColor: 'bg-red-50',
    textColor: 'text-undp-red',
    iconColor: 'text-undp-red',
    hoverBg: 'hover:bg-red-50'
  }
]

export default function DamageStep({ value, onChange, error }) {
  const { t } = useTranslation()

  return (
    <div className="space-y-4">
      <div className="space-y-3" role="radiogroup" aria-label={t('step3_title')}>
        {DAMAGE_OPTIONS.map((opt) => {
          const isSelected = value === opt.value
          return (
            <button
              key={opt.value}
              type="button"
              role="radio"
              aria-checked={isSelected}
              onClick={() => onChange(opt.value)}
              className={`damage-card w-full text-left flex items-center gap-4 transition-all
                ${isSelected
                  ? `${opt.borderColor} ${opt.bgColor} shadow-md`
                  : `border-gray-200 bg-white ${opt.hoverBg} hover:border-gray-300`
                }`}
            >
              <span
                className={`flex-shrink-0 w-12 h-12 flex items-center justify-center rounded-xl
                  ${isSelected ? opt.bgColor : 'bg-gray-50'}`}
                aria-hidden="true"
              >
                <opt.Icon className={`w-7 h-7 ${isSelected ? opt.iconColor : 'text-gray-400'}`} />
              </span>
              <div className="flex-1 min-w-0">
                <p className={`font-bold text-lg leading-tight ${isSelected ? opt.textColor : 'text-gray-800'}`}>
                  {t(opt.labelKey)}
                </p>
                <p className="text-sm text-gray-500 mt-0.5 leading-snug">
                  {t(opt.descKey)}
                </p>
              </div>
              <div
                className={`flex-shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all
                  ${isSelected ? `${opt.borderColor} bg-current` : 'border-gray-300'}`}
                aria-hidden="true"
              >
                {isSelected && (
                  <svg className="w-3.5 h-3.5 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                )}
              </div>
            </button>
          )
        })}
      </div>

      {error && (
        <div role="alert" className="bg-red-50 border border-undp-red rounded-xl p-3 text-undp-red text-sm font-medium">
          {error}
        </div>
      )}
    </div>
  )
}
