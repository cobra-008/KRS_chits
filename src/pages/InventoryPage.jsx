import { useState, useEffect } from 'react'
import { CheckSquare, Square, Package, Send, Plus, Trash2, X } from 'lucide-react'
import toast from 'react-hot-toast'
import { inventoryApi, customersApi } from '../lib/api'
import { gramsToKg, calcFine } from '../lib/silverCalc'
import { format, parseISO } from 'date-fns'
import { useLanguage } from '../context/LanguageContext'

export default function InventoryPage({ onNavigate }) {
  const { t, lang } = useLanguage()
  const [items, setItems] = useState([])
  const [customers, setCustomers] = useState([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(new Set())
  const [showAddModal, setShowAddModal] = useState(false)
  const [deletingId, setDeletingId] = useState(null)

  // Add silver form state
  const [addForm, setAddForm] = useState({
    silver_type: 'K', // 'K' | 'P' | 'B'
    patla_no: '',
    weight_g: '',
    tunch_pct: '',
    customer_id: '',
    custom_customer: 'Direct',
    date: format(new Date(), 'yyyy-MM-dd'),
  })
  const [savingAdd, setSavingAdd] = useState(false)

  const load = async () => {
    try {
      setLoading(true)
      const [data, custs] = await Promise.all([
        inventoryApi.getInStock(),
        customersApi.getAll().catch(() => [])
      ])
      setItems(data || [])
      setCustomers(custs || [])
      setSelected(new Set())
    } catch {
      toast.error('Failed to load inventory')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

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

  // Summary stats
  const inStockItems = items.filter(i => i.status === 'in_stock')
  const inStockCount = inStockItems.length
  const totalGrossWeight = inStockItems.reduce((s, i) => s + (parseFloat(i.weight_g) || 0), 0)
  const totalPureSilver = inStockItems.reduce((s, i) => s + (parseFloat(i.pure_g) || 0), 0)

  // Selected lots stats
  const selectedItems = items.filter(i => selected.has(i.id))
  const selGrossWeight = selectedItems.reduce((s, i) => s + (parseFloat(i.weight_g) || 0), 0)
  const selPureSilver = selectedItems.reduce((s, i) => s + (parseFloat(i.pure_g) || 0), 0)

  // Handle Silver Type Change in Add Modal
  const handleTypeChange = (type) => {
    setAddForm(prev => {
      const updated = { ...prev, silver_type: type }
      if (type === 'B') {
        updated.tunch_pct = '100'
      }
      return updated
    })
  }

  // Handle Add Silver Submission
  const handleSaveAdd = async () => {
    if (!addForm.weight_g || parseFloat(addForm.weight_g) <= 0) {
      toast.error('Please enter valid gross weight'); return
    }
    if (!addForm.tunch_pct || parseFloat(addForm.tunch_pct) <= 0) {
      toast.error('Please enter valid tunch %'); return
    }

    setSavingAdd(true)
    try {
      const w = parseFloat(addForm.weight_g) || 0
      const tunch = parseFloat(addForm.tunch_pct) || 0
      const { pure } = calcFine(w, tunch)

      let custName = 'Direct'
      if (addForm.customer_id) {
        const found = customers.find(c => c.id === addForm.customer_id)
        if (found) custName = found.name
      } else if (addForm.custom_customer && addForm.custom_customer.trim()) {
        custName = addForm.custom_customer.trim()
      }

      const generatedPatlaNo = addForm.patla_no.trim() || `${addForm.silver_type}-${Math.floor(100 + Math.random() * 900)}`

      await inventoryApi.addManual({
        patla_no: generatedPatlaNo,
        weight_g: w,
        tunch_pct: tunch,
        pure_g: pure,
        silver_type: addForm.silver_type,
        source_name: custName,
        customer_name: custName,
        description: `Direct Entry - ${addForm.silver_type === 'B' ? 'Bar' : addForm.silver_type === 'P' ? 'Patla' : 'Kacha'}`,
      })

      toast.success(lang === 'ta' ? 'வெள்ளி வெற்றிகரமாக சேர்க்கப்பட்டது!' : 'Silver added to inventory!')
      setShowAddModal(false)
      setAddForm({
        silver_type: 'K',
        patla_no: '',
        weight_g: '',
        tunch_pct: '',
        customer_id: '',
        custom_customer: 'Direct',
        date: format(new Date(), 'yyyy-MM-dd'),
      })
      load()
    } catch (err) {
      console.error(err)
      toast.error(err.message || 'Failed to add silver to vault')
    } finally {
      setSavingAdd(false)
    }
  }

  // Handle Delete Item
  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this silver bar from vault inventory?')) return
    try {
      setDeletingId(id)
      await inventoryApi.delete(id)
      toast.success('Silver item deleted from inventory')
      load()
    } catch (err) {
      toast.error('Failed to delete item')
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="page" style={{ padding: '24px 32px' }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6" style={{ flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h1 className="page-title" style={{ fontSize: '1.4rem', fontWeight: 800, color: '#f9fafb', letterSpacing: '-0.02em', margin: 0 }}>
            Physical Vault Stock & Bullion Inventory
          </h1>
          <p className="page-sub" style={{ fontSize: '0.85rem', color: '#9ca3af', marginTop: 4 }}>
            Individual Kachas, Patlas, and Bars verified in safe inventory
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            id="btn-transfer-issue"
            className="btn btn-sm"
            onClick={() => {
              if (selected.size === 0) {
                toast.error('Select at least one lot to transfer')
                return
              }
              toast.success(`${selected.size} lot(s) transferred to Issue Voucher`)
              onNavigate('issue', Array.from(selected))
            }}
            style={{
              background: '#4f46e5',
              color: '#fff',
              border: 'none',
              padding: '9px 18px',
              borderRadius: 8,
              fontWeight: 700,
              fontSize: '0.85rem',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              cursor: 'pointer'
            }}
          >
            <Send size={15} /> Transfer Selected to Issue Voucher
          </button>

          <button
            id="btn-add-kacha-bar"
            className="btn btn-gold btn-sm"
            onClick={() => setShowAddModal(true)}
            style={{
              background: '#f59e0b',
              color: '#000',
              border: 'none',
              padding: '9px 18px',
              borderRadius: 8,
              fontWeight: 800,
              fontSize: '0.85rem',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              cursor: 'pointer'
            }}
          >
            <Plus size={16} /> + Add Kacha Bar
          </button>
        </div>
      </div>

      {/* Top 4 Stat Cards */}
      <div className="grid grid-cols-4 gap-4 mb-6" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
        {/* Card 1: In-Stock Kachas */}
        <div style={{
          background: '#0a0f1d',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: 12,
          padding: '18px 20px',
        }}>
          <div style={{ fontSize: '0.78rem', color: '#9ca3af', fontWeight: 600 }}>In-Stock Kachas</div>
          <div className="font-mono" style={{ fontSize: '1.9rem', fontWeight: 900, color: '#f59e0b', marginTop: 4 }}>
            {inStockCount}
          </div>
          <div style={{ fontSize: '0.78rem', color: '#6b7280', marginTop: 2 }}>Available Bars</div>
        </div>

        {/* Card 2: Total Gross Weight */}
        <div style={{
          background: '#0a0f1d',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: 12,
          padding: '18px 20px',
        }}>
          <div style={{ fontSize: '0.78rem', color: '#9ca3af', fontWeight: 600 }}>Total Gross Weight</div>
          <div className="font-mono" style={{ fontSize: '1.9rem', fontWeight: 900, color: '#f9fafb', marginTop: 4 }}>
            {totalGrossWeight.toLocaleString('en-IN', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} g
          </div>
          <div className="font-mono" style={{ fontSize: '0.78rem', color: '#6b7280', marginTop: 2 }}>
            {gramsToKg(totalGrossWeight)} KG
          </div>
        </div>

        {/* Card 3: Total Pure Silver (999.0) */}
        <div style={{
          background: '#0a0f1d',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: 12,
          padding: '18px 20px',
        }}>
          <div style={{ fontSize: '0.78rem', color: '#9ca3af', fontWeight: 600 }}>Total Pure Silver (999.0)</div>
          <div className="font-mono" style={{ fontSize: '1.9rem', fontWeight: 900, color: '#10b981', marginTop: 4 }}>
            {totalPureSilver.toLocaleString('en-IN')} g
          </div>
          <div className="font-mono" style={{ fontSize: '0.78rem', color: '#059669', marginTop: 2 }}>
            {gramsToKg(totalPureSilver)} KG
          </div>
        </div>

        {/* Card 4: Selected Lots Calc */}
        <div style={{
          background: '#0a0f1d',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: 12,
          padding: '18px 20px',
        }}>
          <div style={{ fontSize: '0.78rem', color: '#9ca3af', fontWeight: 600 }}>Selected Lots Calc</div>
          <div className="font-mono" style={{ fontSize: '1.9rem', fontWeight: 900, color: '#38bdf8', marginTop: 4 }}>
            {selPureSilver.toLocaleString('en-IN')} g
          </div>
          <div className="font-mono" style={{ fontSize: '0.78rem', color: '#0284c7', marginTop: 2 }}>
            {selected.size} items • {gramsToKg(selGrossWeight)} KG Gross
          </div>
        </div>
      </div>

      {/* Main Table */}
      {loading ? (
        <div className="loading-overlay" style={{ padding: 40 }}><div className="spinner" /> Loading vault inventory…</div>
      ) : items.length === 0 ? (
        <div className="empty-state" style={{ padding: 40 }}>
          <Package size={48} style={{ opacity: 0.3 }} />
          <div className="empty-state-title mt-3">Vault inventory is currently empty</div>
          <button className="btn btn-gold btn-sm mt-3" onClick={() => setShowAddModal(true)}>
            + Add Kacha Bar
          </button>
        </div>
      ) : (
        <div className="table-wrap" style={{ background: '#070b13', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, overflowX: 'auto' }}>
          <table style={{ minWidth: 840, width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', background: '#090e18' }}>
                <th style={{ width: 44, padding: '14px 16px', textAlign: 'center' }}>
                  <button
                    className="btn btn-ghost btn-sm btn-icon"
                    onClick={toggleAll}
                    style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#9ca3af' }}
                  >
                    {selected.size === inStockCount && inStockCount > 0 ? (
                      <CheckSquare size={16} style={{ color: '#f59e0b' }} />
                    ) : (
                      <Square size={16} />
                    )}
                  </button>
                </th>
                <th style={{ padding: '14px 16px', fontSize: '0.72rem', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  DATE ADDED
                </th>
                <th style={{ padding: '14px 16px', fontSize: '0.72rem', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  KACHA / PATLA NO.
                </th>
                <th style={{ padding: '14px 16px', fontSize: '0.72rem', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  FROM CUSTOMER / SOURCE
                </th>
                <th style={{ padding: '14px 16px', fontSize: '0.72rem', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  GROSS WT (G)
                </th>
                <th style={{ padding: '14px 16px', fontSize: '0.72rem', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  TUNCH (%)
                </th>
                <th style={{ padding: '14px 16px', fontSize: '0.72rem', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  PURE SILVER (G)
                </th>
                <th style={{ padding: '14px 16px', fontSize: '0.72rem', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  STATUS
                </th>
                <th style={{ padding: '14px 16px', fontSize: '0.72rem', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.06em', textAlign: 'center' }}>
                  ACTION
                </th>
              </tr>
            </thead>
            <tbody>
              {items.map(item => {
                const isChecked = selected.has(item.id)
                const dateDisplay = item.added_at ? format(parseISO(item.added_at), 'yyyy-MM-dd') : '2026-10-11'
                const silverType = item.silver_type || 'K'
                const typeLabel = silverType === 'B' ? 'Bar' : silverType === 'P' ? 'Patla' : 'Kacha'

                return (
                  <tr
                    key={item.id}
                    style={{
                      borderBottom: '1px solid rgba(255,255,255,0.04)',
                      background: isChecked ? 'rgba(245, 158, 11, 0.08)' : 'transparent',
                      transition: 'background 0.15s ease'
                    }}
                  >
                    <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                      <button
                        className="btn btn-ghost btn-sm btn-icon"
                        onClick={() => toggleSelect(item.id)}
                        style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#9ca3af' }}
                      >
                        {isChecked ? (
                          <CheckSquare size={16} style={{ color: '#f59e0b' }} />
                        ) : (
                          <Square size={16} />
                        )}
                      </button>
                    </td>

                    <td className="font-mono text-sm" style={{ padding: '12px 16px', color: '#d1d5db' }}>
                      {dateDisplay}
                    </td>

                    <td style={{ padding: '12px 16px' }}>
                      <div className="flex items-center gap-2">
                        <span
                          className="font-mono font-bold"
                          style={{
                            color: '#f59e0b',
                            fontSize: '0.9rem',
                            letterSpacing: '0.03em'
                          }}
                        >
                          {item.patla_no}
                        </span>
                        <span
                          style={{
                            fontSize: '0.68rem',
                            fontWeight: 700,
                            padding: '2px 6px',
                            borderRadius: 4,
                            background: silverType === 'B' ? '#1e3a8a' : silverType === 'P' ? '#3730a3' : '#312e81',
                            color: '#93c5fd'
                          }}
                        >
                          {silverType}
                        </span>
                      </div>
                    </td>

                    <td style={{ padding: '12px 16px', color: '#f3f4f6', fontWeight: 500, fontSize: '0.9rem' }}>
                      {item.source_name || 'Direct'}
                    </td>

                    <td className="font-mono" style={{ padding: '12px 16px', color: '#e5e7eb', fontSize: '0.9rem' }}>
                      {parseFloat(item.weight_g).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} g
                    </td>

                    <td className="font-mono" style={{ padding: '12px 16px', color: '#38bdf8', fontSize: '0.9rem' }}>
                      {parseFloat(item.tunch_pct).toFixed(2)}%
                    </td>

                    <td className="font-mono font-bold" style={{ padding: '12px 16px', color: '#10b981', fontSize: '0.95rem' }}>
                      {parseFloat(item.pure_g).toLocaleString('en-IN')} g
                    </td>

                    <td style={{ padding: '12px 16px' }}>
                      <span
                        style={{
                          background: 'rgba(16, 185, 129, 0.15)',
                          color: '#34d399',
                          fontSize: '0.72rem',
                          fontWeight: 800,
                          padding: '3px 8px',
                          borderRadius: 6,
                          letterSpacing: '0.05em'
                        }}
                      >
                        IN_STOCK
                      </span>
                    </td>

                    <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={() => handleDelete(item.id)}
                        disabled={deletingId === item.id}
                        style={{
                          color: '#f43f5e',
                          background: 'transparent',
                          border: 'none',
                          fontSize: '0.82rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                          padding: '4px 8px'
                        }}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Direct Add Silver Modal */}
      {showAddModal && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal modal-md" style={{ maxWidth: 500, background: '#0e1420', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 14 }}>
            {/* Modal Header */}
            <div className="modal-header" style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', padding: '16px 20px' }}>
              <div className="flex items-center gap-2">
                <Plus size={20} style={{ color: '#f59e0b' }} />
                <span className="modal-title" style={{ fontSize: '1.15rem', fontWeight: 800, color: '#f3f4f6' }}>
                  Add Silver to Vault Inventory
                </span>
              </div>
              <button className="btn btn-ghost btn-sm btn-icon" onClick={() => setShowAddModal(false)} style={{ color: '#9ca3af' }}>
                <X size={18} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="modal-body" style={{ padding: '20px' }}>
              <div className="flex flex-col gap-4">
                {/* Silver Type Capsule Pill (K / P / B) */}
                <div className="form-group">
                  <label className="form-label" style={{ fontSize: '0.82rem', color: '#9ca3af', marginBottom: 6 }}>
                    Type of Silver (Katcha / Patla / Bar): <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {[
                      { key: 'K', label: 'K (Katcha)' },
                      { key: 'P', label: 'P (Patla)' },
                      { key: 'B', label: 'B (Bar - 100% Tunch)' },
                    ].map(typeOpt => {
                      const isActive = addForm.silver_type === typeOpt.key
                      return (
                        <button
                          key={typeOpt.key}
                          type="button"
                          onClick={() => handleTypeChange(typeOpt.key)}
                          style={{
                            flex: 1,
                            padding: '10px 8px',
                            borderRadius: 8,
                            fontSize: '0.82rem',
                            fontWeight: 800,
                            cursor: 'pointer',
                            transition: 'all 0.15s ease',
                            background: isActive ? 'rgba(245, 158, 11, 0.2)' : '#070b13',
                            color: isActive ? '#f59e0b' : '#9ca3af',
                            border: isActive ? '1.5px solid #f59e0b' : '1px solid rgba(255,255,255,0.1)',
                          }}
                        >
                          {typeOpt.label}
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* Number of the silver (Kacha / Patla No.) */}
                <div className="form-group">
                  <label className="form-label" style={{ fontSize: '0.82rem', color: '#9ca3af', marginBottom: 6 }}>
                    Number / Bar ID (Kacha / Patla No.):
                  </label>
                  <input
                    type="text"
                    className="form-control font-mono"
                    value={addForm.patla_no}
                    onChange={e => setAddForm(p => ({ ...p, patla_no: e.target.value }))}
                    placeholder={`e.g. ${addForm.silver_type}-101`}
                    style={{ background: '#090d16', borderColor: '#222f46', color: '#f59e0b', fontWeight: 700, height: 42, borderRadius: 8 }}
                  />
                </div>

                {/* Weight (Gross Wt g) and Tunch (%) */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div className="form-group">
                    <label className="form-label" style={{ fontSize: '0.82rem', color: '#9ca3af', marginBottom: 6 }}>
                      Gross Weight (g): <span style={{ color: '#ef4444' }}>*</span>
                    </label>
                    <input
                      type="number"
                      step="any"
                      min="0"
                      className="form-control font-mono"
                      value={addForm.weight_g}
                      onChange={e => setAddForm(p => ({ ...p, weight_g: e.target.value }))}
                      placeholder="1000.00"
                      style={{ background: '#090d16', borderColor: '#222f46', color: '#f9fafb', height: 42, borderRadius: 8, fontWeight: 700 }}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label" style={{ fontSize: '0.82rem', color: '#9ca3af', marginBottom: 6 }}>
                      Tunch (%): <span style={{ color: '#ef4444' }}>*</span>
                    </label>
                    <input
                      type="number"
                      step="any"
                      min="0"
                      max="100"
                      className="form-control font-mono"
                      value={addForm.tunch_pct}
                      onChange={e => setAddForm(p => ({ ...p, tunch_pct: e.target.value }))}
                      placeholder={addForm.silver_type === 'B' ? '100.00' : '99.90'}
                      style={{ background: '#090d16', borderColor: '#222f46', color: '#38bdf8', height: 42, borderRadius: 8, fontWeight: 700 }}
                    />
                  </div>
                </div>

                {/* Calculated Pure Silver Preview */}
                {parseFloat(addForm.weight_g) > 0 && parseFloat(addForm.tunch_pct) > 0 && (
                  <div style={{
                    background: '#070b13',
                    border: '1px solid rgba(16, 185, 129, 0.3)',
                    borderRadius: 8,
                    padding: '10px 14px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}>
                    <span style={{ fontSize: '0.82rem', color: '#9ca3af' }}>Calculated Pure Silver (999.0):</span>
                    <span className="font-mono" style={{ fontSize: '1.1rem', fontWeight: 800, color: '#10b981' }}>
                      {calcFine(parseFloat(addForm.weight_g) || 0, parseFloat(addForm.tunch_pct) || 0).pure.toLocaleString('en-IN')} g
                    </span>
                  </div>
                )}

                {/* Customer (Optional, Default 'Direct') */}
                <div className="form-group">
                  <label className="form-label" style={{ fontSize: '0.82rem', color: '#9ca3af', marginBottom: 6 }}>
                    Customer / Source (Optional, default 'Direct'):
                  </label>
                  <select
                    className="form-control mb-2"
                    value={addForm.customer_id}
                    onChange={e => {
                      const val = e.target.value
                      setAddForm(p => ({
                        ...p,
                        customer_id: val,
                        custom_customer: val ? '' : 'Direct'
                      }))
                    }}
                    style={{ background: '#090d16', borderColor: '#222f46', color: '#f9fafb', height: 42, borderRadius: 8 }}
                  >
                    <option value="">Direct Entry (No Customer)</option>
                    {customers.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="modal-footer" style={{ borderTop: '1px solid rgba(255,255,255,0.08)', padding: '14px 20px', display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
              <button
                className="btn btn-ghost"
                onClick={() => setShowAddModal(false)}
                style={{ color: '#9ca3af', background: 'transparent', border: 'none', padding: '8px 18px' }}
              >
                Cancel
              </button>
              <button
                id="btn-save-vault-silver"
                className="btn btn-gold"
                onClick={handleSaveAdd}
                disabled={savingAdd}
                style={{
                  background: '#f59e0b',
                  color: '#000',
                  fontWeight: 800,
                  padding: '10px 22px',
                  borderRadius: 8,
                  border: 'none',
                  cursor: savingAdd ? 'not-allowed' : 'pointer'
                }}
              >
                {savingAdd ? 'Saving…' : 'Add to Inventory'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

