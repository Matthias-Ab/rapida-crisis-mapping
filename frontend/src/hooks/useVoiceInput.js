import { useState, useCallback, useRef, useEffect } from 'react'
import { useTranslation } from 'react-i18next'

const LANG_MAP = {
  en: 'en-US',
  fr: 'fr-FR',
  es: 'es-ES',
  ar: 'ar-SA',
  zh: 'zh-CN',
  ru: 'ru-RU'
}

export function useVoiceInput() {
  const { i18n } = useTranslation()
  const [isListening, setIsListening] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [interimTranscript, setInterimTranscript] = useState('')
  const [error, setError] = useState(null)
  const [isSupported, setIsSupported] = useState(true)
  const recognitionRef = useRef(null)

  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SpeechRecognition) setIsSupported(false)
    return () => {
      if (recognitionRef.current) recognitionRef.current.abort()
    }
  }, [])

  const start = useCallback(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SpeechRecognition) { setIsSupported(false); return }

    setTranscript('')
    setInterimTranscript('')
    setError(null)

    const recognition = new SpeechRecognition()
    recognitionRef.current = recognition
    recognition.lang = LANG_MAP[i18n.language] || 'en-US'
    recognition.interimResults = true
    recognition.continuous = true
    recognition.maxAlternatives = 1

    recognition.onresult = (event) => {
      let finalText = ''
      let interimText = ''
      for (let i = 0; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          finalText += event.results[i][0].transcript + ' '
        } else {
          interimText += event.results[i][0].transcript
        }
      }
      if (finalText) setTranscript(finalText.trim())
      setInterimTranscript(interimText)
    }

    recognition.onerror = (event) => {
      // 'aborted' is intentional (we called .abort()), 'no-speech' is a soft
      // timeout — neither should show an error message to the user.
      if (event.error !== 'aborted' && event.error !== 'no-speech') {
        setError(event.error)
      }
      setIsListening(false)
    }

    recognition.onend = () => {
      setIsListening(false)
      setInterimTranscript('')
    }

    recognition.start()
    setIsListening(true)
  }, [i18n.language])

  const stop = useCallback(() => {
    if (recognitionRef.current) recognitionRef.current.stop()
    setIsListening(false)
  }, [])

  const reset = useCallback(() => {
    if (recognitionRef.current) recognitionRef.current.abort()
    setTranscript('')
    setInterimTranscript('')
    setError(null)
    setIsListening(false)
  }, [])

  return { isSupported, isListening, transcript, interimTranscript, error, start, stop, reset }
}
