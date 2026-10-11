import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Toaster } from 'react-hot-toast'
import './index.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
    <Toaster
      position="top-right"
      toastOptions={{
        style: {
          background: '#FFFFFF',
          color: '#111827',
          border: '1px solid #D8DFE8',
          borderRadius: '12px',
          boxShadow: '0 8px 30px rgba(18, 24, 38, 0.12)',
          fontSize: '0.86rem',
          padding: '12px 18px',
        },
        success: {
          iconTheme: { primary: '#167245', secondary: '#FFFFFF' },
        },
        error: {
          iconTheme: { primary: '#A62626', secondary: '#FFFFFF' },
        },
      }}
    />
  </StrictMode>
)
