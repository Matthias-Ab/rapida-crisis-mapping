import React, { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useVoiceInput } from '../../hooks/useVoiceInput'
import { parseVoiceInput, summarizeDetected } from '../../utils/parseVoiceInput'
import { MicrophoneIcon, StopIcon } from '../shared/Icons'

function MicIcon({ stopped }) {
  return stopped
    ? <StopIcon className="w-10 h-10 text-white relative z-10" />
    : <MicrophoneIcon className="w-10 h-10 text-white relative z-10" />
}

function getErrorMessage(errorCode, t) {
  switch (errorCode) {
    case 'not-allowed': return t('voice_error_permission')
    case 'network': return t('voice_error_network')
    case 'audio-capture': return t('voice_error_no_mic')
    default: return t('voice_error')
  }
}

// Text fallback — same NLP detection, no mic needed
function TextFallback({ onDetect, onBack, t }) {
  const [text, setText] = useState('')

  const handleDetect = useCallback(() => {
    if (text.trim()) onDetect(text)
  }, [text, onDetect])

  return (
    <div>
      <p className="text-sm text-gray-500 mb-3 leading-snug">{t('voice_type_instead_hint')}</p>
      <textarea
        autoFocus
        value={text}
        onChange={(e) => setText(e.target.value.slice(0, 500))}
        placeholder={t('voice_type_placeholder')}
        rows={4}
        className="w-full border-2 border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-700 resize-none focus:outline-none focus:border-undp-blue transition-colors"
      />
      <p className="text-right text-xs text-gray-400 mt-1">{500 - text.length}</p>
      <div className="space-y-2 mt-3">
        <button
          onClick={handleDetect}
          disabled={!text.trim()}
          className="btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {t('voice_detect_fields')} →
        </button>
        <button onClick={onBack} className="btn-secondary w-full">
          {t('voice_retry')}
        </button>
      </div>
    </div>
  )
}

export default function VoiceReportModal({ onFill, onClose }) {
  const { t, i18n } = useTranslation()
  const { isSupported, isListening, transcript, interimTranscript, error, start, stop, reset } = useVoiceInput()
  const [stage, setStage] = useState('idle') // idle | listening | text | preview
  const [parsed, setParsed] = useState(null)

  const handleMicPress = useCallback(() => {
    if (isListening) {
      stop()
    } else {
      reset()
      setParsed(null)
      setStage('listening')
      start()
    }
  }, [isListening, start, stop, reset])

  // When recording stops: transcript → preview, nothing → back to idle
  useEffect(() => {
    if (!isListening && stage === 'listening') {
      if (transcript) {
        setParsed(parseVoiceInput(transcript, i18n.language))
        setStage('preview')
      } else {
        setStage('idle')
      }
    }
  }, [isListening, transcript, stage, i18n.language])

  // Real errors reset to idle so user sees the error on the mic screen
  useEffect(() => {
    if (error && stage === 'listening') {
      setStage('idle')
    }
  }, [error, stage])

  const handleTextDetect = useCallback((text) => {
    setParsed(parseVoiceInput(text, i18n.language))
    setStage('preview')
  }, [i18n.language])

  const handleUseThis = useCallback(() => {
    if (parsed) onFill(parsed)
    onClose()
  }, [parsed, onFill, onClose])

  const handleRetry = useCallback(() => {
    reset()
    setParsed(null)
    setStage('idle')
  }, [reset])

  const detected = parsed ? summarizeDetected(parsed, t) : []
  const displayText = transcript + (interimTranscript ? ' ' + interimTranscript : '')

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={t('voice_report')}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="w-full sm:max-w-sm bg-white rounded-t-3xl sm:rounded-3xl overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <span className="text-xl" aria-hidden="true">{stage === 'text' ? '⌨️' : '🎙️'}</span>
            <h2 className="font-bold text-gray-900 text-base">{t('voice_report')}</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-full hover:bg-gray-100 transition-colors" aria-label={t('close')}>
            <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="px-5 py-5">
          {/* Browser doesn't support Speech API */}
          {!isSupported && stage !== 'text' && (
            <div className="text-center py-2">
              <p className="text-gray-800 font-semibold mb-1">{t('voice_not_supported')}</p>
              <p className="text-gray-400 text-sm mb-4">{t('voice_not_supported_hint')}</p>
              <button onClick={() => setStage('text')} className="btn-primary w-full mb-2">
                {t('voice_type_instead')}
              </button>
              <button onClick={onClose} className="btn-secondary w-full">{t('close')}</button>
            </div>
          )}

          {/* Text fallback mode */}
          {stage === 'text' && (
            <TextFallback
              onDetect={handleTextDetect}
              onBack={handleRetry}
              t={t}
            />
          )}

          {/* Preview: detected fields */}
          {stage === 'preview' && parsed && (
            <div>
              <p className="text-sm font-semibold text-gray-600 mb-3">{t('voice_detected')}</p>
              <div className="bg-gray-50 rounded-xl px-3 py-2.5 mb-3 max-h-20 overflow-y-auto">
                <p className="text-sm text-gray-600 italic leading-snug">
                  &ldquo;{transcript || parsed.description}&rdquo;
                </p>
              </div>
              {detected.length > 0 ? (
                <div className="space-y-2 mb-4">
                  {detected.map((item, i) => (
                    <div key={i} className="flex items-center gap-2.5 bg-green-50 border border-green-200 rounded-xl px-3 py-2">
                      <span className="text-lg flex-shrink-0" aria-hidden="true">{item.icon}</span>
                      <span className="text-sm font-medium text-green-800 flex-1">{item.label}</span>
                      <svg className="w-4 h-4 text-green-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-4">
                  <p className="text-sm text-amber-700">{t('voice_no_fields_detected')}</p>
                </div>
              )}
              <div className="space-y-2">
                <button onClick={handleUseThis} className="btn-primary w-full">{t('voice_use_this')} →</button>
                <button onClick={handleRetry} className="btn-secondary w-full">{t('voice_retry')}</button>
              </div>
            </div>
          )}

          {/* Idle / Listening (mic mode) */}
          {isSupported && (stage === 'idle' || stage === 'listening') && (
            <div className="flex flex-col items-center py-2">
              <p className="text-sm text-gray-500 text-center mb-5 px-4 leading-snug">
                {isListening ? t('voice_listening') : t('voice_instruction')}
              </p>

              <button
                onClick={handleMicPress}
                className={`relative w-24 h-24 rounded-full flex items-center justify-center transition-all duration-200 active:scale-95
                  ${isListening
                    ? 'bg-undp-red shadow-xl shadow-red-500/40'
                    : 'bg-undp-blue shadow-xl shadow-blue-500/30 hover:bg-blue-700'
                  }`}
                aria-label={isListening ? t('voice_stop') : t('voice_start')}
              >
                {isListening && (
                  <>
                    <span className="absolute inset-0 rounded-full bg-undp-red animate-ping opacity-25" />
                    <span className="absolute inset-0 rounded-full bg-undp-red animate-ping opacity-15" style={{ animationDelay: '0.6s' }} />
                  </>
                )}
                <MicIcon stopped={isListening} />
              </button>

              <p className="text-xs text-gray-400 mt-4">
                {isListening ? t('voice_tap_to_stop') : t('voice_tap_to_start')}
              </p>

              {displayText.trim() && (
                <div className="mt-4 w-full bg-gray-50 rounded-xl px-3 py-2.5 max-h-20 overflow-y-auto">
                  <p className="text-sm text-gray-700 leading-snug">
                    {transcript}
                    {interimTranscript && <span className="text-gray-400 italic"> {interimTranscript}</span>}
                  </p>
                </div>
              )}

              {/* Error with specific message + "Type instead" escape hatch */}
              {error && (
                <div role="alert" className={`mt-4 w-full rounded-xl p-3 text-sm leading-snug
                  ${error === 'not-allowed' ? 'bg-red-50 border border-red-200 text-red-700' : 'bg-amber-50 border border-amber-200 text-amber-700'}`}
                >
                  {getErrorMessage(error, t)}
                  {(error === 'network' || error === 'not-allowed') && (
                    <button
                      onClick={() => setStage('text')}
                      className="mt-2 block w-full text-center text-xs font-bold underline opacity-80 hover:opacity-100"
                    >
                      {t('voice_type_instead')} →
                    </button>
                  )}
                </div>
              )}

              {/* Always show "type instead" as a quiet fallback link */}
              {!error && !isListening && (
                <button
                  onClick={() => setStage('text')}
                  className="mt-4 text-xs text-gray-400 hover:text-undp-blue underline transition-colors"
                >
                  {t('voice_type_instead')}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
