import {
  Home, FileText, Send, Users, Layers, Package,
  AlertCircle, ClockIcon, PlusCircle, Grid
} from 'lucide-react'
import { useLanguage } from '../context/LanguageContext'

const NAV_ITEMS = [
  { id: 'home',         labelKey: 'nav_home',         fallback: 'Home',           icon: Home },
  { id: 'receipt',      labelKey: 'nav_receipt',      fallback: 'Receipt Voucher', icon: FileText },
  { id: 'issue',        labelKey: 'nav_issue',        fallback: 'Issue Voucher',   icon: Send },
  { id: 'customers',   labelKey: 'nav_customers',   fallback: 'Customers',        icon: Users },
  { id: 'groups',      labelKey: 'nav_groups',      fallback: 'Groups',           icon: Grid },
  { id: 'inventory',   labelKey: 'nav_inventory',   fallback: 'Inventory',        icon: Package },
  { id: 'outstanding', labelKey: 'nav_outstanding', fallback: 'Outstanding',      icon: AlertCircle },
  { id: 'transactions',labelKey: 'nav_transactions',fallback: 'Transactions',     icon: ClockIcon },
]

export default function Navigation({ active, onChange }) {
  const { t } = useLanguage()

  return (
    <nav className="nav" role="navigation" aria-label="Main navigation">
      {NAV_ITEMS.map(({ id, labelKey, fallback, icon: Icon }) => (
        <button
          key={id}
          id={`nav-${id}`}
          className={`nav-btn ${active === id ? 'active' : ''}`}
          onClick={() => onChange(id)}
          aria-current={active === id ? 'page' : undefined}
        >
          <Icon />
          {t(labelKey, fallback)}
        </button>
      ))}
    </nav>
  )
}
