import { useEffect, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'

type Vehicle = {
  id: string
  license_plate: string
  make: string
  model: string
  color: string | null
}

export default function Vehicles() {
  const navigate = useNavigate()
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [showForm, setShowForm] = useState(false)
  const [formData, setFormData] = useState({
    license_plate: '',
    make: '',
    model: '',
    color: '',
  })
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const token = localStorage.getItem('token')
    if (!token) {
      navigate('/login')
      return
    }

    const fetchVehicles = async () => {
      try {
        const response = await fetch('/api/vehicles', {
          headers: { Authorization: `Bearer ${token}` },
        })

        if (!response.ok) throw new Error('Failed to fetch vehicles')

        const data = await response.json()
        setVehicles(data)
      } catch {
        setError('Failed to load vehicles')
      }
    }

    void fetchVehicles()
  }, [navigate])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const token = localStorage.getItem('token')

    try {
      const response = await fetch('/api/vehicles', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(formData),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.detail || 'Failed to register vehicle')
      }

      const newVehicle = await response.json()
      setVehicles([...vehicles, newVehicle])
      setShowForm(false)
      setFormData({ license_plate: '', make: '', model: '', color: '' })
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="page">
      <section className="hero">
        <div className="hero-header">
          <div>
            <p className="eyebrow">Vehicle Management</p>
            <h1>My Vehicles</h1>
            <p className="subtitle">Register and manage your vehicles</p>
          </div>
          <Link to="/dashboard" className="btn btn-secondary">
            Back to Dashboard
          </Link>
        </div>
      </section>

      <section className="panel">
        <div className="panel-head">
          <h2>Registered Vehicles</h2>
          <button onClick={() => setShowForm(!showForm)} className="btn btn-primary">
            {showForm ? 'Cancel' : 'Add Vehicle'}
          </button>
        </div>

        {showForm && (
          <form onSubmit={handleSubmit} className="form-container">
            {error && <div className="error-message">{error}</div>}

            <div className="form-group">
              <label htmlFor="license_plate">License Plate</label>
              <input
                id="license_plate"
                type="text"
                required
                value={formData.license_plate}
                onChange={(e) => setFormData({ ...formData, license_plate: e.target.value })}
                placeholder="e.g., ABC123"
              />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="make">Make</label>
                <input
                  id="make"
                  type="text"
                  required
                  value={formData.make}
                  onChange={(e) => setFormData({ ...formData, make: e.target.value })}
                  placeholder="e.g., Toyota"
                />
              </div>

              <div className="form-group">
                <label htmlFor="model">Model</label>
                <input
                  id="model"
                  type="text"
                  required
                  value={formData.model}
                  onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                  placeholder="e.g., Camry"
                />
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="color">Color (Optional)</label>
              <input
                id="color"
                type="text"
                value={formData.color}
                onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                placeholder="e.g., Blue"
              />
            </div>

            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Adding...' : 'Add Vehicle'}
            </button>
          </form>
        )}

        <div className="vehicle-grid">
          {vehicles.length === 0 ? (
            <p className="empty-state">No vehicles registered yet. Add your first vehicle!</p>
          ) : (
            vehicles.map((vehicle) => (
              <div key={vehicle.id} className="vehicle-card">
                <div className="vehicle-plate">{vehicle.license_plate}</div>
                <div className="vehicle-info">
                  <p className="vehicle-make-model">
                    {vehicle.make} {vehicle.model}
                  </p>
                  {vehicle.color && <p className="vehicle-color">{vehicle.color}</p>}
                </div>
              </div>
            ))
          )}
        </div>
      </section>
    </main>
  )
}
