import React, { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

const DAMAGE_COLORS = {
  complete: { bg: '#D12800', text: 'white', label: 'Complete' },
  partial:  { bg: '#F5A623', text: 'white', label: 'Partial'  },
  none:     { bg: '#00833E', text: 'white', label: 'None'     },
}
const CRISIS_ICONS = {
  earthquake:'🌍', flood:'🌊', tsunami:'🌊', hurricane_cyclone:'🌀',
  wildfire:'🔥', explosion:'💥', chemical_incident:'☣️', conflict:'⚔️', civil_unrest:'🚧'
}

function ApiKeyGate({ children }) {
  const [key, setKey] = useState(() => sessionStorage.getItem('dashboard_key') || '')
  const [input, setInput] = useState('')
  if (key) return children
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
      <div className="bg-white rounded-2xl shadow-lg p-8 max-w-sm w-full text-center">
        <div className="text-4xl mb-4">🔒</div>
        <h2 className="font-bold text-lg mb-1">Analyst Access Required</h2>
        <p className="text-sm text-gray-500 mb-4">Enter your dashboard API key to view the situation report.</p>
        <input type="password" value={input} onChange={e => setInput(e.target.value)}
          placeholder="API key" className="w-full border rounded-xl px-4 py-3 mb-3 text-sm focus:outline-none focus:ring-2 focus:ring-undp-blue" />
        <button onClick={() => { sessionStorage.setItem('dashboard_key', input); setKey(input) }}
          className="w-full bg-undp-blue text-white rounded-xl py-3 font-semibold">Access Report</button>
      </div>
    </div>
  )
}

export default function SituationReport() {
  const navigate = useNavigate()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const apiKey = sessionStorage.getItem('dashboard_key') || ''

  useEffect(() => {
    if (!apiKey) return
    fetch('/api/v1/analytics/situation-report', {
      headers: { 'X-API-Key': apiKey }
    })
      .then(r => { if (!r.ok) throw new Error('Unauthorized'); return r.json() })
      .then(setData)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [apiKey])

  if (!apiKey) return <ApiKeyGate><SituationReport /></ApiKeyGate>

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Screen-only controls */}
      <div className="print:hidden bg-undp-blue text-white px-6 py-3 flex items-center justify-between sticky top-0 z-50 shadow">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="p-2 rounded-lg hover:bg-white/20">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/>
            </svg>
          </button>
          <h1 className="font-bold">Situation Report</h1>
        </div>
        <button
          onClick={() => window.print()}
          className="flex items-center gap-2 bg-white text-undp-blue px-4 py-2 rounded-lg font-semibold text-sm hover:bg-blue-50 transition-colors"
        >
          🖨️ Print / Save PDF
        </button>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-24">
          <div className="animate-spin w-10 h-10 border-4 border-undp-blue border-t-transparent rounded-full"/>
        </div>
      )}
      {error && (
        <div className="flex items-center justify-center py-24 text-center">
          <div><div className="text-4xl mb-3">⚠️</div><p className="text-gray-600">{error}</p></div>
        </div>
      )}

      {data && (
        <div className="max-w-4xl mx-auto px-6 py-8 print:px-0 print:py-0">

          {/* Report header */}
          <div className="bg-undp-blue text-white rounded-2xl p-6 mb-6 print:rounded-none">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-blue-200 text-xs font-bold uppercase tracking-widest mb-1">RAPIDA — UNDP Crisis Mapping</p>
                <h1 className="text-2xl font-black mb-1">Crisis Situation Report</h1>
                <p className="text-blue-200 text-sm">
                  Generated: {new Date(data.generated_at).toLocaleString('en-US', {
                    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
                    hour: '2-digit', minute: '2-digit', timeZoneName: 'short'
                  })}
                </p>
              </div>
              <div className="text-right">
                <p className="text-3xl font-black">{data.analytics.total_reports.toLocaleString()}</p>
                <p className="text-blue-200 text-xs">Total Reports</p>
              </div>
            </div>
          </div>

          {/* Key metrics row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            {[
              { label: 'Reports (24h)', value: data.analytics.reports_last_24h, icon: '📅', color: 'text-undp-teal' },
              { label: 'Reports (1h)',  value: data.analytics.reports_last_1h,  icon: '⏱', color: 'text-undp-amber' },
              { label: 'Buildings Affected', value: data.analytics.unique_buildings_affected, icon: '🏢', color: 'text-undp-blue' },
              { label: 'Trend (3h)',
                value: data.trends
                  ? (data.trends.change_pct > 0 ? `↑${data.trends.change_pct}%` : data.trends.change_pct < 0 ? `↓${Math.abs(data.trends.change_pct)}%` : '→ Stable')
                  : '—',
                icon: '📈',
                color: data.trends?.change_pct > 0 ? 'text-undp-red' : 'text-undp-green'
              }
            ].map((m, i) => (
              <div key={i} className="bg-white rounded-xl border border-gray-100 p-4 text-center">
                <p className="text-2xl mb-1">{m.icon}</p>
                <p className={`text-xl font-black ${m.color}`}>{typeof m.value === 'number' ? m.value.toLocaleString() : m.value}</p>
                <p className="text-xs text-gray-500 mt-0.5">{m.label}</p>
              </div>
            ))}
          </div>

          {/* Two columns: damage breakdown + crisis types */}
          <div className="grid md:grid-cols-2 gap-4 mb-6">
            {/* Damage breakdown */}
            <div className="bg-white rounded-xl border border-gray-100 p-4">
              <h2 className="text-sm font-bold text-gray-700 mb-3">Damage Assessment</h2>
              {Object.entries(data.analytics.by_damage_level || {}).map(([level, count]) => {
                const cfg = DAMAGE_COLORS[level] || { bg: '#999', text: 'white', label: level }
                const pct = data.analytics.total_reports > 0
                  ? Math.round((count / data.analytics.total_reports) * 100) : 0
                return (
                  <div key={level} className="mb-2">
                    <div className="flex justify-between text-xs mb-1">
                      <span className="font-medium capitalize">{cfg.label}</span>
                      <span className="text-gray-500">{count} ({pct}%)</span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: cfg.bg }} />
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Crisis type breakdown */}
            <div className="bg-white rounded-xl border border-gray-100 p-4">
              <h2 className="text-sm font-bold text-gray-700 mb-3">Crisis Types</h2>
              {Object.entries(data.analytics.by_crisis_type || {})
                .sort((a, b) => b[1] - a[1])
                .slice(0, 6)
                .map(([type, count]) => (
                  <div key={type} className="flex items-center justify-between py-1 border-b border-gray-50 last:border-0">
                    <span className="text-sm flex items-center gap-1.5">
                      <span>{CRISIS_ICONS[type] || '⚠️'}</span>
                      <span className="capitalize">{type.replace(/_/g,' ')}</span>
                    </span>
                    <span className="text-sm font-bold text-gray-700">{count}</span>
                  </div>
                ))}
            </div>
          </div>

          {/* Top affected areas */}
          <div className="bg-white rounded-xl border border-gray-100 p-4 mb-6">
            <h2 className="text-sm font-bold text-gray-700 mb-3">Top Affected Areas (last 7 days)</h2>
            <table className="w-full text-xs">
              <thead>
                <tr className="text-gray-400 border-b border-gray-100">
                  <th className="text-left pb-2">Area</th>
                  <th className="text-right pb-2">Reports</th>
                  <th className="text-right pb-2">Severe</th>
                  <th className="text-right pb-2">Severity %</th>
                </tr>
              </thead>
              <tbody>
                {(data.top_areas || []).map((area, i) => (
                  <tr key={i} className="border-b border-gray-50 last:border-0">
                    <td className="py-1.5 font-medium">{area.location_text}</td>
                    <td className="py-1.5 text-right">{area.report_count}</td>
                    <td className="py-1.5 text-right text-undp-red font-bold">{area.complete_count}</td>
                    <td className="py-1.5 text-right">
                      <span className={`px-1.5 py-0.5 rounded font-bold ${
                        (area.complete_count/area.report_count) > 0.5 ? 'bg-red-100 text-undp-red' :
                        (area.complete_count/area.report_count) > 0.2 ? 'bg-amber-100 text-undp-amber' : 'bg-green-100 text-undp-green'
                      }`}>
                        {area.report_count > 0 ? Math.round((area.complete_count/area.report_count)*100) : 0}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Priority response queue */}
          <div className="bg-white rounded-xl border border-gray-100 p-4 mb-6">
            <h2 className="text-sm font-bold text-gray-700 mb-1">Priority Response Queue</h2>
            <p className="text-xs text-gray-400 mb-3">Ranked by damage severity × infrastructure criticality × recency</p>
            <div className="space-y-2">
              {(data.priority_reports || []).slice(0, 10).map((r, i) => (
                <div key={r.id} className="flex items-start gap-3 p-2 rounded-lg bg-gray-50">
                  <span className="text-xs font-black text-gray-400 w-4 pt-0.5">{i+1}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${
                        r.damage_level === 'complete' ? 'bg-red-100 text-undp-red' :
                        r.damage_level === 'partial'  ? 'bg-amber-100 text-undp-amber' : 'bg-green-100 text-undp-green'
                      }`}>{r.damage_level}</span>
                      <span className="text-xs text-gray-500 capitalize">{(r.infra_type||'').replace(/_/g,' ')}</span>
                      <span className="text-[10px] text-gray-400">{(r.crisis_type||'').replace(/_/g,' ')}</span>
                    </div>
                    <p className="text-xs text-gray-600 truncate mt-0.5">{r.location_text || r.description || '—'}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-xs font-black text-undp-blue">{r.priority_score}</p>
                    <p className="text-[9px] text-gray-400">score</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Footer */}
          <div className="text-center text-xs text-gray-400 py-4 border-t border-gray-100">
            <p>RAPIDA Community Crisis Reporting Platform · UNDP/InnoCentive Crisis Mapping Challenge</p>
            <p className="mt-1">This report is auto-generated from community-submitted field reports. All data is anonymised.</p>
          </div>
        </div>
      )}

      {/* Print styles */}
      <style>{`
        @media print {
          body { background: white; }
          .print\\:hidden { display: none !important; }
          @page { margin: 1cm; }
        }
      `}</style>
    </div>
  )
}
