import React, { useRef, useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { classifyDamage } from '../../services/imageAI'
import LoadingSpinner from '../shared/LoadingSpinner'

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const LARGE_FILE_THRESHOLD = 3 * 1024 * 1024 // 3MB
const MAX_ADDITIONAL = 4

async function analyzeImageQuality(file) {
  return new Promise((resolve) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      const canvas = document.createElement('canvas')
      // Sample a 100x100 portion for speed
      canvas.width = 100; canvas.height = 100
      const ctx = canvas.getContext('2d')
      ctx.drawImage(img, 0, 0, 100, 100)
      const data = ctx.getImageData(0, 0, 100, 100).data
      let total = 0
      for (let i = 0; i < data.length; i += 4) {
        // Perceived brightness: 0.299R + 0.587G + 0.114B
        total += 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]
      }
      const avg = total / (100 * 100)
      URL.revokeObjectURL(url)
      resolve({ brightness: avg, tooDark: avg < 40, tooLight: avg > 220 })
    }
    img.onerror = () => { URL.revokeObjectURL(url); resolve(null) }
    img.src = url
  })
}

export default function PhotoStep({ value, onPhotoChange, onAdditionalPhotosChange, onAiSuggestion, error }) {
  const { t } = useTranslation()
  const cameraInputRef = useRef(null)
  const galleryInputRef = useRef(null)
  const additionalInputRef = useRef(null)

  const [primaryPhoto, setPrimaryPhoto] = useState(value || null)
  const [primaryPreview, setPrimaryPreview] = useState(value ? URL.createObjectURL(value) : null)
  const [fileError, setFileError] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const [aiResult, setAiResult] = useState(null)
  const [isLarge, setIsLarge] = useState(false)
  const [qualityWarning, setQualityWarning] = useState(null) // 'dark' | 'light' | null
  const [qualityDismissed, setQualityDismissed] = useState(false)

  const [additionalPhotos, setAdditionalPhotos] = useState([])
  const [additionalPreviews, setAdditionalPreviews] = useState([])

  // Cleanup primary object URL on unmount
  useEffect(() => {
    return () => {
      if (primaryPreview) URL.revokeObjectURL(primaryPreview)
    }
  }, [primaryPreview])

  // Cleanup additional object URLs on unmount
  useEffect(() => {
    return () => {
      additionalPreviews.forEach((url) => URL.revokeObjectURL(url))
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const totalPhotos = (primaryPhoto ? 1 : 0) + additionalPhotos.length

  const handleFile = async (file) => {
    if (!file) return

    if (!ALLOWED_TYPES.includes(file.type)) {
      setFileError(t('error_file_type'))
      return
    }
    if (file.size > MAX_FILE_SIZE) {
      setFileError(t('error_file_size'))
      return
    }

    setFileError('')
    setAiResult(null)
    setQualityWarning(null)
    setQualityDismissed(false)
    setIsLarge(file.size > LARGE_FILE_THRESHOLD)

    if (primaryPreview) URL.revokeObjectURL(primaryPreview)
    const url = URL.createObjectURL(file)
    setPrimaryPreview(url)
    setPrimaryPhoto(file)
    onPhotoChange(file)

    // Run AI classification and brightness check in parallel
    setAiLoading(true)
    const [result, quality] = await Promise.all([
      classifyDamage(file).catch(() => null),
      analyzeImageQuality(file)
    ])
    setAiLoading(false)

    if (result) setAiResult(result)

    if (quality) {
      if (quality.tooDark) setQualityWarning('dark')
      else if (quality.tooLight) setQualityWarning('light')
    }
  }

  function addAdditionalPhoto(file) {
    if (!file) return
    if (!ALLOWED_TYPES.includes(file.type)) {
      setFileError(t('error_file_type'))
      return
    }
    if (file.size > MAX_FILE_SIZE) {
      setFileError(t('error_file_size'))
      return
    }
    if (additionalPhotos.length >= MAX_ADDITIONAL) return
    setFileError('')

    const url = URL.createObjectURL(file)
    const newPhotos = [...additionalPhotos, file]
    const newPreviews = [...additionalPreviews, url]
    setAdditionalPhotos(newPhotos)
    setAdditionalPreviews(newPreviews)
    if (onAdditionalPhotosChange) onAdditionalPhotosChange(newPhotos)
  }

  function removeAdditionalPhoto(index) {
    URL.revokeObjectURL(additionalPreviews[index])
    const newPhotos = additionalPhotos.filter((_, i) => i !== index)
    const newPreviews = additionalPreviews.filter((_, i) => i !== index)
    setAdditionalPhotos(newPhotos)
    setAdditionalPreviews(newPreviews)
    if (onAdditionalPhotosChange) onAdditionalPhotosChange(newPhotos)
  }

  const handleAcceptAI = () => {
    if (aiResult) {
      onAiSuggestion(aiResult.damageLevel)
      setAiResult({ ...aiResult, accepted: true })
    }
  }

  return (
    <div className="space-y-5">
      {/* Photo count indicator */}
      {primaryPhoto && (
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold text-gray-600">
            {totalPhotos}/5 photos
          </span>
        </div>
      )}

      {/* Primary photo slot */}
      {!primaryPhoto ? (
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => cameraInputRef.current?.click()}
            className="flex flex-col items-center justify-center gap-2 py-6 px-3 rounded-2xl border-3 border-dashed border-undp-blue bg-blue-50 hover:bg-blue-100 active:scale-95 transition-all min-h-[120px]"
            aria-label={t('photo_capture')}
          >
            <span className="text-4xl" aria-hidden="true">📷</span>
            <span className="text-undp-blue font-bold text-sm text-center leading-tight">{t('photo_capture')}</span>
          </button>

          <button
            type="button"
            onClick={() => galleryInputRef.current?.click()}
            className="flex flex-col items-center justify-center gap-2 py-6 px-3 rounded-2xl border-3 border-dashed border-gray-400 bg-gray-50 hover:bg-gray-100 active:scale-95 transition-all min-h-[120px]"
            aria-label={t('photo_upload')}
          >
            <span className="text-4xl" aria-hidden="true">🖼️</span>
            <span className="text-gray-600 font-bold text-sm text-center leading-tight">{t('photo_upload')}</span>
          </button>
        </div>
      ) : (
        /* Primary photo preview — full width */
        <div className="relative rounded-2xl overflow-hidden border-2 border-gray-200 bg-gray-100">
          <img
            src={primaryPreview}
            alt={t('photo_preview')}
            className="w-full max-h-64 object-cover"
          />
          {isLarge && (
            <div className="absolute bottom-0 left-0 right-0 bg-amber-500/90 text-white text-xs font-medium px-3 py-1.5 text-center">
              {t('photo_size_warning')}
            </div>
          )}
          <button
            type="button"
            onClick={() => {
              URL.revokeObjectURL(primaryPreview)
              setPrimaryPreview(null)
              setPrimaryPhoto(null)
              onPhotoChange(null)
              setAiResult(null)
              setQualityWarning(null)
              setQualityDismissed(false)
            }}
            className="absolute top-2 right-2 w-8 h-8 bg-black/60 text-white rounded-full flex items-center justify-center text-lg leading-none hover:bg-black/80 transition-colors"
            aria-label="Remove photo"
          >
            ×
          </button>
        </div>
      )}

      {/* Hidden inputs */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => handleFile(e.target.files?.[0])}
        aria-hidden="true"
      />
      <input
        ref={galleryInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => handleFile(e.target.files?.[0])}
        aria-hidden="true"
      />
      <input
        ref={additionalInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => {
          addAdditionalPhoto(e.target.files?.[0])
          // Reset so the same file can be re-selected if needed
          e.target.value = ''
        }}
        aria-hidden="true"
      />

      {/* Error messages */}
      {(fileError || error) && (
        <div role="alert" className="bg-red-50 border border-undp-red rounded-xl p-3 text-undp-red text-sm font-medium">
          {fileError || error}
        </div>
      )}

      {/* Additional photos section — only shown after primary is set */}
      {primaryPhoto && (
        <div className="space-y-3">
          {/* Additional photo grid */}
          {additionalPhotos.length > 0 && (
            <div className="grid grid-cols-2 gap-2">
              {additionalPreviews.map((url, i) => (
                <div key={i} className="relative rounded-xl overflow-hidden border-2 border-gray-200 bg-gray-100 aspect-square">
                  <img
                    src={url}
                    alt={`Additional photo ${i + 1}`}
                    className="w-full h-full object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => removeAdditionalPhoto(i)}
                    className="absolute top-1 right-1 w-7 h-7 bg-black/60 text-white rounded-full flex items-center justify-center text-base leading-none hover:bg-black/80 transition-colors"
                    aria-label={`Remove additional photo ${i + 1}`}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Add another photo button */}
          {additionalPhotos.length < MAX_ADDITIONAL && (
            <button
              type="button"
              onClick={() => additionalInputRef.current?.click()}
              className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 hover:bg-gray-100 active:scale-95 transition-all text-gray-600 font-medium text-sm"
            >
              <span aria-hidden="true">➕</span>
              Add another photo (optional)
            </button>
          )}
        </div>
      )}

      {/* Image quality warning banner */}
      {primaryPhoto && qualityWarning && !qualityDismissed && (
        <div
          role="alert"
          className="flex items-start gap-2 bg-amber-50 border border-amber-300 rounded-xl px-4 py-3 text-amber-800 text-sm"
        >
          <span className="flex-shrink-0 mt-0.5" aria-hidden="true">⚠️</span>
          <p className="flex-1 leading-snug">
            {qualityWarning === 'dark'
              ? 'Photo appears very dark — damage may not be visible to reviewers. Consider retaking with better lighting.'
              : 'Photo appears overexposed — please retake if possible.'
            }
          </p>
          <button
            type="button"
            onClick={() => setQualityDismissed(true)}
            className="flex-shrink-0 ml-1 text-amber-600 hover:text-amber-800 font-bold text-base leading-none"
            aria-label="Dismiss warning"
          >
            ×
          </button>
        </div>
      )}

      {/* AI analysis */}
      {primaryPhoto && aiLoading && (
        <div className="bg-purple-50 border border-purple-200 rounded-xl p-4 flex items-center gap-3">
          <LoadingSpinner size="sm" color="undp-teal" />
          <div>
            <p className="font-semibold text-purple-700 text-sm">{t('ai_suggestion')}</p>
            <p className="text-purple-500 text-xs">{t('ai_analyzing')}</p>
          </div>
        </div>
      )}

      {primaryPhoto && aiResult && !aiLoading && (
        <div className={`rounded-xl p-4 border-2 ${aiResult.accepted ? 'bg-green-50 border-undp-green' : 'bg-purple-50 border-purple-300'}`}>
          <div className="flex items-start justify-between gap-2 mb-3">
            <div>
              <p className="font-bold text-purple-800 text-sm flex items-center gap-1.5">
                <span aria-hidden="true">🤖</span> {t('ai_suggestion')}
              </p>
              <p className="text-xs text-purple-600 mt-0.5">
                {aiResult.confidence}% {t('ai_confidence')}
              </p>
            </div>
            <div className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide ${
              aiResult.damageLevel === 'none' ? 'bg-undp-green text-white' :
              aiResult.damageLevel === 'partial' ? 'bg-undp-amber text-white' :
              'bg-undp-red text-white'
            }`}>
              {aiResult.damageLevel === 'none' ? '✅ No damage' :
               aiResult.damageLevel === 'partial' ? '⚠️ Partial' : '🔴 Complete'}
            </div>
          </div>

          {!aiResult.accepted && (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleAcceptAI}
                className="flex-1 btn-success text-sm py-2 px-3"
              >
                {t('ai_accept')}
              </button>
              <button
                type="button"
                onClick={() => setAiResult(null)}
                className="flex-1 btn-secondary text-sm py-2 px-3"
              >
                {t('ai_choose_manually')}
              </button>
            </div>
          )}

          {aiResult.accepted && (
            <p className="text-undp-green font-semibold text-sm text-center">
              ✓ {t('ai_accept')}ed — you can still change in step 3
            </p>
          )}
        </div>
      )}
    </div>
  )
}
