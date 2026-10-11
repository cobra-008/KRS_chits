import { useState, useEffect } from 'react'
import { format } from 'date-fns'

export default function Header() {
  const [time, setTime] = useState(new Date())

  useEffect(() => {
    const id = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  return (
    <header className="header">
      <div className="header-brand">
        <div className="header-brand-icon" aria-hidden="true">⚖️</div>
        <div>
          <div className="header-title">K R S SILVERS</div>
          <div className="header-sub">Bullion &amp; Chit Management</div>
        </div>
      </div>

      <div className="header-right">
        <div className="pulse-dot" title="System Active" />
        <div className="live-clock">
          <div className="live-clock-date">
            {format(time, 'EEEE, dd MMM yyyy')}
          </div>
          <div className="live-clock-time" style={{ textAlign: 'right' }}>
            {format(time, 'hh:mm:ss aa')}
          </div>
        </div>
      </div>
    </header>
  )
}
