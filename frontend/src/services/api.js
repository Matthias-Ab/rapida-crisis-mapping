import axios from 'axios'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api/v1',
  timeout: 30000
})

api.interceptors.request.use(
  (config) => config,
  (error) => Promise.reject(error)
)

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (!err.response) {
      err.offline = true
      err.userMessage = 'Network error. Report saved offline.'
    } else if (err.response.status >= 500) {
      err.userMessage = 'Server error. Please try again.'
    } else if (err.response.status === 401) {
      err.userMessage = 'Unauthorized. Check your API key.'
    } else if (err.response.status === 413) {
      err.userMessage = 'File too large. Please use a smaller photo.'
    }
    return Promise.reject(err)
  }
)

function getDashboardKey() {
  return sessionStorage.getItem('dashboard_key') || import.meta.env.VITE_DASHBOARD_KEY || ''
}

export const submitReport = (formData) =>
  api.post('/reports', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  })

export const getReports = (params = {}) =>
  api.get('/reports', {
    params,
    headers: { 'X-API-Key': getDashboardKey() }
  })

export const getReport = (id) => api.get(`/reports/${id}`)

export const getAnalytics = () =>
  api.get('/analytics', {
    headers: { 'X-API-Key': getDashboardKey() }
  })

export const exportCSV = (params = {}) =>
  api.get('/export/csv', {
    params,
    headers: { 'X-API-Key': getDashboardKey() },
    responseType: 'blob'
  })

export const exportGeoJSON = (params = {}) =>
  api.get('/export/geojson', {
    params,
    headers: { 'X-API-Key': getDashboardKey() },
    responseType: 'blob'
  })

export const flagReport = (id, sessionId) =>
  api.post(`/reports/${id}/flag`, { session_id: sessionId })

export const patchReport = (id, data) => api.patch(`/reports/${id}`, data, {
  headers: { 'X-API-Key': getDashboardKey() }
})

export const getTimeseries = (hours = 48) => api.get('/analytics/timeseries', { params: { hours } })

export const getTopAreas = (limit = 5) => api.get('/analytics/top-areas', { params: { limit } })

export const getBuildingSummary = () => api.get('/analytics/buildings', {
  headers: { 'X-API-Key': getDashboardKey() }
})

export default api
