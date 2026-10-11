import { useState } from 'react'
import { Lock, Eye, EyeOff, ArrowRight, ShieldCheck } from 'lucide-react'
import KRSLogo from '../components/KRSLogo'
import toast from 'react-hot-toast'

export default function LoginPage({ onLogin }) {
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState(false)
  const [shake, setShake] = useState(false)

  const expectedPassword = import.meta.env.VITE_APP_PASSWORD || 'ArjunKRS'

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!password) {
      toast.error('Please enter the password')
      return
    }

    if (password === expectedPassword) {
      toast.success('Access granted — Welcome to K R S Silvers')
      setError(false)
      onLogin()
    } else {
      setError(true)
      setShake(true)
      toast.error('Incorrect password')
      setTimeout(() => setShake(false), 500)
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'radial-gradient(ellipse at 50% 25%, #FFFFFF 0%, #EEF2F7 60%, #E3E8F0 100%)',
      padding: '24px',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Subtle background ambient ring */}
      <div style={{
        position: 'absolute',
        width: 600,
        height: 600,
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(179, 134, 27, 0.05) 0%, transparent 70%)',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        pointerEvents: 'none',
      }} />

      {/* Login Card */}
      <div
        className={`card ${shake ? 'shake-anim' : ''}`}
        style={{
          width: '100%',
          maxWidth: 440,
          padding: '44px 40px',
          boxShadow: '0 20px 50px -10px rgba(18, 24, 38, 0.12), 0 1px 3px rgba(18, 24, 38, 0.05)',
          border: '1.5px solid var(--clr-border)',
          borderRadius: 24,
          background: '#FFFFFF',
          textAlign: 'center',
          position: 'relative',
          zIndex: 1,
        }}
      >
        {/* Brand Header */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}>
          <KRSLogo size={72} />
        </div>

        <h1 style={{
          fontFamily: 'var(--font-display)',
          fontSize: '1.75rem',
          fontWeight: 700,
          color: '#111827',
          letterSpacing: '0.04em',
          marginBottom: 4,
        }}>
          K R S SILVERS
        </h1>

        <p style={{
          fontSize: '0.78rem',
          color: 'var(--clr-text-secondary)',
          letterSpacing: '0.14em',
          textTransform: 'uppercase',
          fontWeight: 600,
          marginBottom: 32,
        }}>
          Bullion &amp; Chit Management
        </p>

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ textAlign: 'left' }}>
          <div className="form-group mb-5">
            <label className="form-label" htmlFor="app-password" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Lock size={12} color="var(--clr-gold)" /> Enter Password to Access
            </label>
            <div style={{ position: 'relative' }}>
              <input
                id="app-password"
                type={showPassword ? 'text' : 'password'}
                className="form-control"
                placeholder="Enter password…"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value)
                  if (error) setError(false)
                }}
                autoFocus
                style={{
                  height: 48,
                  paddingRight: 44,
                  fontSize: '0.98rem',
                  borderColor: error ? 'var(--clr-danger)' : undefined,
                  boxShadow: error ? '0 0 0 3px rgba(166, 38, 38, 0.15)' : undefined,
                }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(p => !p)}
                style={{
                  position: 'absolute',
                  right: 12,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--clr-text-muted)',
                  display: 'flex',
                  alignItems: 'center',
                  padding: 4,
                }}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            {error && (
              <span style={{ fontSize: '0.78rem', color: 'var(--clr-danger-text)', marginTop: 4, fontWeight: 500 }}>
                Incorrect password. Please verify and try again.
              </span>
            )}
          </div>

          <button
            type="submit"
            id="btn-login"
            className="btn btn-gold btn-lg w-full"
            style={{
              height: 48,
              fontSize: '0.96rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              marginTop: 10,
            }}
          >
            Unlock System <ArrowRight size={16} />
          </button>
        </form>

        {/* Security watermark */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
          marginTop: 32,
          fontSize: '0.74rem',
          color: 'var(--clr-text-muted)',
        }}>
          <ShieldCheck size={14} color="var(--clr-gold)" /> Secure Management Gateway
        </div>
      </div>
    </div>
  )
}
