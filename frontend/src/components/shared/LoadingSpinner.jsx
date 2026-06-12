import React from 'react'

export default function LoadingSpinner({ label, size = 'md', color = 'undp-blue', className = '' }) {
  const sizes = {
    sm: 'w-5 h-5 border-2',
    md: 'w-8 h-8 border-3',
    lg: 'w-12 h-12 border-4',
    xl: 'w-16 h-16 border-4'
  }

  return (
    <div className={`flex flex-col items-center justify-center gap-3 ${className}`} role="status">
      <div
        className={`${sizes[size]} rounded-full border-gray-200 animate-spin`}
        style={{
          borderTopColor: color === 'undp-blue' ? '#0468B1' :
            color === 'white' ? '#ffffff' :
            color === 'undp-teal' ? '#00A19D' : '#0468B1'
        }}
        aria-hidden="true"
      />
      {label && (
        <span className="text-sm font-medium text-gray-600 animate-pulse">{label}</span>
      )}
      <span className="sr-only">{label || 'Loading...'}</span>
    </div>
  )
}
