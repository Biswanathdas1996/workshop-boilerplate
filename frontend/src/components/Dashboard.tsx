import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function Dashboard() {
  const { user, logout } = useAuth()

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
        <h1>Welcome, {user?.full_name}</h1>
        <p className="subtitle">Manage your parking reservations and vehicles</p>

        <div className="dashboard-grid">
          <Link to="/vehicles" className="dashboard-card">
            <h3>Vehicle Registration</h3>
            <p>Register and manage your vehicles</p>
          </Link>

          <Link to="/reservations" className="dashboard-card">
            <h3>Book Parking</h3>
            <p>Reserve parking spots in advance</p>
          </Link>

          <Link to="/my-reservations" className="dashboard-card">
            <h3>My Reservations</h3>
            <p>View your current and past reservations</p>
          </Link>
        </div>
      </div>
    </div>
  )
}
