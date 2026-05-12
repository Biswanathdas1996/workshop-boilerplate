import { useEffect, useMemo, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'

type Vehicle = {
  id: string
  license_plate: string
  make: string
  model: string
}

type ParkingSpot = {
  id: string
  spot_number: string
  floor: number
  is_occupied: boolean
  reserved: boolean
}

export default function Reserve() {
  const navigate = useNavigate()
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [spots, setSpots] = useState<ParkingSpot[]>([])
  const [selectedFloor, setSelectedFloor] = useState<number | 'all'>('all')
  const [formData, setFormData] = useState({
    spot_id: '',
    vehicle_id: '',
    start_time: '',
    end_time: '',
  })
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const token = localStorage.getItem('token')
    if (!token) {
      navigate('/login')
      return
    }

    const fetchData = async () => {
      try {
        const [vehiclesRes, spotsRes] = await Promise.all([
          fetch('/api/vehicles', { headers: { Authorization: `Bearer ${token}` } }),
          fetch('/api/parking-spots'),
        ])

        const vehiclesData = await vehiclesRes.json()
        const spotsData = await spotsRes.json()

        setVehicles(vehiclesData)
        setSpots(spotsData)

        if (vehiclesData.length > 0) {
          setFormData((prev) => ({ ...prev, vehicle_id: vehiclesData[0].id }))
        }
      } catch {
        setError('Failed to load data')
      }
    }

    void fetchData()
  }, [navigate])

  const floors = useMemo(() => {
    const set = new Set<number>()
    for (const sp of spots) {
      if (typeof sp.floor === 'number') set.add(sp.floor)
    }
    return [...set].sort((a, b) => a - b)
  }, [spots])

  useEffect(() => {
    if (selectedFloor !== 'all' && !floors.includes(selectedFloor)) {
      setSelectedFloor('all')
    }
  }, [floors, selectedFloor])

  const availableSpots = spots.filter(
    (spot) => !spot.is_occupied && !spot.reserved &&
    (selectedFloor === 'all' || spot.floor === selectedFloor)
  )

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    if (!formData.spot_id) {
      setError('Please select a parking spot')
      setLoading(false)
      return
    }

    if (!formData.vehicle_id) {
      setError('Please select a vehicle')
      setLoading(false)
      return
    }

    const token = localStorage.getItem('token')

    try {
      const response = await fetch('/api/reservations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          ...formData,
          start_time: new Date(formData.start_time).toISOString(),
          end_time: new Date(formData.end_time).toISOString(),
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.detail || 'Failed to create reservation')
      }

      navigate('/reservations')
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const getMinStartTime = () => {
    const now = new Date()
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset())
    return now.toISOString().slice(0, 16)
  }

  return (
    <main className="page">
      <section className="hero">
        <p className="eyebrow">Book a Spot</p>
        <h1>Reserve Parking</h1>
        <p className="subtitle">Select a spot and reserve it in advance</p>
      </section>

      <section className="panel">
        <form onSubmit={handleSubmit} className="form-container">
          {error && <div className="error-message">{error}</div>}

          {vehicles.length === 0 ? (
            <div className="warning-message">
              <p>You need to register a vehicle before making a reservation.</p>
              <Link to="/vehicles" className="btn btn-primary">
                Register Vehicle
              </Link>
            </div>
          ) : (
            <>
              <div className="form-group">
                <label htmlFor="vehicle_id">Select Vehicle</label>
                <select
                  id="vehicle_id"
                  required
                  value={formData.vehicle_id}
                  onChange={(e) => setFormData({ ...formData, vehicle_id: e.target.value })}
                >
                  {vehicles.map((vehicle) => (
                    <option key={vehicle.id} value={vehicle.id}>
                      {vehicle.license_plate} - {vehicle.make} {vehicle.model}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>Filter by Floor</label>
                <div className="filter-group">
                  <button
                    type="button"
                    onClick={() => setSelectedFloor('all')}
                    className={selectedFloor === 'all' ? 'filter-btn active' : 'filter-btn'}
                  >
                    All
                  </button>
                  {floors.map((floor) => (
                    <button
                      key={floor}
                      type="button"
                      onClick={() => setSelectedFloor(floor)}
                      className={selectedFloor === floor ? 'filter-btn active' : 'filter-btn'}
                    >
                      Floor {floor}
                    </button>
                  ))}
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="spot_id">Select Parking Spot</label>
                <select
                  id="spot_id"
                  required
                  value={formData.spot_id}
                  onChange={(e) => setFormData({ ...formData, spot_id: e.target.value })}
                >
                  <option value="">Choose a spot...</option>
                  {availableSpots.map((spot) => (
                    <option key={spot.id} value={spot.id}>
                      Spot {spot.spot_number} (Floor {spot.floor})
                    </option>
                  ))}
                </select>
                <p className="form-hint">
                  {availableSpots.length} spots available
                </p>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="start_time">Start Time</label>
                  <input
                    id="start_time"
                    type="datetime-local"
                    required
                    min={getMinStartTime()}
                    value={formData.start_time}
                    onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="end_time">End Time</label>
                  <input
                    id="end_time"
                    type="datetime-local"
                    required
                    min={formData.start_time || getMinStartTime()}
                    value={formData.end_time}
                    onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
                  />
                </div>
              </div>

              <button type="submit" className="btn btn-primary" disabled={loading}>
                {loading ? 'Creating Reservation...' : 'Reserve Spot'}
              </button>
            </>
          )}
        </form>
      </section>
    </main>
  )
}
