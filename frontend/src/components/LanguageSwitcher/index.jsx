import React, { useState, useRef, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useStore } from '../../store'

const LANGUAGES = [
  { code: 'en', label: 'English', flag: '🇬🇧' },
  { code: 'ar', label: 'العربية', flag: '🇸🇦', rtl: true },
  { code: 'zh', label: '中文', flag: '🇨🇳' },
  { code: 'fr', label: 'Français', flag: '🇫🇷' },
  { code: 'ru', label: 'Русский', flag: '🇷🇺' },
  { code: 'es', label: 'Español', flag: '🇪🇸' }
]

export default function LanguageSwitcher() {
  const { i18n } = useTranslation()
  const setLanguage = useStore((s) => s.setLanguage)
  const [open, setOpen] = useState(false)
  const dropdownRef = useRef(null)

  const current = LANGUAGES.find((l) => l.code === i18n.language) || LANGUAGES[0]

  const handleSelect = (lang) => {
    i18n.changeLanguage(lang.code)
    setLanguage(lang.code)
    localStorage.setItem('rapida_lang', lang.code)
    document.documentElement.dir = lang.rtl ? 'rtl' : 'ltr'
    document.documentElement.lang = lang.code
    setOpen(false)
  }

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [])

  return (
    <div ref={dropdownRef} className="relative" dir="ltr">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/20 hover:bg-white/30 text-white font-semibold text-sm transition-colors min-h-[40px]"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`Language: ${current.label}`}
      >
        <span aria-hidden="true">{current.flag}</span>
        <span className="hidden sm:inline">{current.label}</span>
        <svg
          className={`w-3.5 h-3.5 transition-transform ${open ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div
          className="absolute right-0 mt-1 bg-white rounded-xl shadow-2xl border border-gray-100 overflow-hidden z-50 min-w-[160px]"
          role="listbox"
          aria-label="Select language"
        >
          {LANGUAGES.map((lang) => (
            <button
              key={lang.code}
              role="option"
              aria-selected={lang.code === i18n.language}
              onClick={() => handleSelect(lang)}
              className={`w-full flex items-center gap-3 px-4 py-3 text-left text-sm font-medium transition-colors hover:bg-undp-blue hover:text-white ${
                lang.code === i18n.language
                  ? 'bg-blue-50 text-undp-blue'
                  : 'text-gray-700'
              }`}
              dir={lang.rtl ? 'rtl' : 'ltr'}
            >
              <span className="text-xl" aria-hidden="true">{lang.flag}</span>
              <span>{lang.label}</span>
              {lang.code === i18n.language && (
                <span className="ml-auto text-undp-blue" aria-hidden="true">✓</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
