import { useEffect, useState } from 'react'

type HealthResponse = {
  frontend: string
  backend: string
  database: string
  databaseName?: string | null
}

const defaultHealth: HealthResponse = {
  frontend: 'active',
  backend: 'connected',
  database: 'connected',
  databaseName: null,
}

function App() {
  const [health, setHealth] = useState<HealthResponse>(defaultHealth)
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')

  useEffect(() => {
    const loadHealth = async () => {
      try {
        const response = await fetch('/api/health')
        if (!response.ok) {
          throw new Error('Health request failed')
        }

        const data = (await response.json()) as HealthResponse
        setHealth({ ...defaultHealth, ...data })
        setStatus('ready')
      } catch {
        setHealth({
          frontend: 'active',
          backend: 'disconnected',
          database: 'disconnected',
          databaseName: null,
        })
        setStatus('error')
      }
    }

    void loadHealth()
  }, [])

  return (
    <main className="page">
      <h1>Boilerplate</h1>
      <p>Greenfield dev starter page.</p>

      <h2>Health</h2>
      <p>Status: {status}</p>

      <ul>
        <li>Frontend: {health.frontend}</li>
        <li>Backend: {health.backend}</li>
        <li>Database: {health.database}</li>
      </ul>

      <p>{health.databaseName ? `DB: ${health.databaseName}` : 'DB: not set'}</p>
    </main>
  )
}

export default App
