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
          background: '#1A1A1A',
          color: '#F0ECD8',
          border: '1px solid #333333',
          borderRadius: '10px',
          fontSize: '0.83rem',
        },
        success: {
          iconTheme: { primary: '#4CAF7D', secondary: '#1A1A1A' },
        },
        error: {
          iconTheme: { primary: '#E57373', secondary: '#1A1A1A' },
        },
      }}
    />
  </StrictMode>
)
