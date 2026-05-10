import { useState, useEffect, FormEvent } from 'react'
import { useAuth } from '../context/AuthContext'
import { Link } from 'react-router-dom'

interface ParkingSpot {
  id: string
  spot_number: string
  is_available: boolean
  location: string
  site_name: string
}

interface Vehicle {
  id: string
  license_plate: string
  make: string
  model: string
}

export default function ParkingReservation() {
  const [spots, setSpots] = useState<ParkingSpot[]>([])
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [selectedSpot, setSelectedSpot] = useState('')
  const [selectedVehicle, setSelectedVehicle] = useState('')
  const [startTime, setStartTime] = useState('')
  const [endTime, setEndTime] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)

  const { token, logout } = useAuth()

  useEffect(() => {
    loadSpots()
    loadVehicles()
  }, [])

  const loadSpots = async () => {
    try {
      const response = await fetch('/api/spots', {
        headers: { Authorization: `Bearer ${token}` },
      })

      if (response.status === 401) {
        logout()
        return
      }

      if (!response.ok) throw new Error('Failed to load spots')

      const data = await response.json()
      setSpots(data)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load spots')
    }
  }

  const loadVehicles = async () => {
    try {
      const response = await fetch('/api/vehicles', {
        headers: { Authorization: `Bearer ${token}` },
      })

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

    if (vehicles.length === 0) {
      setError('Please register a vehicle first')
      setLoading(false)
      return
    }

    try {
      const response = await fetch('/api/reservations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          spot_id: selectedSpot,
          vehicle_id: selectedVehicle,
          start_time: new Date(startTime).toISOString(),
          end_time: new Date(endTime).toISOString(),
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.detail || 'Reservation failed')
      }

      setSuccess('Parking spot reserved successfully!')
      setSelectedSpot('')
      setSelectedVehicle('')
      setStartTime('')
      setEndTime('')
      loadSpots()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Reservation failed')
    } finally {
      setLoading(false)
    }
  }

  const availableSpots = spots.filter((spot) => spot.is_available)
  const occupiedSpots = spots.filter((spot) => !spot.is_available)

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
        <h1>Book Parking Spot</h1>
        <p className="subtitle">Select an available spot and reserve your parking</p>

        {error && <div className="error-message">{error}</div>}
        {success && <div className="success-message">{success}</div>}

        {vehicles.length === 0 && (
          <div className="warning-message">
            You need to <Link to="/vehicles">register a vehicle</Link> before making a
            reservation.
          </div>
        )}

        <div className="reservation-layout">
          <div className="spots-section">
            <h3>
              Available Spots ({availableSpots.length}/{spots.length})
            </h3>
            <div className="spots-grid">
              {availableSpots.map((spot) => (
                <div
                  key={spot.id}
                  className={`spot-card ${
                    selectedSpot === spot.id ? 'selected' : ''
                  }`}
                  onClick={() => setSelectedSpot(spot.id)}
                >
                  <h4>{spot.spot_number}</h4>
                  <p>{spot.location}</p>
                  <p className="spot-site">{spot.site_name}</p>
                </div>
              ))}
            </div>

            {occupiedSpots.length > 0 && (
              <>
                <h3 className="occupied-title">Occupied Spots</h3>
                <div className="spots-grid">
                  {occupiedSpots.map((spot) => (
                    <div key={spot.id} className="spot-card occupied">
                      <h4>{spot.spot_number}</h4>
                      <p>{spot.location}</p>
                      <p className="spot-status">Occupied</p>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

          <div className="reservation-form-section">
            <div className="form-card">
              <h3>Reserve Your Spot</h3>
              <form onSubmit={handleSubmit}>
                <div className="form-group">
                  <label htmlFor="vehicle">Select Vehicle</label>
                  <select
                    id="vehicle"
                    value={selectedVehicle}
                    onChange={(e) => setSelectedVehicle(e.target.value)}
                    required
                    disabled={vehicles.length === 0}
                  >
                    <option value="">Choose a vehicle</option>
                    {vehicles.map((vehicle) => (
                      <option key={vehicle.id} value={vehicle.id}>
                        {vehicle.license_plate} - {vehicle.make} {vehicle.model}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label htmlFor="startTime">Start Time</label>
                  <input
                    id="startTime"
                    type="datetime-local"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="endTime">End Time</label>
                  <input
                    id="endTime"
                    type="datetime-local"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    required
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading || !selectedSpot || vehicles.length === 0}
                  className="btn-primary"
                >
                  {loading ? 'Reserving...' : 'Reserve Spot'}
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
