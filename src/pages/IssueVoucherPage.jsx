import { useState, useEffect, useRef, useMemo } from 'react'
import { Plus, Trash2, Printer, Save, CheckSquare, Square, Search, Package, ArrowRight, CornerDownRight, RotateCcw, Download } from 'lucide-react'
import { format } from 'date-fns'
import toast from 'react-hot-toast'
import { calcFine, gramsToKg, formatGrams } from '../lib/silverCalc'
import { customersApi, vouchersApi, inventoryApi } from '../lib/api'
import { downloadIssueVoucherPdf, printIssueVoucher } from '../lib/pdfGenerator'
import { useLanguage } from '../context/LanguageContext'

const emptyCustomLot = () => ({
  _key: Math.random().toString(36).slice(2),
  silver_type: 'K',
  patla_no: '',
  weight_g: '',
  tunch_pct: '',
  raw_fine_g: 0,
  pure_g: 0,
  is_custom: true,
})

export default function IssueVoucherPage({ initialSelectedIds = [] }) {
  const { t } = useLanguage()
  const [customers, setCustomers] = useState([])
  const [customerId, setCustomerId] = useState('')
  const [voucherDate, setVoucherDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [notes, setNotes] = useState('')

  // Vault stock
  const [vaultItems, setVaultItems] = useState([])
  const [loadingVault, setLoadingVault] = useState(true)
  const [vaultSearch, setVaultSearch] = useState('')

  // Selected items from vault: Set of inventory item IDs
  const [selectedIds, setSelectedIds] = useState(new Set(initialSelectedIds))

  // Additional custom / unvaulted lots (optional)
  const [customLots, setCustomLots] = useState([])

  const [saving, setSaving] = useState(false)
  const [savedVoucher, setSavedVoucher] = useState(null)
  const printRef = useRef(null)

  // Load customers and in-stock vault items
  const loadData = async () => {
    setLoadingVault(true)
    try {
      const [cData, iData] = await Promise.all([
        customersApi.getAll().catch(() => []),
        inventoryApi.getInStock().catch(() => []),
      ])
      setCustomers(cData || [])
      setVaultItems(iData || [])

      if (initialSelectedIds && initialSelectedIds.length > 0) {
        setSelectedIds(new Set(initialSelectedIds))
      }
    } catch (err) {
      toast.error('Failed to load vault inventory')
    } finally {
      setLoadingVault(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const selectedCustomer = customers.find(c => c.id === customerId)

  // Toggle selection of a vault item
  const toggleVaultItem = (id) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  // Filter vault items by search
  const filteredVault = useMemo(() => {
    const q = vaultSearch.trim().toLowerCase()
    if (!q) return vaultItems
    return vaultItems.filter(item =>
      (item.patla_no && item.patla_no.toLowerCase().includes(q)) ||
      (item.description && item.description.toLowerCase().includes(q)) ||
      String(item.weight_g).includes(q) ||
      String(item.tunch_pct).includes(q)
    )
  }, [vaultItems, vaultSearch])

  // Select all filtered vault items
  const selectAllFiltered = () => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      filteredVault.forEach(item => next.add(item.id))
      return next
    })
  }

  // Clear all vault selections
  const clearSelection = () => {
    setSelectedIds(new Set())
  }

  // Array of currently chosen vault items
  const chosenVaultItems = useMemo(() => {
    return vaultItems.filter(item => selectedIds.has(item.id))
  }, [vaultItems, selectedIds])

  // Custom lot handling
  const updateCustomLot = (key, field, value) => {
    setCustomLots(prev => prev.map(l => {
      if (l._key !== key) return l
      const updated = { ...l, [field]: value }
      if (field === 'silver_type' && value === 'B') {
        updated.tunch_pct = '100'
      }
      const w = parseFloat(updated.weight_g) || 0
      const t = parseFloat(updated.tunch_pct) || 0
      const { rawFine, pure } = calcFine(w, t)
      return { ...updated, raw_fine_g: rawFine, pure_g: pure }
    }))
  }

  const addCustomLot = () => setCustomLots(p => [...p, emptyCustomLot()])
  const removeCustomLot = (key) => setCustomLots(p => p.filter(l => l._key !== key))

  // Combined totals of chosen vault items + valid custom lots
  const validCustomLots = customLots.filter(l => l.weight_g && l.tunch_pct)

  const totalVaultWeight = chosenVaultItems.reduce((s, i) => s + (parseFloat(i.weight_g) || 0), 0)
  const totalCustomWeight = validCustomLots.reduce((s, l) => s + (parseFloat(l.weight_g) || 0), 0)
  const totalWeight = totalVaultWeight + totalCustomWeight

  const totalVaultPure = chosenVaultItems.reduce((s, i) => s + (parseFloat(i.pure_g) || 0), 0)
  const totalCustomPure = validCustomLots.reduce((s, l) => s + (parseFloat(l.pure_g) || 0), 0)
  const totalPure = totalVaultPure + totalCustomPure

  const totalCount = chosenVaultItems.length + validCustomLots.length

  const avgTunch = totalWeight > 0
    ? ((chosenVaultItems.reduce((s, i) => s + (parseFloat(i.tunch_pct) || 0) * (parseFloat(i.weight_g) || 0), 0) +
        validCustomLots.reduce((s, l) => s + (parseFloat(l.tunch_pct) || 0) * (parseFloat(l.weight_g) || 0), 0)) / totalWeight)
    : 0

  /* ── Save Issue Voucher ── */
  const handleSave = async () => {
    if (!customerId) {
      toast.error('Please select a customer / member')
      return
    }
    if (totalCount === 0) {
      toast.error('Please select at least one vault inventory kacha to issue')
      return
    }

    setSaving(true)
    try {
      // Build lots payload
      const lots = [
        ...chosenVaultItems.map(item => {
          const w = parseFloat(item.weight_g) || 0
          const t = parseFloat(item.tunch_pct) || 0
          const { rawFine } = calcFine(w, t)
          return {
            patla_no: item.patla_no,
            weight_g: w,
            tunch_pct: t,
            raw_fine_g: rawFine,
            pure_g: parseFloat(item.pure_g) || 0,
            inventory_id: item.id,
          }
        }),
        ...validCustomLots.map(l => ({
          patla_no: l.patla_no || 'Custom Lot',
          weight_g: parseFloat(l.weight_g) || 0,
          tunch_pct: parseFloat(l.tunch_pct) || 0,
          raw_fine_g: l.raw_fine_g,
          pure_g: l.pure_g,
        })),
      ]

      const inventoryIds = chosenVaultItems.map(i => i.id)

      const voucher = await vouchersApi.createIssue({
        customerId,
        voucherDate,
        lots,
        inventoryIds,
      })

      const totalGrossG = lots.reduce((s, l) => s + (parseFloat(l.weight_g) || 0), 0)
      const totalPureG = lots.reduce((s, l) => s + (parseFloat(l.pure_g) || 0), 0)

      const voucherData = {
        voucherNo: voucher.voucher_no,
        voucherDate,
        customer: selectedCustomer,
        lots,
        totalGrossG,
        totalPureG,
      }

      toast.success(`Issue Voucher #${voucher.voucher_no} saved! ${inventoryIds.length} vault kachas marked as issued.`)
      setSavedVoucher({
        ...voucher,
        lots,
        customer: selectedCustomer,
        totalGrossG,
        totalPureG,
        notes,
      })

      // Auto-download PDF
      try {
        downloadIssueVoucherPdf(voucherData)
      } catch (pdfErr) {
        console.warn('PDF export notice:', pdfErr)
      }

      // Reset selection and refresh vault
      setSelectedIds(new Set())
      setCustomLots([])
      setCustomerId('')
      setNotes('')
      loadData()
    } catch (err) {
      console.error(err)
      toast.error(err.message || 'Failed to save issue voucher')
    } finally {
      setSaving(false)
    }
  }

  const getVoucherParams = () => {
    if (!savedVoucher) return null
    return {
      voucherNo: savedVoucher.voucher_no,
      voucherDate: savedVoucher.voucher_date || voucherDate,
      customer: savedVoucher.customer || selectedCustomer || { name: 'Customer' },
      lots: savedVoucher.lots || [],
      totalGrossG: savedVoucher.totalGrossG || 0,
      totalPureG: savedVoucher.totalPureG || 0,
    }
  }

  const handlePrint = () => {
    const params = getVoucherParams()
    if (!params) {
      toast.error('Save the voucher first to print')
      return
    }
    printIssueVoucher(params)
  }

  const handleDownload = () => {
    const params = getVoucherParams()
    if (!params) {
      toast.error('Save the voucher first to download')
      return
    }
    downloadIssueVoucherPdf(params)
  }

  return (
    <div className="page">
      {/* Page Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">{t('issue_voucher_title', 'Issue Voucher')}</h1>
          <p className="page-sub">
            {t('issue_voucher_sub', 'Issue existing vault silver inventory to customers / chit members — deducts from vault stock')}
          </p>
        </div>
        <div className="flex gap-2">
          {savedVoucher && (
            <>
              <button id="btn-download-issue-pdf" className="btn btn-secondary" onClick={handleDownload}>
                <Download size={14} /> Download PDF
              </button>
              <button id="btn-print-issue" className="btn btn-ghost" onClick={handlePrint}>
                <Printer size={14} /> {t('btn_print_voucher', 'Print Voucher')}
              </button>
            </>
          )}
          <button
            id="btn-save-issue-voucher"
            className="btn btn-gold"
            onClick={handleSave}
            disabled={saving || totalCount === 0}
          >
            {saving ? (
              <><div className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} /> {t('saving', 'Saving…')}</>
            ) : (
              <><Save size={14} /> {t('btn_confirm_issue', 'Save Issue Voucher')}</>
            )}
          </button>
        </div>
      </div>

      {/* Recipient & Voucher Info Card */}
      <div className="card mb-6">
        <div className="card-header">
          <span className="card-title">{t('recipient_info', 'Recipient & Voucher Information')}</span>
          <span className="badge badge-maroon">{t('outgoing_badge', 'Outgoing Silver Delivery')}</span>
        </div>

        <div className="form-grid form-grid-3">
          {/* Voucher # */}
          <div className="form-group">
            <label className="form-label">{t('voucher_no', 'Voucher No.')}</label>
            <div style={{
              background: 'var(--clr-surface-2)',
              border: '1.5px solid var(--clr-border)',
              borderRadius: 'var(--r-sm)',
              padding: '11px 16px',
              color: 'var(--clr-gold)',
              fontSize: '0.92rem',
              fontWeight: 700,
            }}>
              {savedVoucher ? `#IV-${String(savedVoucher.voucher_no).padStart(4, '0')}` : t('auto_next_iv', 'Auto (Next IV)')}
            </div>
          </div>

          {/* Customer / Member */}
          <div className="form-group" style={{ gridColumn: 'span 1' }}>
            <label className="form-label" htmlFor="issue-customer">{t('cust_member_req', 'Customer / Member Name *')}</label>
            <select
              id="issue-customer"
              className="form-control"
              value={customerId}
              onChange={e => setCustomerId(e.target.value)}
            >
              <option value="">{t('select_customer', '— Select Customer / Member —')}</option>
              {customers.map(c => (
                <option key={c.id} value={c.id}>
                  {c.name} {c.phone ? `(${c.phone})` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Date */}
          <div className="form-group">
            <label className="form-label" htmlFor="issue-date">{t('issue_date', 'Issue Date')}</label>
            <input
              id="issue-date"
              type="date"
              className="form-control"
              value={voucherDate}
              onChange={e => setVoucherDate(e.target.value)}
            />
          </div>
        </div>

        {selectedCustomer && (
          <div style={{
            marginTop: 16,
            padding: '10px 16px',
            background: 'var(--clr-surface-2)',
            borderRadius: 'var(--r-sm)',
            border: '1px solid var(--clr-border-soft)',
            fontSize: '0.84rem',
            display: 'flex',
            gap: 20,
            flexWrap: 'wrap',
          }}>
            <span><strong>{t('th_customer', 'Name')}:</strong> {selectedCustomer.name}</span>
            {selectedCustomer.phone && <span><strong>{t('th_phone', 'Phone')}:</strong> {selectedCustomer.phone}</span>}
            {selectedCustomer.city && <span><strong>{t('th_city', 'City')}:</strong> {selectedCustomer.city}</span>}
          </div>
        )}
      </div>

      {/* Main Responsive Workflow Layout */}
      <div className="issue-voucher-layout">
        
        {/* LEFT COLUMN: Available Vault Stock Picker */}
        <div className="card">
          <div className="card-header">
            <div>
              <span className="card-title">{t('vault_inv_title', '1. Available Vault Inventory')}</span>
              <p className="text-xs text-muted mt-1">
                {t('vault_inv_sub', 'Select physical kachas from vault to add to this issue voucher')}
              </p>
            </div>
            <span className="badge badge-gray">
              {vaultItems.length} {t('in_vault', 'in vault')}
            </span>
          </div>

          {/* Vault search & quick actions */}
          <div className="flex gap-2 mb-4" style={{ alignItems: 'center' }}>
            <div style={{ position: 'relative', flex: 1 }}>
              <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--clr-text-muted)' }} />
              <input
                className="form-control"
                style={{ paddingLeft: 34, paddingRight: 10, fontSize: '0.84rem', height: 38 }}
                placeholder={t('search_vault_ph', 'Search Patla No, weight, purity…')}
                value={vaultSearch}
                onChange={e => setVaultSearch(e.target.value)}
              />
            </div>
            {filteredVault.length > 0 && (
              <button className="btn btn-ghost btn-sm" onClick={selectAllFiltered} title={t('select_all', 'Select all filtered items')}>
                {t('select_all', 'Select All')}
              </button>
            )}
            {selectedIds.size > 0 && (
              <button className="btn btn-ghost btn-sm" onClick={clearSelection} title={t('clear', 'Clear selection')}>
                {t('clear', 'Clear')}
              </button>
            )}
          </div>

          {/* Vault Items List */}
          {loadingVault ? (
            <div className="loading-overlay"><div className="spinner" /> {t('loading', 'Loading vault stock…')}</div>
          ) : vaultItems.length === 0 ? (
            <div className="empty-state" style={{ padding: '36px 20px' }}>
              <Package className="empty-state-icon" />
              <div className="empty-state-title">{t('vault_empty', 'Vault is empty')}</div>
              <div className="empty-state-sub">{t('vault_empty_sub', 'Save a Receipt Voucher first to add silver bars to stock')}</div>
            </div>
          ) : filteredVault.length === 0 ? (
            <div className="text-center text-muted" style={{ padding: '28px 0' }}>
              {t('no_match_ph', 'No vault items match')} "{vaultSearch}"
            </div>
          ) : (
            <>
              <div className="table-wrap mb-2" style={{ maxHeight: 420, overflow: 'auto', WebkitOverflowScrolling: 'touch' }}>
                <table style={{ width: '100%' }}>
                  <thead>
                    <tr>
                      <th style={{ width: 32, textAlign: 'center' }}></th>
                      <th>{t('th_patla_kacha_no', 'Patla / Kacha No')}</th>
                      <th>{t('th_weight_g', 'Gross (g)')}</th>
                      <th>{t('th_tunch_pct', 'Tunch (%)')}</th>
                      <th style={{ color: 'var(--clr-gold)' }}>{t('th_pure_g', 'Pure (g)')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredVault.map(item => {
                      const isSelected = selectedIds.has(item.id)
                      const sType = item.silver_type || 'K'
                      return (
                        <tr
                          key={item.id}
                          style={{
                            cursor: 'pointer',
                            background: isSelected ? 'rgba(179, 134, 27, 0.08)' : undefined,
                          }}
                          onClick={() => toggleVaultItem(item.id)}
                        >
                          <td style={{ textAlign: 'center', width: 32 }}>
                            {isSelected ? (
                              <CheckSquare size={16} color="var(--clr-gold)" />
                            ) : (
                              <Square size={16} color="var(--clr-text-muted)" />
                            )}
                          </td>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <span style={{
                                fontSize: '0.68rem',
                                fontWeight: 800,
                                fontFamily: 'monospace',
                                padding: '1px 5px',
                                borderRadius: 4,
                                background: sType === 'B' ? '#1e3a8a' : sType === 'P' ? '#3730a3' : '#312e81',
                                color: '#93c5fd',
                                flexShrink: 0
                              }}>
                                {sType}
                              </span>
                              <strong style={{ color: isSelected ? 'var(--clr-gold)' : 'var(--clr-text-primary)' }}>
                                {item.patla_no}
                              </strong>
                            </div>
                            {item.description && (
                              <div className="text-xs text-muted" style={{ marginTop: 2 }}>{item.description}</div>
                            )}
                          </td>
                          <td className="font-mono">
                            {parseFloat(item.weight_g).toLocaleString('en-IN', { maximumFractionDigits: 3 })} g
                          </td>
                          <td className="font-mono">{parseFloat(item.tunch_pct).toFixed(2)}%</td>
                          <td className="font-mono font-semibold" style={{ color: 'var(--clr-gold)' }}>
                            {parseFloat(item.pure_g).toLocaleString('en-IN')} g
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="table-scroll-hint mb-3">
                {t('swipe_hint', '↔ Swipe table horizontally to see all columns')}
              </div>
            </>
          )}

          <div className="text-xs text-muted mt-2">
            {t('click_row_select', 'Click any row to select or deselect items for delivery.')}
          </div>
        </div>

        {/* RIGHT COLUMN: Issue Manifest (Items Being Issued) */}
        <div className="card card-gold">
          <div className="card-header">
            <div>
              <span className="card-title">{t('items_selected_title', '2. Items Selected for Issue')}</span>
              <p className="text-xs text-muted mt-1">
                {totalCount} {t('deducted_sub', 'kacha(s) will be deducted from vault and delivered to customer')}
              </p>
            </div>
            <span className="badge badge-gold">
              {totalCount} {t('lots_badge', 'Lot(s)')}
            </span>
          </div>

          {/* Manifest Table */}
          {totalCount === 0 ? (
            <div className="empty-state" style={{ padding: '40px 20px' }}>
              <ArrowRight className="empty-state-icon" style={{ opacity: 0.3 }} />
              <div className="empty-state-title">{t('no_kachas_selected', 'No kachas selected yet')}</div>
              <div className="empty-state-sub">
                {t('no_kachas_selected_sub', 'Select items from the vault inventory on the left to add them to this voucher')}
              </div>
            </div>
          ) : (
            <>
              <div className="table-wrap mb-2" style={{ overflow: 'auto', WebkitOverflowScrolling: 'touch' }}>
                <table style={{ width: '100%' }}>
                  <thead>
                    <tr>
                      <th style={{ width: 26, textAlign: 'center' }}>#</th>
                      <th>{t('th_patla_kacha_no', 'Patla / Kacha No')}</th>
                      <th>{t('th_weight_g', 'Weight (g)')}</th>
                      <th>{t('th_tunch_pct', 'Tunch (%)')}</th>
                      <th style={{ color: 'var(--clr-gold)' }}>{t('th_pure_g', 'Pure (g)')}</th>
                      <th style={{ width: 32 }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {/* Selected Vault Items */}
                    {chosenVaultItems.map((item, idx) => (
                      <tr key={item.id}>
                        <td className="text-muted text-sm" style={{ textAlign: 'center' }}>{idx + 1}</td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                            <span style={{
                              fontSize: '0.68rem',
                              fontWeight: 800,
                              fontFamily: 'monospace',
                              padding: '1px 5px',
                              borderRadius: 4,
                              background: (item.silver_type || 'K') === 'B' ? '#1e3a8a' : (item.silver_type || 'K') === 'P' ? '#3730a3' : '#312e81',
                              color: '#93c5fd',
                              flexShrink: 0
                            }}>
                              {item.silver_type || 'K'}
                            </span>
                            <strong>{item.patla_no}</strong>
                            <span className="badge badge-gray" style={{ fontSize: '0.65rem' }}>{t('in_vault', 'Vault')}</span>
                          </div>
                        </td>
                        <td className="font-mono">
                          {parseFloat(item.weight_g).toLocaleString('en-IN', { maximumFractionDigits: 3 })} g
                        </td>
                        <td className="font-mono">{parseFloat(item.tunch_pct).toFixed(2)}%</td>
                        <td className="font-mono font-semibold" style={{ color: 'var(--clr-gold)' }}>
                          {parseFloat(item.pure_g).toLocaleString('en-IN')} g
                        </td>
                        <td>
                          <button
                            className="btn btn-maroon btn-sm btn-icon"
                            title="Remove from issue voucher (returns to vault stock)"
                            onClick={() => toggleVaultItem(item.id)}
                          >
                            <Trash2 size={12} />
                          </button>
                        </td>
                      </tr>
                    ))}

                    {/* Custom Manual Lots */}
                    {customLots.map((lot, idx) => {
                      const cType = lot.silver_type || 'K'
                      return (
                        <tr key={lot._key}>
                          <td className="text-muted text-sm" style={{ textAlign: 'center' }}>{chosenVaultItems.length + idx + 1}</td>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
                              <div style={{
                                display: 'inline-flex',
                                background: '#090e1a',
                                border: '1px solid rgba(255,255,255,0.12)',
                                borderRadius: 14,
                                padding: 1,
                                flexShrink: 0
                              }}>
                                {['K', 'P', 'B'].map(k => (
                                  <button
                                    key={k}
                                    type="button"
                                    onClick={() => updateCustomLot(lot._key, 'silver_type', k)}
                                    style={{
                                      border: 'none',
                                      borderRadius: 12,
                                      padding: '1px 5px',
                                      fontSize: '0.66rem',
                                      fontWeight: 800,
                                      cursor: 'pointer',
                                      background: cType === k ? '#f59e0b' : 'transparent',
                                      color: cType === k ? '#000' : '#9ca3af',
                                    }}
                                  >
                                    {k}
                                  </button>
                                ))}
                              </div>
                              <input
                                className="table-input"
                                style={{ minWidth: 60, padding: '4px 6px', flex: 1 }}
                                placeholder="Patla No."
                                value={lot.patla_no}
                                onChange={e => updateCustomLot(lot._key, 'patla_no', e.target.value)}
                              />
                            </div>
                          </td>
                          <td>
                            <input
                              type="number"
                              step="any"
                              className="table-input"
                              style={{ minWidth: 60, padding: '4px 6px' }}
                              placeholder="0.000"
                              value={lot.weight_g}
                              onChange={e => updateCustomLot(lot._key, 'weight_g', e.target.value)}
                            />
                          </td>
                          <td>
                            <input
                              type="number"
                              step="any"
                              className="table-input"
                              style={{ minWidth: 50, padding: '4px 6px' }}
                              placeholder="0.000"
                              value={lot.tunch_pct}
                              onChange={e => updateCustomLot(lot._key, 'tunch_pct', e.target.value)}
                            />
                          </td>
                          <td className="font-mono font-semibold" style={{ color: 'var(--clr-gold)' }}>
                            {lot.pure_g ? `${lot.pure_g} g` : '—'}
                          </td>
                          <td>
                            <button
                              className="btn btn-maroon btn-sm btn-icon"
                              onClick={() => removeCustomLot(lot._key)}
                            >
                              <Trash2 size={12} />
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td colSpan={2}>{t('total_outward', 'Total Outward')}</td>
                      <td className="font-mono">
                        {totalWeight.toLocaleString('en-IN', { maximumFractionDigits: 3 })} g
                      </td>
                      <td className="font-mono">{avgTunch.toFixed(2)}%</td>
                      <td className="font-mono" style={{ color: 'var(--clr-gold)', fontSize: '1.05rem' }}>
                        <strong>{totalPure.toLocaleString('en-IN')} g</strong>
                      </td>
                      <td></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            <div className="table-scroll-hint mb-3">
              {t('swipe_hint', '↔ Swipe table horizontally to see all columns')}
            </div>
          </>
          )}

          {/* Optional: Add custom unvaulted lot button */}
          <div className="flex items-center justify-between mt-3 pt-2">
            <button
              className="btn btn-ghost btn-sm"
              onClick={addCustomLot}
              title="Add a custom/unvaulted bar not currently in inventory"
            >
              <Plus size={13} /> {t('btn_add_custom_lot', 'Add Custom / Unvaulted Lot')}
            </button>
            <div className="text-xs text-muted">
              {t('krs_rounding_note', 'KRS Rounding: ≤0.69 → 0 · ≥0.70 → +1')}
            </div>
          </div>

          {/* Live Summary Cards */}
          <div className="stat-grid stat-grid-3 mt-6">
            <div className="stat-card" style={{ padding: '16px 20px' }}>
              <div className="stat-label">{t('total_gross_weight', 'Total Gross Weight')}</div>
              <div className="stat-value" style={{ fontSize: '1.25rem' }}>
                {totalWeight.toLocaleString('en-IN', { maximumFractionDigits: 3 })} g
              </div>
              <div className="stat-sub">{gramsToKg(totalWeight)} kg</div>
            </div>

            <div className="stat-card" style={{ padding: '16px 20px' }}>
              <div className="stat-label">{t('weighted_purity', 'Weighted Purity')}</div>
              <div className="stat-value" style={{ fontSize: '1.25rem' }}>
                {avgTunch.toFixed(3)}%
              </div>
              <div className="stat-sub">{totalCount} {t('kachas_count', 'kachas')}</div>
            </div>

            <div className="stat-card" style={{ padding: '16px 20px' }}>
              <div className="stat-label">{t('total_pure_silver', 'Total Pure Silver')}</div>
              <div className="stat-value gold" style={{ fontSize: '1.25rem' }}>
                {totalPure.toLocaleString('en-IN')} g
              </div>
              <div className="stat-sub">{gramsToKg(totalPure)} {t('kg_pure', 'kg pure')}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Saved Voucher Printable Document */}
      {savedVoucher && (
        <div className="card mt-8" style={{ border: '2px solid var(--clr-gold-border)' }}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <span className="badge badge-green">{t('saved_successfully', '✓ Saved Successfully')}</span>
              <span className="text-sm font-semibold">
                Issue Voucher #IV-{String(savedVoucher.voucher_no).padStart(4, '0')}
              </span>
            </div>
            <button className="btn btn-gold btn-sm" onClick={handlePrint}>
              <Printer size={14} /> {t('btn_print_voucher', 'Print Formal Voucher')}
            </button>
          </div>

          <IssueVoucherPrintView voucher={savedVoucher} />
        </div>
      )}
    </div>
  )
}

/* ── Formal Printable Issue Voucher Component ──────────────── */
function IssueVoucherPrintView({ voucher }) {
  const { t } = useLanguage()
  const lots = voucher.lots || []
  const totalWeight = lots.reduce((s, l) => s + (parseFloat(l.weight_g) || 0), 0)
  const totalPure = lots.reduce((s, l) => s + (parseFloat(l.pure_g) || 0), 0)

  return (
    <div id="issue-voucher-print-area" className="voucher-print" style={{
      background: '#FFFFFF',
      color: '#111827',
      padding: '32px',
      borderRadius: 'var(--r-md)',
      border: '1px solid var(--clr-border)',
      fontFamily: 'var(--font-body)',
    }}>
      {/* Brand Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '2px solid #111827', paddingBottom: 16, marginBottom: 20 }}>
        <div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.6rem', fontWeight: 700, color: '#B3861B' }}>
            {t('brand_title', 'K R S SILVERS')}
          </div>
          <div style={{ fontSize: '0.78rem', color: '#64748B', letterSpacing: '0.12em', textTransform: 'uppercase', fontWeight: 600 }}>
            {t('brand_sub', 'Bullion & Chit Management')} · {t('issue_voucher_title', 'Issue Voucher')}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontWeight: 800, fontSize: '1.2rem', color: '#111827' }}>
            #IV-{String(voucher.voucher_no).padStart(4, '0')}
          </div>
          <div style={{ color: '#64748B', fontSize: '0.82rem', marginTop: 3 }}>
            {t('date', 'Date')}: {format(new Date(voucher.voucher_date), 'dd MMMM yyyy')}
          </div>
        </div>
      </div>

      {/* Recipient Details */}
      <div className="voucher-print-meta-grid">
        <div>
          <span style={{ fontSize: '0.72rem', textTransform: 'uppercase', color: '#64748B', fontWeight: 600 }}>{t('issued_to', 'Issued To (Member/Customer):')}</span>
          <div style={{ fontWeight: 700, fontSize: '1rem', color: '#111827', marginTop: 2 }}>
            {voucher.customer?.name || 'Walk-in Customer'}
          </div>
          {voucher.customer?.phone && (
            <div style={{ fontSize: '0.82rem', color: '#475569' }}>{t('th_phone', 'Phone')}: {voucher.customer.phone}</div>
          )}
        </div>
        <div style={{ textAlign: 'right' }}>
          <span style={{ fontSize: '0.72rem', textTransform: 'uppercase', color: '#64748B', fontWeight: 600 }}>{t('txn_type', 'Transaction Type:')}</span>
          <div style={{ fontWeight: 700, color: '#A62626', fontSize: '0.95rem', marginTop: 2 }}>
            {t('phys_vault_issue', 'Physical Vault Silver Issue')}
          </div>
          <div style={{ fontSize: '0.82rem', color: '#64748B' }}>
            {t('total_lots', 'Total Lots:')} {lots.length}
          </div>
        </div>
      </div>

      {/* Lots Table */}
      <div className="table-wrap mb-6">
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.86rem' }}>
          <thead>
            <tr style={{ background: '#F1F5F9', borderBottom: '1.5px solid #CBD5E1' }}>
              <th style={{ padding: '10px 12px', textAlign: 'left', width: 40 }}>#</th>
              <th style={{ padding: '10px 12px', textAlign: 'left', width: 60 }}>Type</th>
              <th style={{ padding: '10px 12px', textAlign: 'left' }}>{t('th_patla_kacha_no', 'Patla / Kacha No')}</th>
              <th style={{ padding: '10px 12px', textAlign: 'right' }}>{t('th_weight_g', 'Gross Weight (g)')}</th>
              <th style={{ padding: '10px 12px', textAlign: 'right' }}>{t('th_tunch_pct', 'Tunch (%)')}</th>
              <th style={{ padding: '10px 12px', textAlign: 'right', color: '#B3861B' }}>{t('th_pure_g', 'Pure Silver (g)')}</th>
            </tr>
          </thead>
          <tbody>
            {lots.map((l, i) => (
              <tr key={i} style={{ borderBottom: '1px solid #E2E8F0' }}>
                <td style={{ padding: '10px 12px', color: '#64748B' }}>{i + 1}</td>
                <td style={{ padding: '10px 12px', fontWeight: 700, fontFamily: 'monospace' }}>{l.silver_type || 'K'}</td>
                <td style={{ padding: '10px 12px', fontWeight: 600 }}>{l.patla_no}</td>
                <td style={{ padding: '10px 12px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                  {parseFloat(l.weight_g).toLocaleString('en-IN', { maximumFractionDigits: 3 })}
                </td>
                <td style={{ padding: '10px 12px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                  {parseFloat(l.tunch_pct).toFixed(3)}%
                </td>
                <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: '#B3861B', fontVariantNumeric: 'tabular-nums' }}>
                  {parseFloat(l.pure_g).toLocaleString('en-IN')} g
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr style={{ background: '#F8FAFC', borderTop: '2px solid #CBD5E1' }}>
              <td colSpan={3} style={{ padding: '12px', fontWeight: 700 }}>{t('total_outward', 'Total Silver Issued')}:</td>
              <td style={{ padding: '12px', textAlign: 'right', fontWeight: 700 }}>
                {totalWeight.toLocaleString('en-IN', { maximumFractionDigits: 3 })} g ({gramsToKg(totalWeight)} kg)
              </td>
              <td></td>
              <td style={{ padding: '12px', textAlign: 'right', fontWeight: 800, fontSize: '1.05rem', color: '#B3861B' }}>
                {totalPure.toLocaleString('en-IN')} g ({gramsToKg(totalPure)} kg)
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Signatures */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 48, paddingTop: 16 }}>
        <div style={{ textAlign: 'center', width: 200 }}>
          <div style={{ borderTop: '1px solid #64748B', paddingTop: 8, fontSize: '0.8rem', color: '#475569' }}>
            {t('customer_signature', 'Customer Signature')}
          </div>
        </div>
        <div style={{ textAlign: 'center', width: 200 }}>
          <div style={{ borderTop: '1px solid #64748B', paddingTop: 8, fontSize: '0.8rem', color: '#475569' }}>
            {t('authorized_signature', 'For K R S Silvers (Authorized Signatory)')}
          </div>
        </div>
      </div>
    </div>
  )
}
