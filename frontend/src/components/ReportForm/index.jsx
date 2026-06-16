import React, { useState, useCallback, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { MapContainer, TileLayer, Marker } from 'react-leaflet'
import L from 'leaflet'
import { useTranslation } from 'react-i18next'
import { v4 as uuidv4 } from 'uuid'
import { submitReport } from '../../services/api'
import { addToQueue } from '../../services/offlineDB'
import { useStore } from '../../store'
import { useOfflineQueue } from '../../hooks/useOfflineQueue'
import { useToast } from '../shared/Toast'
import LoadingSpinner from '../shared/LoadingSpinner'
import PhotoStep from './PhotoStep'
import LocationStep from './LocationStep'
import DamageStep from './DamageStep'
import InfraStep from './InfraStep'
import AdditionalStep from './AdditionalStep'
import QuickDamageStep from './QuickDamageStep'
import VoiceReportModal from './VoiceReportModal'

const STEP_TITLES = ['step1_title', 'step2_title', 'step3_title', 'step4_title', 'step5_title']
const STEP_ICONS = ['📷', '📍', '💥', '🏗️', '📝']

const INITIAL_FORM = {
  photo: null,
  additionalPhotos: [],
  location: null,
  damageLevel: null,
  infraType: null,
  infraName: '',
  crisisType: null,
  debris: null,
  electricityStatus: null,
  healthStatus: null,
  pressingNeeds: [],
  description: ''
}

// Share icon SVG
function ShareIcon({ className }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
    </svg>
  )
}

export default function ReportForm({ quickMode = false, onModeChange }) {
  const { t } = useTranslation()
  const TOTAL_STEPS = quickMode ? 3 : 5
  const STEP_TITLES_Q = ['step1_title', 'step2_title', 'step3_title']
  const STEP_ICONS_Q = ['📷', '📍', '💥']
  const sessionId = useStore((s) => s.sessionId)
  const recordSubmission = useStore((s) => s.recordSubmission)
  const { refreshCount } = useOfflineQueue()
  const { addToast, ToastContainer } = useToast()

  const [step, setStep] = useState(1)
  const [form, setForm] = useState(INITIAL_FORM)
  const [errors, setErrors] = useState({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitResult, setSubmitResult] = useState(null) // { success, reportId, offline }
  const [aiSuggestedDamage, setAiSuggestedDamage] = useState(null)
  const [shareCopied, setShareCopied] = useState(false)
  const [showVoiceModal, setShowVoiceModal] = useState(false)

  // Transition state
  const [direction, setDirection] = useState('forward') // 'forward' | 'back'
  const [transitionClass, setTransitionClass] = useState('translate-x-0 opacity-100')
  const prevStepRef = useRef(step)

  // Trigger slide animation when step changes
  useEffect(() => {
    if (prevStepRef.current === step) return
    const goingForward = step > prevStepRef.current
    prevStepRef.current = step

    // Start off-screen
    const startClass = goingForward ? 'translate-x-8 opacity-0' : '-translate-x-8 opacity-0'
    setTransitionClass(startClass)

    // On next tick, slide in
    const raf = requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setTransitionClass('transition-all duration-300 ease-out translate-x-0 opacity-100')
      })
    })
    return () => cancelAnimationFrame(raf)
  }, [step])

  const updateForm = useCallback((field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }))
    setErrors((prev) => ({ ...prev, [field]: null }))
  }, [])

  const validateStep = useCallback((s) => {
    const errs = {}
    if (s === 1 && !form.photo) errs.photo = t('error_photo_required')
    if (s === 2 && !form.location) errs.location = t('error_location_required')
    if (quickMode) {
      // Quick mode step 3: damage + crisis type on one screen
      if (s === 3) {
        if (!form.damageLevel) errs.damageLevel = t('error_damage_required')
        if (!form.crisisType) errs.crisisType = t('error_crisis_required')
      }
    } else {
      if (s === 3 && !form.damageLevel) errs.damageLevel = t('error_damage_required')
      if (s === 4) {
        if (!form.infraType) errs.infraType = t('error_infra_required')
        if (!form.crisisType) errs.crisisType = t('error_crisis_required')
      }
    }
    return errs
  }, [form, t, quickMode])

  const handleNext = useCallback(() => {
    const errs = validateStep(step)
    if (Object.keys(errs).length > 0) {
      setErrors(errs)
      return
    }
    setDirection('forward')
    setStep((s) => s + 1)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [step, validateStep])

  const handleBack = useCallback(() => {
    setDirection('back')
    setStep((s) => s - 1)
    setErrors({})
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [])

  const handleSubmit = useCallback(async () => {
    const errs = validateStep(step)
    if (Object.keys(errs).length > 0) {
      setErrors(errs)
      return
    }

    setIsSubmitting(true)
    const reportId = uuidv4()

    const formDataObj = {
      session_id: sessionId,
      damage_level: form.damageLevel,
      // Quick mode skips the infra step — default to 'other' so backend validation passes
      infra_type: form.infraType || (quickMode ? 'other' : ''),
      infra_name: form.infraName || '',
      crisis_type: form.crisisType,
      debris_present: form.debris === 'yes' ? 'true' : form.debris === 'no' ? 'false' : '',
      latitude: form.location?.lat?.toString() || '',
      longitude: form.location?.lng?.toString() || '',
      building_id: form.location?.buildingId?.toString() || '',
      location_text: form.location?.locationText || '',
      electricity_status: form.electricityStatus || '',
      health_services_status: form.healthStatus || '',
      pressing_needs: JSON.stringify(form.pressingNeeds || []),
      description: form.description || '',
      language: 'en'
    }

    const fd = new FormData()
    Object.entries(formDataObj).forEach(([k, v]) => fd.append(k, v))
    if (form.photo) fd.append('photo', form.photo, 'photo.jpg')
    form.additionalPhotos?.forEach((file, i) => {
      fd.append(`photo_${i + 2}`, file, `photo_${i + 2}.jpg`)
    })

    try {
      const res = await submitReport(fd)
      const serverId = res.data?.id || reportId
      const badge = recordSubmission(serverId)

      const photoPreview = form.photo ? URL.createObjectURL(form.photo) : null
      setSubmitResult({ success: true, reportId: serverId, offline: false, photoPreview, location: form.location })

      if (badge) {
        addToast(`${badge.icon} ${badge.name}`, 'badge')
      }
    } catch (err) {
      if (err.offline) {
        // Save to offline queue
        const formDataPlain = { ...formDataObj }
        await addToQueue(formDataPlain, form.photo)
        await refreshCount()

        const badge = recordSubmission(reportId)
        const photoPreview = form.photo ? URL.createObjectURL(form.photo) : null
        setSubmitResult({ success: true, reportId, offline: true, photoPreview, location: form.location })

        if (badge) {
          addToast(`${badge.icon} ${badge.name}`, 'badge')
        }
        addToast(t('offline_saved'), 'info')
      } else {
        setErrors({ submit: err.userMessage || t('error_server') })
        addToast(err.userMessage || t('error_server'), 'error')
      }
    } finally {
      setIsSubmitting(false)
    }
  }, [step, validateStep, sessionId, form, recordSubmission, refreshCount, addToast, t])

  const handleAiSuggestion = useCallback((damageLevel) => {
    setAiSuggestedDamage(damageLevel)
    updateForm('damageLevel', damageLevel)
  }, [updateForm])

  const handleVoiceFill = useCallback((parsed) => {
    setForm((prev) => ({
      ...prev,
      damageLevel: parsed.damageLevel || prev.damageLevel,
      infraType: parsed.infraType || prev.infraType,
      crisisType: parsed.crisisType || prev.crisisType,
      pressingNeeds: parsed.pressingNeeds?.length ? parsed.pressingNeeds : prev.pressingNeeds,
      description: parsed.description || prev.description
    }))
    setErrors({})
  }, [])

  const handleReset = useCallback(() => {
    setForm(INITIAL_FORM)
    setErrors({})
    setStep(1)
    prevStepRef.current = 1
    setTransitionClass('translate-x-0 opacity-100')
    setSubmitResult(null)
    setAiSuggestedDamage(null)
    setShareCopied(false)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [])

  const shareReport = useCallback(async (reportId) => {
    const url = `${window.location.origin}/reports/${reportId}`
    const title = 'RAPIDA Crisis Report'
    if (navigator.share) {
      try {
        await navigator.share({ title, url })
        return
      } catch {
        // User cancelled or API unavailable — fall through to clipboard
      }
    }
    try {
      await navigator.clipboard.writeText(url)
      setShareCopied(true)
      setTimeout(() => setShareCopied(false), 2000)
    } catch {
      // silently ignore
    }
  }, [])

  // Revoke the blob URL when success screen unmounts
  const photoPreviewRef = useRef(null)
  useEffect(() => {
    if (submitResult?.photoPreview) photoPreviewRef.current = submitResult.photoPreview
    return () => { if (photoPreviewRef.current) URL.revokeObjectURL(photoPreviewRef.current) }
  }, [submitResult])

  // Success screen
  if (submitResult) {
    return (
      <div className="max-w-sm mx-auto px-4 pb-10">
        <ToastContainer />

        {/* Photo */}
        {submitResult.photoPreview && (
          <div className="w-full bg-black mb-0 overflow-hidden" style={{ maxHeight: 260 }}>
            <img
              src={submitResult.photoPreview}
              alt="Submitted photo"
              className="w-full object-cover"
              style={{ maxHeight: 260 }}
            />
          </div>
        )}

        <div className="text-center pt-6 pb-3 px-2">
          <div className="text-5xl mb-3">
            {submitResult.offline ? '📥' : '✅'}
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-1">
            {submitResult.offline ? t('offline_saved') : t('submit_success')}
          </h2>
          <p className="text-gray-500 text-sm">{t('submit_success_desc')}</p>
        </div>

        {/* Mini-map with pin */}
        {submitResult.location?.lat && (
          <div className="mx-4 rounded-2xl overflow-hidden border-2 border-undp-blue/30" style={{ height: 180 }}>
            <MapContainer
              center={[submitResult.location.lat, submitResult.location.lng]}
              zoom={16}
              style={{ width: '100%', height: '100%' }}
              zoomControl={false}
              dragging={false}
              scrollWheelZoom={false}
              doubleClickZoom={false}
              attributionControl={false}
            >
              <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
              <Marker
                position={[submitResult.location.lat, submitResult.location.lng]}
                icon={L.divIcon({
                  html: `<div style="width:22px;height:22px;background:#0468B1;border:3px solid white;border-radius:50% 50% 50% 0;transform:rotate(-45deg);box-shadow:0 2px 8px rgba(0,0,0,0.4)"></div>`,
                  iconSize: [22, 22], iconAnchor: [11, 22], className: ''
                })}
              />
            </MapContainer>
          </div>
        )}

        <div className="space-y-3 mt-4">
          {!submitResult.offline && (
            <Link
              to={`/reports/${submitResult.reportId}`}
              className="flex items-center justify-between w-full bg-undp-blue text-white rounded-xl px-5 py-4 font-semibold hover:bg-blue-700 transition-colors"
            >
              <span>View your report</span>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          )}

          {/* Share button */}
          <button
            onClick={() => shareReport(submitResult.reportId)}
            className="w-full flex items-center justify-center gap-2 border-2 border-undp-blue text-undp-blue rounded-xl px-5 py-4 font-semibold hover:bg-undp-blue/5 transition-colors"
          >
            {shareCopied ? (
              <>
                <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span className="text-green-600 font-bold">Copied!</span>
              </>
            ) : (
              <>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                </svg>
                <span>Share this report</span>
              </>
            )}
          </button>

          <button
            onClick={handleReset}
            className="w-full border-2 border-gray-300 text-gray-700 rounded-xl px-5 py-4 font-semibold hover:border-undp-blue hover:text-undp-blue transition-colors"
          >
            {t('submit_another')}
          </button>
        </div>

        <p className="text-center text-xs text-gray-400 mt-6">{t('data_notice')}</p>
      </div>
    )
  }

  return (
    <div className="max-w-lg mx-auto">
      <ToastContainer />

      {/* Progress bar */}
      <div className="px-4 pt-4 pb-2">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            {onModeChange && step === 1 && (
              <button onClick={onModeChange} className="text-xs text-gray-400 hover:text-undp-blue transition-colors" aria-label="Change mode">
                ← Mode
              </button>
            )}
            <span className="text-sm font-semibold text-undp-blue">
              {t('step')} {step} {t('of')} {TOTAL_STEPS}
            </span>
            {quickMode && <span className="text-[10px] bg-undp-blue/10 text-undp-blue px-1.5 py-0.5 rounded-full font-bold">Quick</span>}
          </div>
          <span className="text-sm font-bold text-gray-700">
            {t((quickMode ? STEP_TITLES_Q : STEP_TITLES)[step - 1])}
          </span>
        </div>
        <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-undp-blue rounded-full transition-all duration-500"
            style={{ width: `${(step / TOTAL_STEPS) * 100}%` }}
            role="progressbar"
            aria-valuenow={step}
            aria-valuemin={1}
            aria-valuemax={TOTAL_STEPS}
          />
        </div>

        {/* Step dots with connecting line */}
        <div className="relative flex justify-between mt-3 items-start">
          {/* Progress line behind dots */}
          <div className="absolute top-[7px] left-0 right-0 h-0.5 bg-gray-200 z-0">
            <div
              className="h-full bg-undp-blue transition-all duration-500"
              style={{ width: `${((step - 1) / (TOTAL_STEPS - 1)) * 100}%` }}
            />
          </div>

          {Array.from({ length: TOTAL_STEPS }, (_, i) => {
            const icons = quickMode ? STEP_ICONS_Q : STEP_ICONS
            const isCompleted = i + 1 < step
            const isActive = i + 1 === step
            return (
              <div key={i} className="relative z-10 flex flex-col items-center gap-1">
                <div
                  className={`flex items-center justify-center rounded-full transition-all duration-300 font-bold ${
                    isCompleted
                      ? 'w-3.5 h-3.5 bg-undp-teal text-white text-[8px]'
                      : isActive
                        ? 'w-4 h-4 bg-undp-blue text-white text-[9px] shadow-md shadow-undp-blue/30'
                        : 'w-3 h-3 bg-gray-300 text-gray-400 text-[7px]'
                  }`}
                  aria-hidden="true"
                >
                  {isCompleted ? '✓' : ''}
                </div>
                <span className={`text-[9px] leading-tight select-none ${
                  isActive ? 'text-undp-blue font-semibold' : isCompleted ? 'text-undp-teal' : 'text-gray-400'
                }`}>
                  {icons[i]}
                </span>
              </div>
            )
          })}
        </div>
      </div>

      {/* Voice report modal */}
      {showVoiceModal && (
        <VoiceReportModal
          onFill={handleVoiceFill}
          onClose={() => setShowVoiceModal(false)}
        />
      )}

      {/* Step content with slide transition */}
      <div className={`px-4 py-3 ${transitionClass}`}>
        {/* Voice entry point — only shown on step 1 before the user has pre-filled via voice */}
        {step === 1 && (
          <button
            type="button"
            onClick={() => setShowVoiceModal(true)}
            className="w-full flex items-center justify-center gap-2 mb-4 py-3 rounded-2xl border-2 border-dashed border-undp-blue/40 text-undp-blue font-semibold text-sm hover:bg-undp-blue/5 active:scale-95 transition-all"
          >
            <span className="text-xl" aria-hidden="true">🎙️</span>
            <span>{t('voice_report')}</span>
            {(form.damageLevel || form.crisisType || form.infraType) && (
              <span className="ml-1 px-1.5 py-0.5 bg-green-100 text-green-700 rounded-full text-xs font-bold">✓ {t('voice_filled')}</span>
            )}
          </button>
        )}

        {step === 1 && (
          <PhotoStep
            value={form.photo}
            onPhotoChange={(file) => updateForm('photo', file)}
            onAdditionalPhotosChange={(files) => updateForm('additionalPhotos', files)}
            onAiSuggestion={handleAiSuggestion}
            error={errors.photo}
          />
        )}
        {step === 2 && (
          <LocationStep
            value={form.location}
            onChange={(loc) => updateForm('location', loc)}
            error={errors.location}
          />
        )}
        {step === 3 && quickMode && (
          <QuickDamageStep
            damageLevel={form.damageLevel}
            crisisType={form.crisisType}
            onDamageChange={(level) => updateForm('damageLevel', level)}
            onCrisisChange={(type) => updateForm('crisisType', type)}
            errors={{ damageLevel: errors.damageLevel, crisisType: errors.crisisType }}
          />
        )}
        {step === 3 && !quickMode && (
          <DamageStep
            value={form.damageLevel}
            onChange={(level) => updateForm('damageLevel', level)}
            error={errors.damageLevel}
          />
        )}
        {step === 4 && (
          <InfraStep
            value={{ infraType: form.infraType, infraName: form.infraName, crisisType: form.crisisType, debris: form.debris }}
            onChange={(updates) => setForm((prev) => ({ ...prev, ...updates }))}
            errors={{ infraType: errors.infraType, crisisType: errors.crisisType }}
          />
        )}
        {step === 5 && (
          <AdditionalStep
            value={{ electricityStatus: form.electricityStatus, healthStatus: form.healthStatus, pressingNeeds: form.pressingNeeds, description: form.description }}
            onChange={(updates) => setForm((prev) => ({ ...prev, ...updates }))}
          />
        )}

        {errors.submit && (
          <div role="alert" className="mt-4 bg-red-50 border border-undp-red rounded-xl p-3 text-undp-red text-sm font-medium">
            {errors.submit}
          </div>
        )}
      </div>

      {/* Navigation buttons */}
      <div className="sticky bottom-0 bg-white border-t border-gray-100 px-4 py-4 flex gap-3">
        {step > 1 && (
          <button
            type="button"
            onClick={handleBack}
            className="btn-secondary flex-none px-5"
            disabled={isSubmitting}
          >
            ← {t('back')}
          </button>
        )}

        {step < TOTAL_STEPS ? (
          <button
            type="button"
            onClick={handleNext}
            className="btn-primary flex-1"
          >
            {t('next')} →
          </button>
        ) : (
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="btn-success flex-1 flex items-center justify-center gap-2"
          >
            {isSubmitting ? (
              <>
                <LoadingSpinner size="sm" color="white" />
                <span>{t('submitting')}</span>
              </>
            ) : (
              <>
                <span aria-hidden="true">📤</span>
                <span>{t('submit')}</span>
              </>
            )}
          </button>
        )}
      </div>
    </div>
  )
}
