import { useState, useEffect } from 'react'
import { format } from 'date-fns'
import KRSLogo from './KRSLogo'
import LanguageToggle from './LanguageToggle'
import { useLanguage } from '../context/LanguageContext'
import { Lock } from 'lucide-react'

export default function Header({ onLogout }) {
  const [time, setTime] = useState(new Date())
  const { t } = useLanguage()

  useEffect(() => {
    const id = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  return (
    <header className="header">
      <div className="header-brand">
        <KRSLogo size={42} className="header-logo" />
        <div className="header-brand-text">
          <div className="header-title">{t('brand_title', 'K R S SILVERS')}</div>
          <div className="header-sub">{t('brand_sub', 'Bullion & Chit Management')}</div>
        </div>
      </div>

      <div className="header-right">
        {/* Language Selection Capsule */}
        <LanguageToggle />

        <div className="pulse-dot" title="System Active" />
        <div className="live-clock">
          <div className="live-clock-date">
            {format(time, 'EEEE, dd MMM yyyy')}
          </div>
          <div className="live-clock-time" style={{ textAlign: 'right' }}>
            {format(time, 'hh:mm:ss aa')}
          </div>
        </div>

        {onLogout && (
          <button
            id="btn-lock-system"
            className="btn btn-ghost btn-sm"
            onClick={onLogout}
            title={t('lock', 'Lock') + ' / Logout'}
            style={{ marginLeft: 4, gap: 6 }}
          >
            <Lock size={13} /> {t('lock', 'Lock')}
          </button>
        )}
      </div>
    </header>
  )
}
