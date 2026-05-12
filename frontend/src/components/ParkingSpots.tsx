import { useEffect, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'

type ParkingSpot = {
  id: string
  spot_number: string
  floor: number
  is_occupied: boolean
  reserved: boolean
}

export default function ParkingSpots() {
  const navigate = useNavigate()
  const [spots, setSpots] = useState<ParkingSpot[]>([])
  const [selectedFloor, setSelectedFloor] = useState<number | 'all'>('all')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem('token')
    if (!token) {
      navigate('/login')
      return
    }

    const fetchSpots = async () => {
      try {
        const response = await fetch('/api/parking-spots')
        if (!response.ok) throw new Error('Failed to fetch spots')

        const data = await response.json()
        setSpots(data)
      } catch {
        console.error('Failed to load parking spots')
      } finally {
        setLoading(false)
      }
    }

    void fetchSpots()

    const interval = setInterval(() => {
      fetch('/api/parking-spots')
        .then((res) => res.json())
        .then((data) => setSpots(data))
        .catch(() => {})
    }, 5000)

    return () => clearInterval(interval)
  }, [navigate])

  const filteredSpots = selectedFloor === 'all'
    ? spots
    : spots.filter((spot) => spot.floor === selectedFloor)

  const getSpotStatus = (spot: ParkingSpot) => {
    if (spot.is_occupied) return 'occupied'
    if (spot.reserved) return 'reserved'
    return 'available'
  }

  const getSpotLabel = (spot: ParkingSpot) => {
    if (spot.is_occupied) return 'Occupied'
    if (spot.reserved) return 'Reserved'
    return 'Available'
  }

  if (loading) {
    return (
      <main className="page">
        <section className="panel">
          <p>Loading parking spots...</p>
        </section>
      </main>
    )
  }

  return (
    <main className="page">
      <section className="hero">
        <div className="hero-header">
          <div>
            <p className="eyebrow">Real-time Availability</p>
            <h1>Parking Spots</h1>
            <p className="subtitle">View live parking spot availability</p>
          </div>
          <Link to="/dashboard" className="btn btn-secondary">
            Back to Dashboard
          </Link>
        </div>
      </section>

      <section className="panel">
        <div className="panel-head">
          <h2>Available Spots</h2>
          <div className="filter-group">
            <button
              onClick={() => setSelectedFloor('all')}
              className={selectedFloor === 'all' ? 'filter-btn active' : 'filter-btn'}
            >
              All Floors
            </button>
            {[1, 2, 3].map((floor) => (
              <button
                key={floor}
                onClick={() => setSelectedFloor(floor)}
                className={selectedFloor === floor ? 'filter-btn active' : 'filter-btn'}
              >
                Floor {floor}
              </button>
            ))}
          </div>
        </div>

        <div className="legend">
          <div className="legend-item">
            <span className="legend-dot available"></span>
            <span>Available</span>
          </div>
          <div className="legend-item">
            <span className="legend-dot reserved"></span>
            <span>Reserved</span>
          </div>
          <div className="legend-item">
            <span className="legend-dot occupied"></span>
            <span>Occupied</span>
          </div>
        </div>

        <div className="spots-grid">
          {filteredSpots.map((spot) => (
            <div key={spot.id} className={`spot-card spot-${getSpotStatus(spot)}`}>
              <div className="spot-number">{spot.spot_number}</div>
              <div className="spot-status">{getSpotLabel(spot)}</div>
            </div>
          ))}
        </div>
      </section>
    </main>
  )
}
