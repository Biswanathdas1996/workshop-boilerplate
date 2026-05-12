import { useEffect, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'

type Reservation = {
  id: string
  spot_id: string
  vehicle_id: string
  start_time: string
  end_time: string
  status: string
  created_at: string
  spot_number?: string | null
  vehicle_plate?: string | null
}

export default function Reservations() {
  const navigate = useNavigate()
  const [reservations, setReservations] = useState<Reservation[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem('token')
    if (!token) {
      navigate('/login')
      return
    }

    const fetchReservations = async () => {
      try {
        const response = await fetch('/api/reservations', {
          headers: { Authorization: `Bearer ${token}` },
        })

        if (!response.ok) throw new Error('Failed to fetch reservations')

        const data = await response.json()
        setReservations(data)
      } catch {
        console.error('Failed to load reservations')
      } finally {
        setLoading(false)
      }
    }

    void fetchReservations()
  }, [navigate])

  const handleCancel = async (reservationId: string) => {
    const token = localStorage.getItem('token')

    if (!confirm('Are you sure you want to cancel this reservation?')) {
      return
    }

    try {
      const response = await fetch(`/api/reservations/${reservationId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })

      if (response.ok) {
        setReservations(reservations.filter((r) => r.id !== reservationId))
      }
    } catch {
      alert('Failed to cancel reservation')
    }
  }

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString()
  }

  if (loading) {
    return (
      <main className="page">
        <section className="panel">
          <p>Loading reservations...</p>
        </section>
      </main>
    )
  }

  return (
    <main className="page">
      <section className="hero">
        <div className="hero-header">
          <div>
            <p className="eyebrow">Booking Management</p>
            <h1>My Reservations</h1>
            <p className="subtitle">View and manage your parking reservations</p>
          </div>
          <div className="hero-actions">
            <Link to="/reserve" className="btn btn-primary">
              New reservation
            </Link>
          </div>
        </div>
      </section>

      <section className="panel">
        <h2>All Reservations</h2>

        {reservations.length === 0 ? (
          <div className="empty-state">
            <p>No reservations found.</p>
            <Link to="/reserve" className="btn btn-primary">
              Make Your First Reservation
            </Link>
          </div>
        ) : (
          <div className="reservations-list">
            {reservations.map((reservation) => (
              <div key={reservation.id} className="reservation-card">
                <div className="reservation-header">
                  <h3>
                    {reservation.spot_number
                      ? `Spot ${reservation.spot_number}`
                      : `Spot (${reservation.spot_id})`}
                  </h3>
                  <span className={`status-badge status-${reservation.status}`}>
                    {reservation.status}
                  </span>
                </div>
                <div className="reservation-details">
                  <div className="detail-row">
                    <span className="detail-label">Vehicle:</span>
                    <span className="detail-value">
                      {reservation.vehicle_plate ?? reservation.vehicle_id}
                    </span>
                  </div>
                  <div className="detail-row">
                    <span className="detail-label">Start:</span>
                    <span className="detail-value">{formatDateTime(reservation.start_time)}</span>
                  </div>
                  <div className="detail-row">
                    <span className="detail-label">End:</span>
                    <span className="detail-value">{formatDateTime(reservation.end_time)}</span>
                  </div>
                  <div className="detail-row">
                    <span className="detail-label">Booked:</span>
                    <span className="detail-value">{formatDateTime(reservation.created_at)}</span>
                  </div>
                </div>
                {reservation.status === 'active' && (
                  <button
                    onClick={() => handleCancel(reservation.id)}
                    className="btn btn-danger"
                  >
                    Cancel Reservation
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  )
}
