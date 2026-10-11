import { useState } from 'react'
import Header from './components/Header'
import Navigation from './components/Navigation'
import { isDemoMode } from './lib/supabase'
import HomePage from './pages/HomePage'
import VoucherPage from './pages/VoucherPage'
import CustomersPage from './pages/CustomersPage'
import GroupsPage from './pages/GroupsPage'
import InventoryPage from './pages/InventoryPage'
import OutstandingPage from './pages/OutstandingPage'
import TransactionsPage from './pages/TransactionsPage'

export default function App() {
  const [activePage, setActivePage] = useState('home')

  const renderPage = () => {
    switch (activePage) {
      case 'home':         return <HomePage onNavigate={setActivePage} />
      case 'receipt':      return <VoucherPage type="receipt" />
      case 'issue':        return <VoucherPage type="issue" />
      case 'customers':    return <CustomersPage />
      case 'groups':       return <GroupsPage />
      case 'inventory':    return <InventoryPage onNavigate={setActivePage} />
      case 'outstanding':  return <OutstandingPage />
      case 'transactions': return <TransactionsPage />
      default:             return <HomePage onNavigate={setActivePage} />
    }
  }

  return (
    <div className="app-shell">
      <Header />
      {isDemoMode && (
        <div style={{
          background: 'linear-gradient(90deg, var(--clr-maroon-bg), var(--clr-gold-bg))',
          borderBottom: '1px solid var(--clr-gold-dim)',
          padding: '8px 24px',
          fontSize: '0.78rem',
          color: 'var(--clr-gold)',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}>
          ⚙️ <strong>Setup Required:</strong> Add your Supabase credentials to <code style={{ background: 'rgba(0,0,0,0.3)', padding: '1px 6px', borderRadius: 4 }}>.env.local</code> to connect the database. See <code style={{ background: 'rgba(0,0,0,0.3)', padding: '1px 6px', borderRadius: 4 }}>supabase/schema.sql</code> to create your tables.
        </div>
      )}
      <Navigation active={activePage} onChange={setActivePage} />
      <main className="app-content" id="main-content" role="main">
        {renderPage()}
      </main>
    </div>
  )
}
