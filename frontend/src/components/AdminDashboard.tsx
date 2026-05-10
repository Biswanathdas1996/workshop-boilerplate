import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { Link, useNavigate } from 'react-router-dom'

interface Metrics {
  total_users: number
  total_vehicles: number
  total_reservations: number
  active_reservations: number
  available_spots: number
  total_spots: number
}

interface User {
  id: string
  email: string
  full_name: string
  role: string
}

interface Vehicle {
  id: string
  license_plate: string
  make: string
  model: string
}

interface Reservation {
  id: string
  user_id: string
  spot_id: string
  start_time: string
  end_time: string
  status: string
}

export default function AdminDashboard() {
  const [metrics, setMetrics] = useState<Metrics | null>(null)
  const [users, setUsers] = useState<User[]>([])
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [reservations, setReservations] = useState<Reservation[]>([])
  const [activeTab, setActiveTab] = useState<'metrics' | 'users' | 'vehicles' | 'reservations'>(
    'metrics'
  )
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const { token, logout, isAdmin } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (!isAdmin) {
      navigate('/dashboard')
      return
    }
    loadMetrics()
  }, [isAdmin])

  const loadMetrics = async () => {
    try {
      const response = await fetch('/api/admin/metrics', {
        headers: { Authorization: `Bearer ${token}` },
      })

      if (response.status === 401 || response.status === 403) {
        logout()
        return
      }

      if (!response.ok) throw new Error('Failed to load metrics')

      const data = await response.json()
      setMetrics(data)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load metrics')
    }
  }

  const loadUsers = async () => {
    try {
      const response = await fetch('/api/admin/users', {
        headers: { Authorization: `Bearer ${token}` },
      })

      if (!response.ok) throw new Error('Failed to load users')

      const data = await response.json()
      setUsers(data)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load users')
    }
  }

  const loadVehicles = async () => {
    try {
      const response = await fetch('/api/admin/vehicles', {
        headers: { Authorization: `Bearer ${token}` },
      })

      if (!response.ok) throw new Error('Failed to load vehicles')

      const data = await response.json()
      setVehicles(data)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load vehicles')
    }
  }

  const loadReservations = async () => {
    try {
      const response = await fetch('/api/admin/reservations', {
        headers: { Authorization: `Bearer ${token}` },
      })

      if (!response.ok) throw new Error('Failed to load reservations')

      const data = await response.json()
      setReservations(data)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load reservations')
    }
  }

  const handleDeleteUser = async (userId: string) => {
    if (!confirm('Are you sure you want to delete this user?')) return

    try {
      const response = await fetch(`/api/admin/users/${userId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })

      if (!response.ok) throw new Error('Failed to delete user')

      setSuccess('User deleted successfully')
      loadUsers()
      loadMetrics()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to delete user')
    }
  }

  const handleCancelReservation = async (reservationId: string) => {
    if (!confirm('Are you sure you want to cancel this reservation?')) return

    try {
      const response = await fetch(`/api/admin/reservations/${reservationId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })

      if (!response.ok) throw new Error('Failed to cancel reservation')

      setSuccess('Reservation cancelled successfully')
      loadReservations()
      loadMetrics()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to cancel reservation')
    }
  }

  useEffect(() => {
    if (activeTab === 'users') loadUsers()
    else if (activeTab === 'vehicles') loadVehicles()
    else if (activeTab === 'reservations') loadReservations()
  }, [activeTab])

  return (
    <div className="dashboard-container">
      <nav className="dashboard-nav">
        <h2>Oktawave Parking - Admin</h2>
        <div className="nav-links">
          <Link to="/admin">Admin Dashboard</Link>
          <button onClick={logout} className="btn-secondary">
            Logout
          </button>
        </div>
      </nav>

      <div className="dashboard-content">
        <h1>Admin Dashboard</h1>
        <p className="subtitle">Manage users, vehicles, and reservations</p>

        {error && <div className="error-message">{error}</div>}
        {success && <div className="success-message">{success}</div>}

        <div className="admin-tabs">
          <button
            className={activeTab === 'metrics' ? 'active' : ''}
            onClick={() => setActiveTab('metrics')}
          >
            Metrics
          </button>
          <button
            className={activeTab === 'users' ? 'active' : ''}
            onClick={() => setActiveTab('users')}
          >
            Users
          </button>
          <button
            className={activeTab === 'vehicles' ? 'active' : ''}
            onClick={() => setActiveTab('vehicles')}
          >
            Vehicles
          </button>
          <button
            className={activeTab === 'reservations' ? 'active' : ''}
            onClick={() => setActiveTab('reservations')}
          >
            Reservations
          </button>
        </div>

        {activeTab === 'metrics' && metrics && (
          <div className="metrics-grid">
            <div className="metric-card">
              <h3>{metrics.total_users}</h3>
              <p>Total Users</p>
            </div>
            <div className="metric-card">
              <h3>{metrics.total_vehicles}</h3>
              <p>Total Vehicles</p>
            </div>
            <div className="metric-card">
              <h3>{metrics.total_reservations}</h3>
              <p>Total Reservations</p>
            </div>
            <div className="metric-card">
              <h3>{metrics.active_reservations}</h3>
              <p>Active Reservations</p>
            </div>
            <div className="metric-card">
              <h3>
                {metrics.available_spots}/{metrics.total_spots}
              </h3>
              <p>Available Spots</p>
            </div>
          </div>
        )}

        {activeTab === 'users' && (
          <div className="data-table">
            <table>
              <thead>
                <tr>
                  <th>Email</th>
                  <th>Full Name</th>
                  <th>Role</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id}>
                    <td>{user.email}</td>
                    <td>{user.full_name}</td>
                    <td>{user.role}</td>
                    <td>
                      <button
                        onClick={() => handleDeleteUser(user.id)}
                        className="btn-danger"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === 'vehicles' && (
          <div className="data-table">
            <table>
              <thead>
                <tr>
                  <th>License Plate</th>
                  <th>Make</th>
                  <th>Model</th>
                </tr>
              </thead>
              <tbody>
                {vehicles.map((vehicle) => (
                  <tr key={vehicle.id}>
                    <td>{vehicle.license_plate}</td>
                    <td>{vehicle.make}</td>
                    <td>{vehicle.model}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === 'reservations' && (
          <div className="data-table">
            <table>
              <thead>
                <tr>
                  <th>Spot ID</th>
                  <th>Start Time</th>
                  <th>End Time</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {reservations.map((reservation) => (
                  <tr key={reservation.id}>
                    <td>{reservation.spot_id}</td>
                    <td>{new Date(reservation.start_time).toLocaleString()}</td>
                    <td>{new Date(reservation.end_time).toLocaleString()}</td>
                    <td>{reservation.status}</td>
                    <td>
                      {reservation.status === 'active' && (
                        <button
                          onClick={() => handleCancelReservation(reservation.id)}
                          className="btn-danger"
                        >
                          Cancel
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
