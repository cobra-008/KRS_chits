import { useState, useEffect } from 'react'
import Header from './components/Header'
import Navigation from './components/Navigation'
import { isDemoMode } from './lib/supabase'
import LoginPage from './pages/LoginPage'
import HomePage from './pages/HomePage'
import VoucherPage from './pages/VoucherPage'
import IssueVoucherPage from './pages/IssueVoucherPage'
import CustomersPage from './pages/CustomersPage'
import GroupsPage from './pages/GroupsPage'
import InventoryPage from './pages/InventoryPage'
import OutstandingPage from './pages/OutstandingPage'
import TransactionsPage from './pages/TransactionsPage'

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [activePage, setActivePage] = useState('home')
  const [issueSelectedIds, setIssueSelectedIds] = useState([])

  const handleLogin = () => {
    setIsAuthenticated(true)
  }

  const handleLogout = () => {
    setIsAuthenticated(false)
  }

  const handleNavigate = (page, data) => {
    if (page === 'issue') {
      setIssueSelectedIds(Array.isArray(data) ? data : [])
    }
    setActivePage(page)
  }

  if (!isAuthenticated) {
    return <LoginPage onLogin={handleLogin} />
  }

  const renderPage = () => {
    switch (activePage) {
      case 'home':         return <HomePage onNavigate={handleNavigate} />
      case 'receipt':      return <VoucherPage type="receipt" />
      case 'issue':        return <IssueVoucherPage initialSelectedIds={issueSelectedIds} />
      case 'customers':    return <CustomersPage />
      case 'groups':       return <GroupsPage />
      case 'inventory':    return <InventoryPage onNavigate={handleNavigate} />
      case 'outstanding':  return <OutstandingPage />
      case 'transactions': return <TransactionsPage />
      default:             return <HomePage onNavigate={handleNavigate} />
    }
  }

  return (
    <div className="app-shell">
      <Header onLogout={handleLogout} />
      {isDemoMode && (
        <div style={{
          background: 'linear-gradient(90deg, #FBF8EE 0%, #F6EEDB 100%)',
          borderBottom: '1px solid rgba(179, 134, 27, 0.25)',
          padding: '10px 36px',
          fontSize: '0.82rem',
          color: '#8A6818',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
        }}>
          ⚙️ <strong>Setup Required:</strong> Add your Supabase credentials to <code style={{ background: 'rgba(0,0,0,0.06)', padding: '2px 8px', borderRadius: 4, color: '#634707' }}>.env.local</code> to connect the database. See <code style={{ background: 'rgba(0,0,0,0.06)', padding: '2px 8px', borderRadius: 4, color: '#634707' }}>supabase/schema.sql</code> to create your tables.
        </div>
      )}
      <Navigation active={activePage} onChange={handleNavigate} />
      <main className="app-content" id="main-content" role="main">
        {renderPage()}
      </main>
    </div>
  )
}
