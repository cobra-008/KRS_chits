import { useState, useEffect } from 'react'
import { Search, Filter, Printer } from 'lucide-react'
import toast from 'react-hot-toast'
import { txnLogApi } from '../lib/api'
import { format, parseISO } from 'date-fns'
import { useLanguage } from '../context/LanguageContext'

export default function TransactionsPage() {
  const { t, lang } = useLanguage()

  const TYPE_LABELS = {
    receipt: { label: t('type_receipt'), badge: 'badge-green' },
    issue:   { label: t('type_issue'),  badge: 'badge-red'   },
    chit_settlement: { label: t('type_chit'), badge: 'badge-gold' },
  }
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState({ date: '', type: '', search: '' })

  const load = async () => {
    try {
      setLoading(true)
      const data = await txnLogApi.getAll({
        date: filters.date || undefined,
        type: filters.type || undefined,
        search: filters.search || undefined,
      })
      setEntries(data)
    } catch {
      toast.error('Failed to load transactions')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [filters.date, filters.type])

  const handleSearchKey = (e) => {
    if (e.key === 'Enter') load()
  }

  const totalIn  = entries.reduce((s, e) => s + (parseFloat(e.pure_in_g)  || 0), 0)
  const totalOut = entries.reduce((s, e) => s + (parseFloat(e.pure_out_g) || 0), 0)
  const net = totalIn - totalOut

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">{t('day_book_title')}</h1>
          <p className="page-sub">{t('day_book_sub')}</p>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={() => window.print()}>
          <Printer /> {t('btn_print_daybook')}
        </button>
      </div>

      {/* Summary stats */}
      <div className="stat-grid stat-grid-3 mb-5">
        <div className="stat-card">
          <div className="stat-label">{t('total_inward')}</div>
          <div className="stat-value green">{totalIn.toLocaleString('en-IN')} g</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">{t('total_outward_stat')}</div>
          <div className="stat-value red">{totalOut.toLocaleString('en-IN')} g</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">{t('net_movement')}</div>
          <div className={`stat-value ${net >= 0 ? 'green' : 'red'}`}>
            {net >= 0 ? '+' : ''}{net.toLocaleString('en-IN')} g
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="card mb-5">
        <div className="txn-filter-bar">
          <div className="form-group">
            <label className="form-label">{t('filter_date')}</label>
            <input
              id="txn-filter-date"
              type="date"
              className="form-control"
              value={filters.date}
              onChange={e => setFilters(p => ({ ...p, date: e.target.value }))}
            />
          </div>

          <div className="form-group">
            <label className="form-label">{t('filter_type')}</label>
            <select
              id="txn-filter-type"
              className="form-control"
              value={filters.type}
              onChange={e => setFilters(p => ({ ...p, type: e.target.value }))}
            >
              <option value="">{t('type_all')}</option>
              <option value="receipt">{t('type_receipt')}</option>
              <option value="issue">{t('type_issue')}</option>
              <option value="chit_settlement">{t('type_chit')}</option>
            </select>
          </div>

          <div className="form-group search-group">
            <label className="form-label">{t('filter_search')}</label>
            <div style={{ position: 'relative' }}>
              <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--clr-text-muted)' }} />
              <input
                id="txn-search"
                className="form-control"
                style={{ paddingLeft: 32 }}
                placeholder={t('search_txn_ph')}
                value={filters.search}
                onChange={e => setFilters(p => ({ ...p, search: e.target.value }))}
                onKeyDown={handleSearchKey}
              />
            </div>
          </div>

          <div className="actions">
            <button className="btn btn-gold btn-sm" onClick={load}>
              <Filter /> {t('filter')}
            </button>
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => setFilters({ date: '', type: '', search: '' })}
            >
              {t('clear')}
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="loading-overlay"><div className="spinner" /> {t('loading')}</div>
      ) : entries.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-title">{t('no_customers_found')}</div>
          <div className="empty-state-sub">{lang === 'ta' ? 'வடிகட்டிகளை மாற்றி முயற்சிக்கவும்' : 'Try adjusting your filters'}</div>
        </div>
      ) : (
        <>
          <div className="table-scroll-hint mb-2">{t('swipe_hint')}</div>
          <div className="table-wrap" style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
            <table style={{ minWidth: 680 }}>
              <thead>
                <tr>
                  <th>{t('th_datetime')}</th>
                  <th>{t('filter_type')}</th>
                  <th>{t('th_voucher_ref')}</th>
                  <th>{t('th_customer')}</th>
                  <th>{t('th_particulars')}</th>
                  <th>{t('th_in_pure')}</th>
                  <th>{t('th_out_pure')}</th>
                </tr>
              </thead>
              <tbody>
                {entries.map(entry => {
                  const typeInfo = TYPE_LABELS[entry.type] || { label: entry.type, badge: 'badge-gray' }
                  return (
                    <tr key={entry.id}>
                      <td className="text-secondary text-sm">
                        {entry.log_date ? format(parseISO(entry.log_date), 'dd MMM yyyy') : '—'}
                      </td>
                      <td>
                        <span className={`badge ${typeInfo.badge}`}>{typeInfo.label}</span>
                      </td>
                      <td className="font-mono font-semibold">{entry.voucher_ref || '—'}</td>
                      <td>
                        <span className="font-semibold">{entry.customer_name || entry.customers?.name || '—'}</span>
                      </td>
                      <td className="text-secondary text-sm">{entry.description || '—'}</td>
                      <td className="font-mono text-success">
                        {parseFloat(entry.pure_in_g) > 0
                          ? `+${parseFloat(entry.pure_in_g).toLocaleString('en-IN')} g`
                          : '—'
                        }
                      </td>
                      <td className="font-mono text-danger">
                        {parseFloat(entry.pure_out_g) > 0
                          ? `−${parseFloat(entry.pure_out_g).toLocaleString('en-IN')} g`
                          : '—'
                        }
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
