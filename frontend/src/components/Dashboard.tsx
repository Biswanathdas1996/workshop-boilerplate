import { useEffect, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'

type User = {
  id: string
  email: string
  name: string
}

type OccupancyStats = {
  total_spots: number
  occupied: number
  reserved: number
  available: number
  occupancy_rate: number
  by_floor: Array<{
    floor: number
    total: number
    occupied: number
    reserved: number
    available: number
    occupancy_rate: number
  }>
}

export default function Dashboard() {
  const navigate = useNavigate()
  const [user, setUser] = useState<User | null>(null)
  const [occupancy, setOccupancy] = useState<OccupancyStats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem('token')
    if (!token) {
      navigate('/login')
      return
    }

    const fetchData = async () => {
      try {
        const [userRes, occupancyRes] = await Promise.all([
          fetch('/api/auth/me', {
            headers: { Authorization: `Bearer ${token}` },
          }),
          fetch('/api/parking-spots/occupancy'),
        ])

        if (!userRes.ok) {
          throw new Error('Authentication failed')
        }

        const userData = await userRes.json()
        const occupancyData = await occupancyRes.json()

        setUser(userData)
        setOccupancy(occupancyData)
      } catch {
        localStorage.removeItem('token')
        navigate('/login')
      } finally {
        setLoading(false)
      }
    }

    void fetchData()

    const interval = setInterval(() => {
      fetch('/api/parking-spots/occupancy')
        .then((res) => res.json())
        .then((data) => setOccupancy(data))
        .catch(() => {})
    }, 5000)

    return () => clearInterval(interval)
  }, [navigate])

  const handleLogout = () => {
    localStorage.removeItem('token')
    navigate('/login')
  }

  if (loading) {
    return (
      <main className="page">
        <section className="panel">
          <p>Loading...</p>
        </section>
      </main>
    )
  }

  return (
    <main className="page">
      <section className="hero">
        <div className="hero-header">
          <div>
            <p className="eyebrow">Welcome, {user?.name}</p>
            <h1>Parking Dashboard</h1>
            <p className="subtitle">Manage your vehicles and parking reservations</p>
          </div>
          <button onClick={handleLogout} className="btn btn-secondary">
            Logout
          </button>
        </div>
      </section>

      <section className="panel">
        <div className="panel-head">
          <h2>Real-time Occupancy</h2>
          <span className="status-badge status-ready">Live</span>
        </div>

        <div className="occupancy-summary">
          <div className="occupancy-card">
            <p className="label">Total Spots</p>
            <p className="value">{occupancy?.total_spots || 0}</p>
          </div>
          <div className="occupancy-card">
            <p className="label">Available</p>
            <p className="value available">{occupancy?.available || 0}</p>
          </div>
          <div className="occupancy-card">
            <p className="label">Occupied</p>
            <p className="value occupied">{occupancy?.occupied || 0}</p>
          </div>
          <div className="occupancy-card">
            <p className="label">Reserved</p>
            <p className="value reserved">{occupancy?.reserved || 0}</p>
          </div>
        </div>

        <div className="occupancy-bar">
          <div
            className="bar-segment occupied"
            style={{ width: `${(occupancy?.occupied || 0) / (occupancy?.total_spots || 1) * 100}%` }}
          />
          <div
            className="bar-segment reserved"
            style={{ width: `${(occupancy?.reserved || 0) / (occupancy?.total_spots || 1) * 100}%` }}
          />
        </div>

        <div className="floor-stats">
          {occupancy?.by_floor.map((floor) => (
            <div key={floor.floor} className="floor-card">
              <h3>Floor {floor.floor}</h3>
              <div className="floor-data">
                <span>Available: {floor.available}</span>
                <span>Occupancy: {floor.occupancy_rate}%</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="panel">
        <h2>Quick Actions</h2>
        <div className="action-grid">
          <Link to="/vehicles" className="action-card">
            <h3>My Vehicles</h3>
            <p>Register and manage your vehicles</p>
          </Link>
          <Link to="/parking-spots" className="action-card">
            <h3>View Parking Spots</h3>
            <p>See all available parking spots</p>
          </Link>
          <Link to="/reservations" className="action-card">
            <h3>My Reservations</h3>
            <p>View and manage your bookings</p>
          </Link>
          <Link to="/reserve" className="action-card">
            <h3>Reserve a Spot</h3>
            <p>Book a parking spot in advance</p>
          </Link>
        </div>
      </section>
    </main>
  )
}
