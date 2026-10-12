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
      const calc = calcFine(w, tunch)

      const selectedCust = customers.find(c => c.id === addForm.customer_id)
      const sourceName = selectedCust ? selectedCust.name : (addForm.custom_customer || 'Direct')

      await inventoryApi.addDirect({
        silver_type: addForm.silver_type,
        patla_no: addForm.patla_no || `${addForm.silver_type}-${Date.now().toString().slice(-4)}`,
        weight_g: w,
        tunch_pct: tunch,
        pure_g: calc.pure,
        customer_id: addForm.customer_id || null,
        source_name: sourceName,
        date: addForm.date,
      })

      toast.success(lang === 'ta' ? 'வெள்ளி வெற்றிகரமாக சேர்க்கப்பட்டது!' : 'Silver added to vault inventory!')
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
      toast.error(err.message || 'Failed to add silver to inventory')
    } finally {
      setSavingAdd(false)
    }
  }

  // Handle Delete Inventory Lot
  const handleDelete = async (id) => {
    if (!window.confirm(lang === 'ta' ? 'இந்த உருப்படியை நிச்சயமாக நீக்க வேண்டுமா?' : 'Are you sure you want to delete this inventory item?')) {
      return
    }
    setDeletingId(id)
    try {
      await inventoryApi.deleteItem(id)
      toast.success(lang === 'ta' ? 'உருப்படி நீக்கப்பட்டது' : 'Item removed from inventory')
      load()
    } catch (err) {
      toast.error('Failed to delete item')
    } finally {
      setDeletingId(null)
    }
  }

  // Handle Transfer Selected to Issue Voucher
  const handleTransferToIssue = () => {
    if (selected.size === 0) {
      toast.error('Select at least one kacha bar first')
      return
    }
    const selectedLots = items.filter(i => selected.has(i.id))
    sessionStorage.setItem('krs_selected_issue_lots', JSON.stringify(selectedLots))
    toast.success(`${selectedLots.length} bars transferred to Issue Voucher`)
    if (onNavigate) {
      onNavigate('issue')
    }
  }

  const typeOptions = [
    { type: 'K', label: 'Kacha (K)' },
    { type: 'P', label: 'Patla (P)' },
    { type: 'B', label: 'Bar (B)' },
  ]

  return (
    <div className="page">
      {/* Page Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">{t('vault_stock', 'Vault Stock & Inventory')}</h1>
          <p className="page-sub">
            {inStockCount} {t('kachas_in_stock', 'kachas & bars in stock')} • {gramsToKg(totalPureSilver)} KG {t('pure_silver', 'pure silver available')}
          </p>
        </div>

        <div className="flex gap-2">
          <button
            id="btn-transfer-issue-voucher"
            className="btn btn-secondary"
            onClick={handleTransferToIssue}
            disabled={selected.size === 0}
          >
            <Send size={15} /> Transfer Selected to Issue Voucher
          </button>

          <button
            id="btn-add-kacha-bar"
            className="btn btn-gold"
            onClick={() => setShowAddModal(true)}
          >
            <Plus size={16} /> + Add Kacha Bar
          </button>
        </div>
      </div>

      {/* Top 4 Stat Cards */}
      <div className="stats-grid mb-6">
        {/* Card 1: In-Stock Kachas */}
        <div className="stat-card">
          <div className="stat-label">In-Stock Kachas</div>
          <div className="stat-value font-mono text-gold">
            {inStockCount}
          </div>
          <div className="stat-sub">Available Bars</div>
        </div>

        {/* Card 2: Total Gross Weight */}
        <div className="stat-card">
          <div className="stat-label">Total Gross Weight</div>
          <div className="stat-value font-mono">
            {totalGrossWeight.toLocaleString('en-IN', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} g
          </div>
          <div className="stat-sub font-mono">
            {gramsToKg(totalGrossWeight)} KG Gross
          </div>
        </div>

        {/* Card 3: Total Pure Silver (999.0) */}
        <div className="stat-card">
          <div className="stat-label">Total Pure Silver (999.0)</div>
          <div className="stat-value font-mono text-success">
            {totalPureSilver.toLocaleString('en-IN')} g
          </div>
          <div className="stat-sub font-mono">
            {gramsToKg(totalPureSilver)} KG Fine
          </div>
        </div>

        {/* Card 4: Selected Lots Calc */}
        <div className="stat-card" style={{ borderLeft: '4px solid var(--clr-gold)' }}>
          <div className="stat-label">Selected Lots Calc</div>
          <div className="stat-value font-mono text-gold">
            {selPureSilver.toLocaleString('en-IN')} g
          </div>
          <div className="stat-sub">
            {selected.size} items • {gramsToKg(selGrossWeight)} KG Gross
          </div>
        </div>
      </div>

      {/* Main Table */}
      {loading ? (
        <div className="loading-overlay"><div className="spinner" /> Loading vault inventory…</div>
      ) : items.length === 0 ? (
        <div className="empty-state">
          <Package size={48} style={{ opacity: 0.3 }} />
          <div className="empty-state-title mt-3">Vault inventory is currently empty</div>
          <button className="btn btn-gold btn-sm mt-3" onClick={() => setShowAddModal(true)}>
            + Add Kacha Bar
          </button>
        </div>
      ) : (
        <>
          <div className="table-scroll-hint mb-2">{t('swipe_hint')}</div>
          <div className="table-wrap" style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
            <table style={{ minWidth: 840 }}>
              <thead>
                <tr>
                  <th style={{ width: 44, textAlign: 'center' }}>
                    <button
                      className="btn btn-ghost btn-sm btn-icon"
                      onClick={toggleAll}
                      style={{ padding: 0 }}
                    >
                      {selected.size === inStockCount && inStockCount > 0 ? (
                        <CheckSquare size={16} className="text-gold" />
                      ) : (
                        <Square size={16} />
                      )}
                    </button>
                  </th>
                  <th>DATE ADDED</th>
                  <th>KACHA / PATLA NO.</th>
                  <th>FROM CUSTOMER / SOURCE</th>
                  <th className="font-mono text-right">GROSS WT (G)</th>
                  <th className="font-mono text-right">TUNCH (%)</th>
                  <th className="font-mono text-right">PURE SILVER (G)</th>
                  <th style={{ textAlign: 'center' }}>STATUS</th>
                  <th style={{ textAlign: 'center' }}>ACTION</th>
                </tr>
              </thead>
              <tbody>
                {items.map(item => {
                  const isChecked = selected.has(item.id)
                  const dateDisplay = item.added_at ? format(parseISO(item.added_at), 'yyyy-MM-dd') : '2026-10-11'
                  const silverType = item.silver_type || 'K'

                  return (
                    <tr
                      key={item.id}
                      style={{
                        background: isChecked ? 'var(--clr-gold-bg)' : undefined,
                      }}
                    >
                      <td style={{ textAlign: 'center' }}>
                        <button
                          className="btn btn-ghost btn-sm btn-icon"
                          onClick={() => toggleSelect(item.id)}
                          style={{ padding: 0 }}
                        >
                          {isChecked ? (
                            <CheckSquare size={16} className="text-gold" />
                          ) : (
                            <Square size={16} />
                          )}
                        </button>
                      </td>

                      <td className="font-mono text-sm text-secondary">
                        {dateDisplay}
                      </td>

                      <td>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-gold">
                            {item.patla_no}
                          </span>
                          <span className="badge badge-silver font-mono" style={{ fontSize: '0.7rem' }}>
                            {silverType}
                          </span>
                        </div>
                      </td>

                      <td className="font-semibold text-primary">
                        {item.source_name || 'Direct'}
                      </td>

                      <td className="font-mono text-right">
                        {parseFloat(item.weight_g).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} g
                      </td>

                      <td className="font-mono text-right">
                        {parseFloat(item.tunch_pct).toFixed(2)}%
                      </td>

                      <td className="font-mono font-bold text-right text-success">
                        {parseFloat(item.pure_g).toLocaleString('en-IN')} g
                      </td>

                      <td style={{ textAlign: 'center' }}>
                        <span className="badge badge-green">
                          IN_STOCK
                        </span>
                      </td>

                      <td style={{ textAlign: 'center' }}>
                        <button
                          className="btn btn-ghost btn-sm btn-icon text-danger"
                          onClick={() => handleDelete(item.id)}
                          disabled={deletingId === item.id}
                          title="Delete item"
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Add Direct Silver Modal */}
      {showAddModal && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal modal-md">
            {/* Modal Header */}
            <div className="modal-header">
              <div className="flex items-center gap-2">
                <Package size={20} className="text-gold" />
                <span className="modal-title">
                  Add Silver to Vault Inventory
                </span>
              </div>
              <button className="btn btn-ghost btn-sm btn-icon" onClick={() => setShowAddModal(false)}>
                <X size={18} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="modal-body">
              <div className="flex flex-col gap-4">
                {/* Silver Type Selector: K, P, B */}
                <div className="form-group">
                  <label className="form-label">
                    Silver Type (Kacha / Patla / Bar):
                  </label>
                  <div className="flex gap-2">
                    {typeOptions.map(typeOpt => {
                      const isActive = addForm.silver_type === typeOpt.type
                      return (
                        <button
                          key={typeOpt.type}
                          type="button"
                          className={`btn flex-1 font-mono font-bold ${isActive ? 'btn-gold' : 'btn-secondary'}`}
                          onClick={() => handleTypeChange(typeOpt.type)}
                        >
                          {typeOpt.label}
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* Number of the silver (Kacha / Patla No.) */}
                <div className="form-group">
                  <label className="form-label">
                    Number / Bar ID (Kacha / Patla No.):
                  </label>
                  <input
                    type="text"
                    className="form-control font-mono font-bold"
                    value={addForm.patla_no}
                    onChange={e => setAddForm(p => ({ ...p, patla_no: e.target.value }))}
                    placeholder={`e.g. ${addForm.silver_type}-101`}
                  />
                </div>

                {/* Weight (Gross Wt g) and Tunch (%) */}
                <div className="grid grid-cols-2 gap-3" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div className="form-group">
                    <label className="form-label">
                      Gross Weight (g): <span className="text-danger">*</span>
                    </label>
                    <input
                      type="number"
                      step="any"
                      min="0"
                      className="form-control font-mono font-bold"
                      value={addForm.weight_g}
                      onChange={e => setAddForm(p => ({ ...p, weight_g: e.target.value }))}
                      placeholder="1000.00"
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">
                      Tunch (%): <span className="text-danger">*</span>
                    </label>
                    <input
                      type="number"
                      step="any"
                      min="0"
                      max="100"
                      className="form-control font-mono font-bold"
                      value={addForm.tunch_pct}
                      onChange={e => setAddForm(p => ({ ...p, tunch_pct: e.target.value }))}
                      placeholder={addForm.silver_type === 'B' ? '100.00' : '99.90'}
                    />
                  </div>
                </div>

                {/* Calculated Pure Silver Preview */}
                {parseFloat(addForm.weight_g) > 0 && parseFloat(addForm.tunch_pct) > 0 && (
                  <div className="card card-gold" style={{ padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span className="text-xs text-secondary font-semibold">Calculated Pure Silver (999.0):</span>
                    <span className="font-mono text-success font-bold" style={{ fontSize: '1.1rem' }}>
                      {calcFine(parseFloat(addForm.weight_g) || 0, parseFloat(addForm.tunch_pct) || 0).pure.toLocaleString('en-IN')} g
                    </span>
                  </div>
                )}

                {/* Customer (Optional, Default 'Direct') */}
                <div className="form-group">
                  <label className="form-label">
                    Customer / Source (Optional, default 'Direct'):
                  </label>
                  <select
                    className="form-control"
                    value={addForm.customer_id}
                    onChange={e => {
                      const val = e.target.value
                      setAddForm(p => ({
                        ...p,
                        customer_id: val,
                        custom_customer: val ? '' : 'Direct'
                      }))
                    }}
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
            <div className="modal-footer">
              <button
                className="btn btn-ghost"
                onClick={() => setShowAddModal(false)}
              >
                Cancel
              </button>
              <button
                id="btn-save-vault-silver"
                className="btn btn-gold"
                onClick={handleSaveAdd}
                disabled={savingAdd}
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
