import { useState, useEffect, FormEvent } from 'react'
import { useAuth } from '../context/AuthContext'
import { Link } from 'react-router-dom'

interface Vehicle {
  id: string
  license_plate: string
  make: string
  model: string
  color: string
  year: number
}

export default function VehicleRegistration() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [showForm, setShowForm] = useState(false)
  const [licensePlate, setLicensePlate] = useState('')
  const [make, setMake] = useState('')
  const [model, setModel] = useState('')
  const [color, setColor] = useState('')
  const [year, setYear] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)

  const { token, logout } = useAuth()

  useEffect(() => {
    loadVehicles()
  }, [])

  const loadVehicles = async () => {
    try {
      const response = await fetch('/api/vehicles', {
        headers: { Authorization: `Bearer ${token}` },
      })

      if (response.status === 401) {
        logout()
        return
      }

      if (!response.ok) throw new Error('Failed to load vehicles')

      const data = await response.json()
      setVehicles(data)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load vehicles')
    }
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    setLoading(true)

    try {
      const response = await fetch('/api/vehicles', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          license_plate: licensePlate,
          make,
          model,
          color,
          year: parseInt(year),
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.detail || 'Registration failed')
      }

      setSuccess('Vehicle registered successfully!')
      setLicensePlate('')
      setMake('')
      setModel('')
      setColor('')
      setYear('')
      setShowForm(false)
      loadVehicles()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Registration failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="dashboard-container">
      <nav className="dashboard-nav">
        <h2>Oktawave Parking</h2>
        <div className="nav-links">
          <Link to="/dashboard">Dashboard</Link>
          <Link to="/vehicles">My Vehicles</Link>
          <Link to="/reservations">Book Parking</Link>
          <button onClick={logout} className="btn-secondary">
            Logout
          </button>
        </div>
      </nav>

      <div className="dashboard-content">
        <div className="page-header">
          <h1>My Vehicles</h1>
          <button onClick={() => setShowForm(!showForm)} className="btn-primary">
            {showForm ? 'Cancel' : 'Register New Vehicle'}
          </button>
        </div>

        {error && <div className="error-message">{error}</div>}
        {success && <div className="success-message">{success}</div>}

        {showForm && (
          <div className="form-card">
            <h3>Register New Vehicle</h3>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label htmlFor="licensePlate">License Plate</label>
                <input
                  id="licensePlate"
                  type="text"
                  value={licensePlate}
                  onChange={(e) => setLicensePlate(e.target.value)}
                  required
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="make">Make</label>
                  <input
                    id="make"
                    type="text"
                    value={make}
                    onChange={(e) => setMake(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="model">Model</label>
                  <input
                    id="model"
                    type="text"
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="color">Color</label>
                  <input
                    id="color"
                    type="text"
                    value={color}
                    onChange={(e) => setColor(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="year">Year</label>
                  <input
                    id="year"
                    type="number"
                    value={year}
                    onChange={(e) => setYear(e.target.value)}
                    required
                    min="1900"
                    max="2100"
                  />
                </div>
              </div>

              <button type="submit" disabled={loading} className="btn-primary">
                {loading ? 'Registering...' : 'Register Vehicle'}
              </button>
            </form>
          </div>
        )}

        <div className="vehicles-grid">
          {vehicles.length === 0 ? (
            <p>No vehicles registered yet.</p>
          ) : (
            vehicles.map((vehicle) => (
              <div key={vehicle.id} className="vehicle-card">
                <h3>{vehicle.license_plate}</h3>
                <p>
                  {vehicle.year} {vehicle.make} {vehicle.model}
                </p>
                <p className="vehicle-color">Color: {vehicle.color}</p>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
