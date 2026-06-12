import React, { useState } from 'react'
import DashboardLogin from '../components/Auth/DashboardLogin'
import DashboardComponent from '../components/Dashboard'

export default function Dashboard() {
  const [apiKey, setApiKey] = useState(() => sessionStorage.getItem('dashboard_key') || '')

  if (!apiKey) {
    return <DashboardLogin onAuthenticated={setApiKey} />
  }

  return <DashboardComponent />
}
