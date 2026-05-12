import { useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'

const navItems = [
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/vehicles', label: 'Vehicles' },
  { to: '/parking-spots', label: 'Parking spots' },
  { to: '/reservations', label: 'Reservations' },
  { to: '/reserve', label: 'Reserve' },
] as const

export default function Sidebar() {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)

  const close = () => setOpen(false)

  const handleLogout = () => {
    localStorage.removeItem('token')
    close()
    navigate('/login')
  }

  return (
    <>
      <button
        type="button"
        className="sidebar-open-btn"
        aria-label="Open navigation"
        aria-expanded={open}
        onClick={() => setOpen(true)}
      />
      {open ? (
        <button
          type="button"
          className="sidebar-scrim"
          aria-label="Close navigation"
          onClick={close}
        />
      ) : null}

      <aside className={`app-sidebar ${open ? 'is-open' : ''}`} aria-label="Main navigation">
        <div className="sidebar-inner">
          <div className="sidebar-brand">
            <span className="sidebar-brand-mark" aria-hidden />
            <div className="sidebar-brand-text">
              <span className="sidebar-brand-title">Parking</span>
              <span className="sidebar-brand-sub">Management</span>
            </div>
          </div>

          <nav className="sidebar-nav">
            <ul className="sidebar-list">
              {navItems.map(({ to, label }) => (
                <li key={to}>
                  <NavLink
                    to={to}
                    className={({ isActive }) =>
                      `sidebar-link${isActive ? ' is-active' : ''}`
                    }
                    onClick={close}
                  >
                    {label}
                  </NavLink>
                </li>
              ))}
            </ul>
          </nav>

          <div className="sidebar-footer">
            <button type="button" className="sidebar-logout" onClick={handleLogout}>
              Log out
            </button>
          </div>
        </div>
      </aside>
    </>
  )
}
