import { NavLink, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useVarsler } from '../context/VarselContext'

const NAV = [
  { to: '/app/portefolje', label: 'Min portefølje', icon: 'M3 3h18v18H3zM3 9h18M9 21V9' },
  { to: '/app/toppliste', label: 'Toppliste', icon: 'M4 21V11M10 21V4M16 21v-7M22 21H2' },
  { to: '/app/rom', label: 'Rom', icon: 'M4 4h16v13H8l-4 4zM8 9h8M8 13h5' },
  { to: '/app/meldinger', label: 'Meldinger', icon: 'M9 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM2 20a7 7 0 0 1 14 0M17 5a3 3 0 0 1 0 7M15 20a7 7 0 0 0-2-5' },
  { to: '/skatteregler', label: 'Skatteregler', icon: 'M9 7h6M9 12h6M9 17h4M5 3h14v18H5z' },
  { to: '/app/skatt', label: 'Min skatt', icon: 'M3 17l6-6 4 4 8-8M14 7h7v7' },
  { to: '/app/radgiver', label: 'Rådgiver', icon: 'M12 3a5 5 0 0 1 5 5c0 2-1 3-1 5H8c0-2-1-3-1-5a5 5 0 0 1 5-5ZM9 18h6M10 21h4' },
]

export default function Sidebar() {
  const { user, signOut } = useAuth()
  const varsler = useVarsler()
  const antallFor = (to) => {
    if (to === '/meldinger') return varsler.dm + varsler.foresporsler
    if (to === '/rom') return varsler.rom
    return 0
  }
  const initials = (user?.email || '?').slice(0, 2).toUpperCase()

  return (
    <aside className="rail">
      <div className="rail-logo">K</div>
      <div className="rail-div" />
      <nav className="rail-nav">
        {NAV.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) => 'ric' + (isActive ? ' active' : '')}
            title={item.label}
          >
            <span className="ind" />
            <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.7">
              <path d={item.icon} />
            </svg>
            <span className="rtip">{item.label}</span>
            {antallFor(item.to) > 0 && (
              <span className="varsel-boble">{antallFor(item.to) > 9 ? '9+' : antallFor(item.to)}</span>
            )}
          </NavLink>
        ))}
      </nav>
      <div className="rail-foot">
        <Link to="/app/personvern" className="rail-jur" title="Personvern og vilkår">
          <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.7">
            <path d="M12 2 4 6v6c0 5 3.4 8.6 8 10 4.6-1.4 8-5 8-10V6l-8-4Z" />
          </svg>
        </Link>
        <Link to="/app/profil" className="rail-av" title="Din profil">{initials}</Link>
        <button className="rail-logout" onClick={signOut} title="Logg ut">
          <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.8">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
          </svg>
        </button>
      </div>
    </aside>
  )
}
