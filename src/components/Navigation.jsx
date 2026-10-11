import {
  Home, FileText, Send, Users, Layers, Package,
  AlertCircle, ClockIcon, PlusCircle, Grid
} from 'lucide-react'

const NAV_ITEMS = [
  { id: 'home',         label: 'Home',           icon: Home },
  { id: 'receipt',      label: 'Receipt Voucher', icon: FileText },
  { id: 'issue',        label: 'Issue Voucher',   icon: Send },
  { id: 'customers',   label: 'Customers',        icon: Users },
  { id: 'groups',      label: 'Groups',           icon: Grid },
  { id: 'inventory',   label: 'Inventory',        icon: Package },
  { id: 'outstanding', label: 'Outstanding',      icon: AlertCircle },
  { id: 'transactions',label: 'Transactions',     icon: ClockIcon },
]

export default function Navigation({ active, onChange }) {
  return (
    <nav className="nav" role="navigation" aria-label="Main navigation">
      {NAV_ITEMS.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          id={`nav-${id}`}
          className={`nav-btn ${active === id ? 'active' : ''}`}
          onClick={() => onChange(id)}
          aria-current={active === id ? 'page' : undefined}
        >
          <Icon />
          {label}
        </button>
      ))}
    </nav>
  )
}
