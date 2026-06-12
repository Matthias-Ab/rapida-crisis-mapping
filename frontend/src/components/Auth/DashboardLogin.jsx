import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'

export default function DashboardLogin({ onAuthenticated }) {
  const { t } = useTranslation()
  const [key, setKey] = useState('')
  const [error, setError] = useState('')

  const handleSubmit = (e) => {
    e.preventDefault()
    const trimmed = key.trim()
    if (!trimmed) {
      setError(t('error_required'))
      return
    }
    sessionStorage.setItem('dashboard_key', trimmed)
    onAuthenticated(trimmed)
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-undp-blue rounded-2xl flex items-center justify-center mx-auto mb-4">
            <span className="text-3xl">🔑</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">{t('dashboard_title')}</h1>
          <p className="text-gray-500 mt-2 text-sm">{t('enter_api_key')}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="api-key" className="label-text">
              {t('enter_api_key')}
            </label>
            <input
              id="api-key"
              type="password"
              value={key}
              onChange={(e) => {
                setKey(e.target.value)
                setError('')
              }}
              placeholder={t('api_key_placeholder')}
              className="input-field font-mono"
              autoComplete="off"
              spellCheck={false}
            />
            {error && (
              <p className="text-undp-red text-sm mt-1">{error}</p>
            )}
          </div>

          <button
            type="submit"
            className="btn-primary w-full"
          >
            {t('api_key_submit')}
          </button>
        </form>

        <p className="text-center text-xs text-gray-400 mt-6">
          {t('data_notice')}
        </p>
      </div>
    </div>
  )
}
