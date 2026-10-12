import { useState, useEffect } from 'react'
import { Search, Filter, Printer, Download, Eye } from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '../lib/supabase'
import { txnLogApi } from '../lib/api'
import { format, parseISO } from 'date-fns'
import {
  downloadReceiptVoucherPdf,
  printReceiptVoucher,
  downloadIssueVoucherPdf,
  printIssueVoucher,
  downloadChitSettlementPdf,
  printChitSettlementVoucher,
} from '../lib/pdfGenerator'
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
  const [actionLoading, setActionLoading] = useState(null)

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

  const handleDocumentAction = async (entry, isPrint = false) => {
    setActionLoading(entry.id)
    try {
      if (entry.type === 'receipt' || entry.type === 'issue') {
        let voucher = null

        // Attempt 1: Fetch by ref_id
        if (entry.ref_id) {
          const { data } = await supabase
            .from('vouchers')
            .select('*, voucher_lots(*), customers(*)')
            .eq('id', entry.ref_id)
            .maybeSingle()
          voucher = data
        }

        // Attempt 2: Fetch by voucher_no parsed from voucher_ref
        if (!voucher && entry.voucher_ref) {
          const numMatch = entry.voucher_ref.match(/\d+/)
          if (numMatch) {
            const vNo = parseInt(numMatch[0])
            const { data } = await supabase
              .from('vouchers')
              .select('*, voucher_lots(*), customers(*)')
              .eq('voucher_no', vNo)
              .eq('type', entry.type)
              .maybeSingle()
            voucher = data
          }
        }

        const vNo = voucher?.voucher_no || parseInt(entry.voucher_ref?.match(/\d+/)?.[0]) || 1
        const customer = voucher?.customers || { name: entry.customer_name || 'Customer' }
        const lots = voucher?.voucher_lots?.length > 0 ? voucher.voucher_lots : [{
          silver_type: 'K',
          patla_no: '—',
          weight_g: entry.pure_in_g || entry.pure_out_g || 0,
          tunch_pct: 100,
          pure_g: entry.pure_in_g || entry.pure_out_g || 0,
        }]
        const totalGrossG = lots.reduce((s, l) => s + (parseFloat(l.weight_g) || 0), 0)
        const totalPureG = parseFloat(entry.pure_in_g || entry.pure_out_g) || 0

        const params = {
          voucherNo: vNo,
          voucherDate: voucher?.voucher_date || entry.log_date,
          customer,
          lots,
          totalGrossG,
          totalPureG,
        }

        if (entry.type === 'receipt') {
          if (isPrint) printReceiptVoucher(params)
          else await downloadReceiptVoucherPdf(params)
        } else {
          if (isPrint) printIssueVoucher(params)
          else await downloadIssueVoucherPdf(params)
        }
      } else if (entry.type === 'chit_settlement') {
        let draw = null
        if (entry.ref_id) {
          const { data } = await supabase
            .from('chit_draws')
            .select('*, groups(*), group_members(*, customers(*))')
            .eq('id', entry.ref_id)
            .maybeSingle()
          draw = data
        }

        const grp = draw?.groups || {}
        const mem = draw?.group_members || {}
        const custName = mem?.customers?.name || entry.customer_name || 'Member'
        const roundNo = draw?.month_no || parseInt(entry.voucher_ref?.match(/M(\d+)/)?.[1]) || 1
        const totalCapG = parseFloat(draw?.total_capacity_g) || ((grp.num_months || 20) * (grp.unit_limit_g || 1000))
        const discountG = parseFloat(draw?.discount_g) || 0
        const profitG = parseFloat(draw?.company_profit_g) || Math.round(totalCapG * 0.04)
        const divG = parseFloat(draw?.dividend_per_member_g) || 0
        const premG = parseFloat(draw?.monthly_premium_g) || 0
        const oldDuesG = parseFloat(draw?.old_dues_g) || 0
        const netDisburseG = parseFloat(draw?.net_silver_to_issue_g) || parseFloat(entry.pure_in_g) || 0

        const params = {
          schemeName: grp.name || 'KRS Silver Scheme',
          roundNo,
          totalRounds: grp.num_months || 20,
          drawDate: draw?.draw_date || entry.log_date,
          customerName: custName,
          ticketNo: mem.ticket_no || 1,
          sharePct: draw?.withdrawer_share_pct || mem.share_pct || 100,
          grossCapacityG: totalCapG,
          discountG,
          companyProfitG: profitG,
          dividendPerMemberG: divG,
          monthlyPremiumG: premG,
          oldDuesG,
          netDisburseG,
          deliveryStatus: 'Held as Customer Excess Fine',
        }

        if (isPrint) printChitSettlementVoucher(params)
        else await downloadChitSettlementPdf(params)
      }

      toast.success(isPrint ? 'Print document generated!' : 'PDF downloaded successfully!')
    } catch (err) {
      console.error(err)
      toast.error('Failed to generate document PDF')
    } finally {
      setActionLoading(null)
    }
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
          <Printer size={14} /> {t('btn_print_daybook')}
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
              <Filter size={14} /> {t('filter')}
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
            <table style={{ minWidth: 760 }}>
              <thead>
                <tr>
                  <th>{t('th_datetime')}</th>
                  <th>{t('filter_type')}</th>
                  <th>{t('th_voucher_ref')}</th>
                  <th>{t('th_customer')}</th>
                  <th>{t('th_particulars')}</th>
                  <th>{t('th_in_pure')}</th>
                  <th>{t('th_out_pure')}</th>
                  <th style={{ textAlign: 'center', width: 95 }}>{t('th_actions', 'Actions')}</th>
                </tr>
              </thead>
              <tbody>
                {entries.map(entry => {
                  const typeInfo = TYPE_LABELS[entry.type] || { label: entry.type, badge: 'badge-gray' }
                  const isLoadingThis = actionLoading === entry.id

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
                      <td style={{ textAlign: 'center' }}>
                        <div className="flex gap-1 items-center justify-center">
                          <button
                            className="btn btn-ghost btn-sm btn-icon"
                            title={lang === 'ta' ? 'அச்சிடு / காண்க' : 'View / Print PDF'}
                            onClick={() => handleDocumentAction(entry, true)}
                            disabled={isLoadingThis}
                          >
                            <Printer size={13} />
                          </button>
                          <button
                            className="btn btn-ghost btn-sm btn-icon"
                            title={lang === 'ta' ? 'PDF பதிவிறக்கு' : 'Download PDF'}
                            onClick={() => handleDocumentAction(entry, false)}
                            disabled={isLoadingThis}
                          >
                            <Download size={13} />
                          </button>
                        </div>
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
