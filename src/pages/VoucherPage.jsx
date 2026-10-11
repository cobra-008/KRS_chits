import { useState, useEffect, useRef, useCallback } from 'react'
import { Plus, Trash2, Printer, Save, ChevronDown } from 'lucide-react'
import { format } from 'date-fns'
import toast from 'react-hot-toast'
import { calcFine } from '../lib/silverCalc'
import { customersApi, vouchersApi } from '../lib/api'
import { useLanguage } from '../context/LanguageContext'

const emptyLot = () => ({
  _key: Math.random().toString(36).slice(2),
  silver_type: 'K',
  patla_no: '',
  weight_g: '',
  tunch_pct: '',
  raw_fine_g: 0,
  pure_g: 0,
})

export default function VoucherPage({ type = 'receipt' }) {
  const { t, lang } = useLanguage()
  const isReceipt = type === 'receipt'

  const [customers, setCustomers] = useState([])
  const [customerId, setCustomerId] = useState('')
  const [voucherDate, setVoucherDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [lots, setLots] = useState([emptyLot()])
  const [saving, setSaving] = useState(false)
  const [savedVoucher, setSavedVoucher] = useState(null)
  const printRef = useRef(null)

  useEffect(() => {
    customersApi.getAll().then(setCustomers).catch(() => toast.error('Failed to load customers'))
  }, [])

  const selectedCustomer = customers.find(c => c.id === customerId)

  /* ── Lot Calculations ── */
  const updateLot = useCallback((key, field, value) => {
    setLots(prev => prev.map(lot => {
      if (lot._key !== key) return lot
      const updated = { ...lot, [field]: value }
      // If Bar is selected, default tunch to 100
      if (field === 'silver_type' && value === 'B') {
        updated.tunch_pct = '100'
      }
      const w = parseFloat(updated.weight_g) || 0
      const t = parseFloat(updated.tunch_pct) || 0
      const { rawFine, pure } = calcFine(w, t)
      return { ...updated, raw_fine_g: rawFine, pure_g: pure }
    }))
  }, [])

  const addLot = () => setLots(prev => [...prev, emptyLot()])

  const removeLot = (key) => {
    if (lots.length === 1) return
    setLots(prev => prev.filter(l => l._key !== key))
  }

  const totalWeight = lots.reduce((s, l) => s + (parseFloat(l.weight_g) || 0), 0)
  const totalPure = lots.reduce((s, l) => s + (l.pure_g || 0), 0)

  /* ── Save ── */
  const handleSave = async () => {
    if (!customerId) { toast.error('Please select a customer'); return }
    if (!lots.some(l => l.weight_g && l.tunch_pct)) {
      toast.error('Please enter at least one complete lot'); return
    }

    const validLots = lots.filter(l => l.weight_g && l.tunch_pct)

    setSaving(true)
    try {
      let voucher
      if (isReceipt) {
        voucher = await vouchersApi.createReceipt({
          customerId,
          voucherDate,
          lots: validLots,
        })
      } else {
        voucher = await vouchersApi.createIssue({
          customerId,
          voucherDate,
          lots: validLots,
        })
      }

      toast.success(`${isReceipt ? 'Receipt' : 'Issue'} Voucher #${voucher.voucher_no} saved!`)
      setSavedVoucher({ ...voucher, lots: validLots, customer: selectedCustomer })

      // Reset form
      setLots([emptyLot()])
      setCustomerId('')
      setVoucherDate(format(new Date(), 'yyyy-MM-dd'))
    } catch (err) {
      toast.error(err.message || 'Failed to save voucher')
    } finally {
      setSaving(false)
    }
  }

  /* ── Print ── */
  const handlePrint = () => {
    if (!savedVoucher) { toast.error('Save the voucher first to print'); return }
    window.print()
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">
            {isReceipt ? t('receipt_voucher_title') : t('issue_voucher_title')}
          </h1>
          <p className="page-sub">
            {isReceipt
              ? (lang === 'ta' ? 'வாடிக்கையாளர் கொண்டுவரும் வெள்ளி பார் வரவு பதிவு — தானாக கஜானாவில் சேர்க்கப்படும்' : 'Record incoming silver — auto-posts to inventory & customer account')
              : (lang === 'ta' ? 'கஜானாவில் உள்ள கச்சாவை வாடிக்கையாளருக்கு வழங்குதல்' : 'Record outgoing silver — auto-deducts from inventory & customer account')
            }
          </p>
        </div>
        <div className="flex gap-2">
          <button id="btn-print-voucher" className="btn btn-ghost" onClick={handlePrint}>
            <Printer /> {t('print')}
          </button>
          <button
            id="btn-save-voucher"
            className="btn btn-gold"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? <><div className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} /> {t('saving')}</> : <><Save /> {t('save')} {isReceipt ? t('nav_receipt') : t('nav_issue')}</>}
          </button>
        </div>
      </div>

      <div className="card card-gold">
        {/* Voucher meta row */}
        <div className="voucher-meta-grid">
          {/* Voucher # (auto) */}
          <div className="form-group">
            <label className="form-label">{t('voucher_no')}</label>
            <div style={{
              background: 'var(--clr-surface-2)',
              border: '1.5px solid var(--clr-border)',
              borderRadius: 'var(--r-sm)',
              padding: '11px 18px',
              color: 'var(--clr-gold)',
              fontSize: '0.92rem',
              fontWeight: 700,
              boxShadow: 'inset 0 1px 2px rgba(18, 24, 38, 0.02)',
            }}>
              {savedVoucher ? `#${savedVoucher.voucher_no}` : t('auto_next')}
            </div>
          </div>

          {/* Customer */}
          <div className="form-group">
            <label className="form-label" htmlFor="voucher-customer">{t('customer_name')}</label>
            <select
              id="voucher-customer"
              className="form-control"
              value={customerId}
              onChange={e => setCustomerId(e.target.value)}
            >
              <option value="">{t('select_customer')}</option>
              {customers.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          {/* Date */}
          <div className="form-group">
            <label className="form-label" htmlFor="voucher-date">{t('date')}</label>
            <input
              id="voucher-date"
              type="date"
              className="form-control"
              value={voucherDate}
              onChange={e => setVoucherDate(e.target.value)}
            />
          </div>
        </div>

        {/* Lots table */}
        <div className="table-scroll-hint mb-2">{t('swipe_hint')}</div>
        <div className="table-wrap mb-4" style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
          <table style={{ minWidth: 640 }}>
            <thead>
              <tr>
                <th style={{ width: 44 }}>#</th>
                <th style={{ minWidth: 140 }}>Type of Silver</th>
                <th style={{ minWidth: 120 }}>{t('th_patla_kacha_no')}</th>
                <th style={{ minWidth: 120 }}>{t('th_weight_g')}</th>
                <th style={{ minWidth: 100 }}>{t('th_tunch_pct')}</th>
                <th style={{ minWidth: 110 }}>{t('th_raw_fine_g')}</th>
                <th style={{ minWidth: 100, color: 'var(--clr-gold)' }}>{t('th_pure_g')}</th>
                <th style={{ width: 40 }}></th>
              </tr>
            </thead>
            <tbody>
              {lots.map((lot, idx) => (
                <LotRow
                  key={lot._key}
                  lot={lot}
                  index={idx}
                  onChange={updateLot}
                  onRemove={removeLot}
                  onAddNext={addLot}
                  canRemove={lots.length > 1}
                />
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={3}><strong>{t('total')}</strong></td>
                <td>
                  <span className="font-mono">
                    {totalWeight.toLocaleString('en-IN', { maximumFractionDigits: 3 })} g
                  </span>
                </td>
                <td />
                <td />
                <td style={{ color: 'var(--clr-gold)', fontSize: '1rem' }}>
                  <strong className="font-mono">
                    {totalPure.toLocaleString('en-IN')} g
                  </strong>
                </td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>

        <div className="flex items-center justify-between mt-4 pt-1">
          <button
            id="btn-add-lot"
            className="btn btn-ghost"
            onClick={addLot}
          >
            <Plus /> {t('btn_add_lot')}
          </button>

          <div style={{ fontSize: '0.8rem', color: 'var(--clr-text-muted)' }}>
            {t('krs_rounding_note')}
          </div>
        </div>
      </div>

      {/* Saved voucher printable area */}
      {savedVoucher && (
        <div className="card mt-6" style={{ borderColor: 'var(--clr-success)' }}>
          <div className="alert alert-success mb-4">
            Voucher #{savedVoucher.voucher_no} saved successfully and
            {isReceipt ? ' added to inventory & customer account.' : ' removed from inventory & debited from account.'}
          </div>
          <PrintableVoucher voucher={savedVoucher} type={type} ref={printRef} />
        </div>
      )}
    </div>
  )
}

/* ── Individual Lot Row ── */
function LotRow({ lot, index, onChange, onRemove, onAddNext, canRemove }) {
  const tunchRef = useRef(null)

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && e.target === tunchRef.current) {
      onAddNext()
    }
  }

  const sType = lot.silver_type || 'K'

  return (
    <tr>
      <td>
        <span className="badge badge-gray">{index + 1}</span>
      </td>
      <td>
        {/* Capsule pill with K / P / B */}
        <div style={{
          display: 'inline-flex',
          background: '#090e1a',
          border: '1px solid rgba(255,255,255,0.12)',
          borderRadius: 20,
          padding: 2,
          gap: 2
        }}>
          {[
            { key: 'K', label: 'K' },
            { key: 'P', label: 'P' },
            { key: 'B', label: 'B' },
          ].map(pill => {
            const isActive = sType === pill.key
            return (
              <button
                key={pill.key}
                type="button"
                onClick={() => onChange(lot._key, 'silver_type', pill.key)}
                title={pill.key === 'K' ? 'Katcha' : pill.key === 'P' ? 'Patla' : 'Bar (100% Tunch Default)'}
                style={{
                  border: 'none',
                  borderRadius: 16,
                  padding: '3px 10px',
                  fontSize: '0.78rem',
                  fontWeight: 800,
                  fontFamily: 'monospace',
                  cursor: 'pointer',
                  background: isActive ? '#f59e0b' : 'transparent',
                  color: isActive ? '#000' : '#9ca3af',
                  transition: 'all 0.15s ease'
                }}
              >
                {pill.label}
              </button>
            )
          })}
        </div>
      </td>
      <td>
        <input
          className="table-input"
          style={{ minWidth: 100 }}
          placeholder="Bar ID"
          value={lot.patla_no}
          onChange={e => onChange(lot._key, 'patla_no', e.target.value)}
        />
      </td>
      <td>
        <input
          className="table-input"
          style={{ minWidth: 110 }}
          type="number"
          step="any"
          min="0"
          placeholder="0.000"
          value={lot.weight_g}
          onChange={e => onChange(lot._key, 'weight_g', e.target.value)}
        />
      </td>
      <td>
        <input
          ref={tunchRef}
          className="table-input"
          style={{ minWidth: 90 }}
          type="number"
          step="any"
          min="0"
          max="100"
          placeholder="0.000"
          value={lot.tunch_pct}
          onChange={e => onChange(lot._key, 'tunch_pct', e.target.value)}
          onKeyDown={handleKeyDown}
        />
      </td>
      <td className="font-mono text-secondary">
        {lot.raw_fine_g ? lot.raw_fine_g.toFixed(3) : '—'}
      </td>
      <td>
        <span
          className="font-mono font-semibold"
          style={{ color: 'var(--clr-gold)' }}
        >
          {lot.pure_g > 0 ? lot.pure_g.toLocaleString('en-IN') : '—'}
        </span>
      </td>
      <td>
        {canRemove && (
          <button
            className="btn btn-maroon btn-sm btn-icon"
            onClick={() => onRemove(lot._key)}
            title="Remove lot"
          >
            <Trash2 size={12} />
          </button>
        )}
      </td>
    </tr>
  )
}

/* ── Printable Voucher ── */
function PrintableVoucher({ voucher, type }) {
  const { t, lang } = useLanguage()
  const isReceipt = type === 'receipt'
  const prefix = isReceipt ? 'RV' : 'IV'

  return (
    <div id="voucher-print-area" style={{
      fontFamily: 'serif',
      fontSize: '0.85rem',
      lineHeight: 1.5,
    }}>
      {/* Print styles injected via CSS @media print in index.css */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
        <div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.3rem', fontWeight: 700, color: 'var(--clr-gold)' }}>
            {t('brand_title')}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--clr-text-muted)', marginTop: 2 }}>
            {isReceipt ? (lang === 'ta' ? 'உள்வரும் வரவு வவுச்சர்' : 'RECEIPT VOUCHER') : (lang === 'ta' ? 'வெளிச்செல்லும் வழங்கல் வவுச்சர்' : 'ISSUE VOUCHER')}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontWeight: 700, fontSize: '1rem' }}>#{prefix}-{String(voucher.voucher_no).padStart(4, '0')}</div>
          <div style={{ color: 'var(--clr-text-muted)', fontSize: '0.78rem' }}>
            {format(new Date(voucher.voucher_date || voucher.created_at), 'dd MMM yyyy')}
          </div>
        </div>
      </div>

      <div style={{ marginBottom: 12, fontSize: '0.83rem' }}>
        <span className="text-muted">{t('th_customer')}: </span>
        <strong>{voucher.customer?.name || '—'}</strong>
      </div>

      <div className="table-wrap" style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
        <table style={{ minWidth: 480 }}>
          <thead>
            <tr>
              <th>#</th>
              <th>Type</th>
              <th>{t('th_patla_kacha_no')}</th>
              <th>{t('th_weight_g')}</th>
              <th>{t('th_tunch_pct')}</th>
              <th>{t('th_pure_g')}</th>
            </tr>
          </thead>
          <tbody>
            {voucher.lots?.map((l, i) => (
              <tr key={i}>
                <td>{i + 1}</td>
                <td><span className="badge badge-gray font-mono">{l.silver_type || 'K'}</span></td>
                <td>{l.patla_no || '—'}</td>
                <td className="font-mono">{parseFloat(l.weight_g).toLocaleString('en-IN', { maximumFractionDigits: 3 })}</td>
                <td className="font-mono">{parseFloat(l.tunch_pct).toFixed(3)}</td>
                <td className="font-mono font-semibold" style={{ color: 'var(--clr-gold)' }}>
                  {parseFloat(l.pure_g).toLocaleString('en-IN')}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={3}><strong>{t('total')}</strong></td>
              <td className="font-mono">
                {voucher.lots?.reduce((s,l) => s+(parseFloat(l.weight_g)||0),0)
                  .toLocaleString('en-IN', { maximumFractionDigits: 3 })} g
              </td>
              <td />
              <td className="font-mono" style={{ color: 'var(--clr-gold)' }}>
                <strong>
                  {voucher.lots?.reduce((s,l) => s+(parseFloat(l.pure_g)||0),0)
                    .toLocaleString('en-IN')} g
                </strong>
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 40, paddingTop: 12, borderTop: '1px solid var(--clr-border)' }}>
        <div style={{ textAlign: 'center', width: 160 }}>
          <div style={{ borderTop: '1px solid var(--clr-text-muted)', paddingTop: 8, marginTop: 32, fontSize: '0.78rem', color: 'var(--clr-text-muted)' }}>
            {t('customer_signature')}
          </div>
        </div>
        <div style={{ textAlign: 'center', width: 160 }}>
          <div style={{ borderTop: '1px solid var(--clr-text-muted)', paddingTop: 8, marginTop: 32, fontSize: '0.78rem', color: 'var(--clr-text-muted)' }}>
            {t('authorized_signature')}
          </div>
        </div>
      </div>
    </div>
  )
}
