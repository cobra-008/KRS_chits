import { useState, useEffect } from 'react'
import { Search, Filter, Printer } from 'lucide-react'
import toast from 'react-hot-toast'
import { txnLogApi } from '../lib/api'
import { format, parseISO } from 'date-fns'

const TYPE_LABELS = {
  receipt: { label: 'Inward Receipt', badge: 'badge-green' },
  issue:   { label: 'Outward Issue',  badge: 'badge-red'   },
  chit_settlement: { label: 'Chit Settlement', badge: 'badge-gold' },
}

export default function TransactionsPage() {
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
          <h1 className="page-title">Transaction History</h1>
          <p className="page-sub">Company day book — all receipts, issues &amp; settlements</p>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={() => window.print()}>
          <Printer /> Print Day Book
        </button>
      </div>

      {/* Summary stats */}
      <div className="stat-grid stat-grid-3 mb-5">
        <div className="stat-card">
          <div className="stat-label">Total Inward (Selected)</div>
          <div className="stat-value green">{totalIn.toLocaleString('en-IN')} g</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Total Outward (Selected)</div>
          <div className="stat-value red">{totalOut.toLocaleString('en-IN')} g</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Net Movement</div>
          <div className={`stat-value ${net >= 0 ? 'green' : 'red'}`}>
            {net >= 0 ? '+' : ''}{net.toLocaleString('en-IN')} g
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="card mb-5">
        <div className="flex gap-3" style={{ flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div className="form-group" style={{ flex: 1, minWidth: 160 }}>
            <label className="form-label">Date</label>
            <input
              id="txn-filter-date"
              type="date"
              className="form-control"
              value={filters.date}
              onChange={e => setFilters(p => ({ ...p, date: e.target.value }))}
            />
          </div>

          <div className="form-group" style={{ flex: 1, minWidth: 160 }}>
            <label className="form-label">Type</label>
            <select
              id="txn-filter-type"
              className="form-control"
              value={filters.type}
              onChange={e => setFilters(p => ({ ...p, type: e.target.value }))}
            >
              <option value="">All Types</option>
              <option value="receipt">Inward Receipts</option>
              <option value="issue">Outward Issues</option>
              <option value="chit_settlement">Chit Settlements</option>
            </select>
          </div>

          <div className="form-group" style={{ flex: 2, minWidth: 200 }}>
            <label className="form-label">Search</label>
            <div style={{ position: 'relative' }}>
              <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--clr-text-muted)' }} />
              <input
                id="txn-search"
                className="form-control"
                style={{ paddingLeft: 32 }}
                placeholder="Customer name or voucher ref…"
                value={filters.search}
                onChange={e => setFilters(p => ({ ...p, search: e.target.value }))}
                onKeyDown={handleSearchKey}
              />
            </div>
          </div>

          <div className="flex gap-2">
            <button className="btn btn-gold btn-sm" onClick={load}>
              <Filter /> Filter
            </button>
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => setFilters({ date: '', type: '', search: '' })}
            >
              Clear
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="loading-overlay"><div className="spinner" /> Loading…</div>
      ) : entries.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-title">No transactions found</div>
          <div className="empty-state-sub">Try adjusting your filters</div>
        </div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Type</th>
                <th>Voucher Ref</th>
                <th>Customer</th>
                <th>Description</th>
                <th>Pure In (g)</th>
                <th>Pure Out (g)</th>
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
      )}
    </div>
  )
}
