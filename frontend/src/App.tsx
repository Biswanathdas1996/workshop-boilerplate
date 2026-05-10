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

  const items = [
    { label: 'Frontend', value: health.frontend },
    { label: 'Backend', value: health.backend },
    { label: 'Database', value: health.database },
  ]

  return (
    <main className="shell">
      <section className="hero">
        <p className="eyebrow">Boilerplate App</p>
        <h1>Full-stack starter with a live status screen.</h1>
        <p className="lede">
          React on the front, Python on the back, and MongoDB wired through a simple health check.
        </p>
      </section>

      <section className="panel">
        <div className="panel-header">
          <div>
            <h2>System Status</h2>
            <p>
              {status === 'loading' && 'Checking services...'}
              {status === 'ready' && 'All services are responding.'}
              {status === 'error' && 'Frontend loaded, but the API or database check failed.'}
            </p>
          </div>
          <span className={`badge badge-${status}`}>{status}</span>
        </div>

        <div className="status-grid">
          {items.map((item) => (
            <article key={item.label} className="status-card">
              <span>{item.label}</span>
              <strong>{item.value}</strong>
            </article>
          ))}
        </div>

        <div className="footer-note">
          {health.databaseName ? <span>Connected database: {health.databaseName}</span> : <span>MongoDB URI configured via environment</span>}
        </div>
      </section>
    </main>
  )
}

export default App
