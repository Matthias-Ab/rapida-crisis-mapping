import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import LocationPicker from '../Map/LocationPicker'

export default function LocationStep({ value, onChange, error }) {
  const { t } = useTranslation()
  const [w3w, setW3w] = useState(value?.what3words || '')

  function handleLocationChange(lat, lng, buildingId, locationText) {
    onChange({ lat, lng, buildingId, locationText, what3words: w3w })
  }

  function handleW3wChange(e) {
    const val = e.target.value
    setW3w(val)
    if (value?.lat) onChange({ ...value, what3words: val })
  }

  return (
    <div className="space-y-4">
      <LocationPicker
        initialPosition={value?.lat ? [value.lat, value.lng] : null}
        onLocationChange={handleLocationChange}
      />

      {value?.lat && (
        <div className="bg-gray-50 rounded-xl p-3 text-xs text-gray-500 font-mono">
          {value.lat.toFixed(6)}, {value.lng.toFixed(6)}
          {value.buildingId && (
            <span className="ml-2 text-undp-blue">OSM: {value.buildingId}</span>
          )}
        </div>
      )}

      {/* what3words — optional precision address */}
      <div>
        <label htmlFor="what3words" className="label-text">
          what3words <span className="font-normal text-gray-400">(optional)</span>
        </label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-undp-teal font-bold text-sm select-none">///</span>
          <input
            id="what3words"
            type="text"
            value={w3w}
            onChange={handleW3wChange}
            placeholder="word.word.word"
            className="input-field pl-9"
            autoComplete="off"
            spellCheck={false}
          />
        </div>
        <p className="text-xs text-gray-400 mt-1">
          Three-word address from <a href="https://what3words.com" target="_blank" rel="noopener noreferrer" className="underline hover:text-undp-blue">what3words.com</a>
        </p>
      </div>

      {error && (
        <div role="alert" className="bg-red-50 border border-undp-red rounded-xl p-3 text-undp-red text-sm font-medium">
          {error}
        </div>
      )}
    </div>
  )
}
