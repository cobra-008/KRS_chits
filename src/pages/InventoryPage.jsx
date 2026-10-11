import { useState, useEffect } from 'react'
import { CheckSquare, Square, Package, Send } from 'lucide-react'
import toast from 'react-hot-toast'
import { inventoryApi } from '../lib/api'
import { gramsToKg, formatGrams } from '../lib/silverCalc'
import { format, parseISO } from 'date-fns'

export default function InventoryPage({ onNavigate }) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(new Set())
  const [showIssued, setShowIssued] = useState(false)

  const load = async () => {
    try {
      setLoading(true)
      const data = showIssued ? await inventoryApi.getAll() : await inventoryApi.getInStock()
      setItems(data)
      setSelected(new Set())
    } catch {
      toast.error('Failed to load inventory')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [showIssued])

  const toggleSelect = (id) => {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const toggleAll = () => {
    const inStock = items.filter(i => i.status === 'in_stock')
    if (selected.size === inStock.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(inStock.map(i => i.id)))
    }
  }

  const selectedItems = items.filter(i => selected.has(i.id))
  const totalSelWeight = selectedItems.reduce((s, i) => s + (parseFloat(i.weight_g) || 0), 0)
  const totalSelPure = selectedItems.reduce((s, i) => s + (parseFloat(i.pure_g) || 0), 0)
  const avgTunch = totalSelWeight > 0
    ? (selectedItems.reduce((s, i) => s + (parseFloat(i.tunch_pct) || 0) * (parseFloat(i.weight_g) || 0), 0) / totalSelWeight)
    : 0

  const inStockCount = items.filter(i => i.status === 'in_stock').length

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Vault Inventory</h1>
          <p className="page-sub">{inStockCount} kachas in stock</p>
        </div>
        <div className="flex gap-2">
          <button
            id="btn-toggle-issued"
            className={`btn btn-sm ${showIssued ? 'btn-gold' : 'btn-ghost'}`}
            onClick={() => setShowIssued(p => !p)}
          >
            {showIssued ? 'Showing All' : 'Show Issued Too'}
          </button>
        </div>
      </div>

      {/* Live Calculator */}
      {selected.size > 0 && (
        <div className="card card-gold mb-5" style={{ animation: 'fadeIn 0.2s ease' }}>
          <div className="card-header">
            <span className="card-title text-gold">
              📊 Selection Calculator — {selected.size} Kachas Selected
            </span>
            <button
              id="btn-issue-selected"
              className="btn btn-maroon btn-sm"
              onClick={() => {
                toast.success(`${selected.size} kacha(s) transferred to Issue Voucher`)
                onNavigate('issue', Array.from(selected))
              }}
            >
              <Send /> Issue Selected
            </button>
          </div>
          <div className="stat-grid stat-grid-3">
            <div className="stat-card">
              <div className="stat-label">Total Gross Weight</div>
              <div className="stat-value gold">{totalSelWeight.toLocaleString('en-IN', { maximumFractionDigits: 3 })} g</div>
              <div className="stat-sub">{gramsToKg(totalSelWeight)} kg</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Avg Tunch</div>
              <div className="stat-value gold">{avgTunch.toFixed(3)}%</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Total Pure Fine</div>
              <div className="stat-value gold">{totalSelPure.toLocaleString('en-IN')} g</div>
              <div className="stat-sub">{gramsToKg(totalSelPure)} kg</div>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="loading-overlay"><div className="spinner" /> Loading inventory…</div>
      ) : items.length === 0 ? (
        <div className="empty-state">
          <Package size={48} style={{ opacity: 0.3 }} />
          <div className="empty-state-title">Vault is empty</div>
          <div className="empty-state-sub">Save a receipt voucher to add stock</div>
        </div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th style={{ width: 40 }}>
                  <button
                    className="btn btn-ghost btn-sm btn-icon"
                    onClick={toggleAll}
                    title="Select all in-stock"
                    style={{ padding: 2 }}
                  >
                    {selected.size === inStockCount && inStockCount > 0
                      ? <CheckSquare size={15} style={{ color: 'var(--clr-gold)' }} />
                      : <Square size={15} />
                    }
                  </button>
                </th>
                <th>Patla / Kacha No.</th>
                <th>Description</th>
                <th>Weight (g)</th>
                <th>Tunch (%)</th>
                <th>Pure Fine (g)</th>
                <th>Status</th>
                <th>Date Added</th>
              </tr>
            </thead>
            <tbody>
              {items.map(item => {
                const isStock = item.status === 'in_stock'
                const isChecked = selected.has(item.id)
                return (
                  <tr
                    key={item.id}
                    style={{
                      opacity: isStock ? 1 : 0.5,
                      cursor: isStock ? 'pointer' : 'default',
                      background: isChecked ? 'var(--clr-gold-bg)' : undefined,
                    }}
                    onClick={() => isStock && toggleSelect(item.id)}
                  >
                    <td>
                      {isStock && (
                        <div style={{ display: 'flex', justifyContent: 'center' }}>
                          {isChecked
                            ? <CheckSquare size={15} style={{ color: 'var(--clr-gold)' }} />
                            : <Square size={15} style={{ color: 'var(--clr-text-muted)' }} />
                          }
                        </div>
                      )}
                    </td>
                    <td>
                      <span className="font-semibold font-mono">{item.patla_no}</span>
                    </td>
                    <td className="text-secondary text-sm">{item.description || '—'}</td>
                    <td className="font-mono">
                      {parseFloat(item.weight_g).toLocaleString('en-IN', { maximumFractionDigits: 3 })} g
                    </td>
                    <td className="font-mono">{parseFloat(item.tunch_pct).toFixed(3)}%</td>
                    <td className="font-mono font-semibold text-gold">
                      {parseFloat(item.pure_g).toLocaleString('en-IN')} g
                    </td>
                    <td>
                      {isStock
                        ? <span className="badge badge-green">In Stock</span>
                        : <span className="badge badge-gray">Issued</span>
                      }
                    </td>
                    <td className="text-secondary text-sm">
                      {item.added_at ? format(parseISO(item.added_at), 'dd MMM yyyy') : '—'}
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
