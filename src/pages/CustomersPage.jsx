import { useState, useEffect, useRef } from 'react'
import { Plus, Search, UserPlus, Camera, Edit2, Eye } from 'lucide-react'
import toast from 'react-hot-toast'
import { customersApi } from '../lib/api'
import CustomerLedgerModal from './modals/CustomerLedgerModal'
import CustomerFormModal from './modals/CustomerFormModal'
import { useLanguage } from '../context/LanguageContext'

export default function CustomersPage() {
  const { t, lang } = useLanguage()
  const [customers, setCustomers] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [formModal, setFormModal] = useState(null) // null | 'new' | customer
  const [ledgerCustomer, setLedgerCustomer] = useState(null)

  const load = async () => {
    try {
      setLoading(true)
      const data = await customersApi.getAll()
      setCustomers(data)
    } catch {
      toast.error('Failed to load customers')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const filtered = customers.filter(c =>
    c.name?.toLowerCase().includes(search.toLowerCase()) ||
    c.phone?.includes(search) ||
    c.city?.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">{t('customer_accounts')}</h1>
          <p className="page-sub">{customers.length} {t('customer_accounts_sub')}</p>
        </div>
        <button
          id="btn-new-customer"
          className="btn btn-gold"
          onClick={() => setFormModal('new')}
        >
          <UserPlus /> {t('btn_add_customer')}
        </button>
      </div>

      {/* Search */}
      <div style={{ position: 'relative', marginBottom: 'var(--sp-5)' }}>
        <Search size={15} style={{
          position: 'absolute', left: 12, top: '50%',
          transform: 'translateY(-50%)', color: 'var(--clr-text-muted)',
        }} />
        <input
          id="customer-search"
          className="form-control"
          style={{ paddingLeft: 36 }}
          placeholder={t('search_customer_ph')}
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {loading ? (
        <div className="loading-overlay"><div className="spinner" /> {t('loading')}</div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <UserPlus size={48} style={{ opacity: 0.3 }} />
          <div className="empty-state-title">{t('no_customers_found')}</div>
          <div className="empty-state-sub">{t('add_first_customer')}</div>
          <button className="btn btn-gold mt-4" onClick={() => setFormModal('new')}>
            <Plus /> {t('btn_add_customer')}
          </button>
        </div>
      ) : (
        <>
          <div className="table-scroll-hint mb-2">{t('swipe_hint')}</div>
          <div className="table-wrap" style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
            <table style={{ minWidth: 620 }}>
              <thead>
                <tr>
                  <th>#</th>
                  <th>{t('th_customer')}</th>
                  <th>{t('phone_label')}</th>
                  <th>{t('th_whatsapp')}</th>
                  <th>{t('th_city')}</th>
                  <th>{t('th_id_proof')}</th>
                  <th>{t('th_actions')}</th>
                </tr>
              </thead>
            <tbody>
              {filtered.map((customer, idx) => (
                <tr
                  key={customer.id}
                  style={{ cursor: 'pointer' }}
                  onDoubleClick={() => setLedgerCustomer(customer)}
                  title="Double-click to view full account ledger"
                >
                  <td className="text-muted text-sm">{idx + 1}</td>
                  <td>
                    <div className="flex items-center gap-3">
                      <div className="avatar">
                        {customer.photo_url
                          ? <img src={customer.photo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
                          : customer.name?.[0]?.toUpperCase()
                        }
                      </div>
                      <div>
                        <div className="font-semibold">{customer.name}</div>
                        {customer.address && (
                          <div className="text-xs text-muted truncate" style={{ maxWidth: 180 }}>
                            {customer.address}
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="text-secondary">{customer.phone || '—'}</td>
                  <td className="text-secondary">{customer.whatsapp || '—'}</td>
                  <td className="text-secondary">{customer.city || '—'}</td>
                  <td className="text-secondary text-sm">{customer.id_proof || '—'}</td>
                  <td>
                    <div className="flex gap-1">
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={(e) => { e.stopPropagation(); setLedgerCustomer(customer) }}
                        title="View ledger"
                      >
                        <Eye size={12} /> {t('btn_view_ledger')}
                      </button>
                      <button
                        className="btn btn-ghost btn-sm btn-icon"
                        onClick={(e) => { e.stopPropagation(); setFormModal(customer) }}
                        title={t('edit')}
                      >
                        <Edit2 size={12} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </>
      )}

      {formModal && (
        <CustomerFormModal
          customer={formModal === 'new' ? null : formModal}
          onClose={() => setFormModal(null)}
          onSaved={() => { setFormModal(null); load() }}
        />
      )}

      {ledgerCustomer && (
        <CustomerLedgerModal
          customer={ledgerCustomer}
          onClose={() => setLedgerCustomer(null)}
        />
      )}
    </div>
  )
}
