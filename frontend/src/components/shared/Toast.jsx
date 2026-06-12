import React, { useEffect, useRef } from 'react'
import ReactDOM from 'react-dom'

const ICONS = {
  success: '✅',
  error: '❌',
  info: 'ℹ️',
  badge: '🏆'
}

const BG = {
  success: 'bg-undp-green',
  error: 'bg-undp-red',
  info: 'bg-undp-blue',
  badge: 'bg-purple-600'
}

export default function Toast({ message, type = 'info', onClose }) {
  const timerRef = useRef(null)

  useEffect(() => {
    timerRef.current = setTimeout(() => {
      onClose?.()
    }, 4000)
    return () => clearTimeout(timerRef.current)
  }, [onClose])

  const content = (
    <div
      role="alert"
      aria-live="assertive"
      className={`fixed top-4 left-1/2 -translate-x-1/2 z-[9999] max-w-sm w-[90vw] px-5 py-4 rounded-2xl shadow-2xl text-white flex items-start gap-3 animate-slide-down ${BG[type] || BG.info}`}
      style={{ animation: 'slideDown 0.3s ease-out' }}
    >
      <span className="text-2xl flex-shrink-0" aria-hidden="true">{ICONS[type] || ICONS.info}</span>
      <div className="flex-1 min-w-0">
        {type === 'badge' && (
          <div className="font-bold text-sm uppercase tracking-wide mb-0.5 opacity-80">Badge Earned!</div>
        )}
        <p className="text-base font-semibold leading-snug">{message}</p>
      </div>
      <button
        onClick={onClose}
        className="flex-shrink-0 text-white/80 hover:text-white text-xl leading-none ml-1"
        aria-label="Close notification"
      >
        ×
      </button>
    </div>
  )

  return ReactDOM.createPortal(content, document.body)
}

// Toast container for managing multiple toasts
export function useToast() {
  const [toasts, setToasts] = React.useState([])

  const addToast = React.useCallback((message, type = 'info') => {
    const id = Date.now()
    setToasts((prev) => [...prev, { id, message, type }])
    return id
  }, [])

  const removeToast = React.useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const ToastContainer = React.useCallback(() => (
    <>
      {toasts.map((toast, i) => (
        <div
          key={toast.id}
          style={{ transform: `translateY(${i * 70}px)` }}
          className="transition-transform"
        >
          <Toast
            message={toast.message}
            type={toast.type}
            onClose={() => removeToast(toast.id)}
          />
        </div>
      ))}
    </>
  ), [toasts, removeToast])

  return { addToast, removeToast, ToastContainer }
}
