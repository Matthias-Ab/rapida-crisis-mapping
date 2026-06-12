import React from 'react'
import { useTranslation } from 'react-i18next'
import LocationPicker from '../Map/LocationPicker'

export default function LocationStep({ value, onChange, error }) {
  const { t } = useTranslation()

  return (
    <div className="space-y-4">
      <LocationPicker
        initialPosition={value?.lat ? [value.lat, value.lng] : null}
        onLocationChange={(lat, lng, buildingId, locationText) => {
          onChange({ lat, lng, buildingId, locationText })
        }}
      />

      {value?.lat && (
        <div className="bg-gray-50 rounded-xl p-3 text-xs text-gray-500 font-mono">
          {value.lat.toFixed(6)}, {value.lng.toFixed(6)}
          {value.buildingId && (
            <span className="ml-2 text-undp-blue">OSM: {value.buildingId}</span>
          )}
        </div>
      )}

      {error && (
        <div role="alert" className="bg-red-50 border border-undp-red rounded-xl p-3 text-undp-red text-sm font-medium">
          {error}
        </div>
      )}
    </div>
  )
}
