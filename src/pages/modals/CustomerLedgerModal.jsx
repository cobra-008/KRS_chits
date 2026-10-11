import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { membersApi, chitDrawsApi } from '../../lib/api'
import { getTotalFineDemanded, gramsToKg, krsRound } from '../../lib/silverCalc'
import { format, parseISO } from 'date-fns'
import toast from 'react-hot-toast'
import { Printer, X } from 'lucide-react'
import { useLanguage } from '../../context/LanguageContext'

export default function CustomerLedgerModal({ customer, onClose }) {
  const { t, lang } = useLanguage()
  const [loading, setLoading] = useState(true)
  const [memberships, setMemberships] = useState([])   // group_members + groups
  const [txnLogs, setTxnLogs] = useState([])           // raw transaction_log entries
  const [ledgerRows, setLedgerRows] = useState([])     // computed ledger

  useEffect(() => { if (customer) loadData() }, [customer])

  const loadData = async () => {
    try {
      setLoading(true)

      // 1. Group memberships
      const { data: mems, error: mErr } = await supabase
        .from('group_members')
        .select(`*, groups ( * )`)
        .eq('customer_id', customer.id)
      if (mErr) throw mErr

      // 2. Chit draws for those groups (to get actual premiums per month)
      const groupIds = mems.map(m => m.group_id)
      let draws = []
      if (groupIds.length > 0) {
        const { data: dData, error: dErr } = await supabase
          .from('chit_draws')
          .select(`*, group_members ( id, customer_id, customers(name) )`)
          .in('group_id', groupIds)
          .order('draw_date')
        if (dErr) throw dErr
        draws = dData
      }

      // 3. Vouchers (receipts and issues for this customer)
      const { data: vouchers, error: vErr } = await supabase
        .from('vouchers')
        .select(`*, voucher_lots(*)`)
        .eq('customer_id', customer.id)
        .order('voucher_date')
      if (vErr) throw vErr

      setMemberships(mems)

      // ── Build unified ledger ──
      const events = []

      // From draws: add chit draw demand events (actual monthly premiums demanded)
      for (const mem of mems) {
        const grp = mem.groups
        if (!grp) continue
        const groupDraws = draws.filter(d => d.group_id === grp.id)

        for (let m = 1; m <= grp.months_happened; m++) {
          const draw = groupDraws.find(d => d.month_no === m)
          const shareRatio = (parseFloat(mem.share_pct) || 100) / 100
          
          let baseDemanded = draw ? parseFloat(draw.monthly_premium_g) : parseFloat(grp.unit_limit_g)
          // If the draw's stored premium was computed for a withdrawer with non-100% share, normalize base
          if (draw?.withdrawer_share_pct && draw.withdrawer_share_pct !== 100) {
            const withdrawerRatio = draw.withdrawer_share_pct / 100
            const dividend = parseFloat(draw.dividend_per_member_g) || 0
            const baseUnit = parseFloat(grp.unit_limit_g) || 1000
            baseDemanded = Math.max(0, baseUnit - dividend)
          }
          const premiumDemanded = Math.round(baseDemanded * shareRatio)

          const isThisCustomerWithdrawer = draw?.group_members?.customer_id === customer.id || draw?.withdrawer_member_id === mem.id

          events.push({
            _sort: draw ? draw.draw_date : grp.start_date || '2000-01-01',
            type: 'chit_demand',
            date: draw?.draw_date || null,
            ref: `${grp.name} · M${m}`,
            particulars: `Chit Draw — Month ${m}${isThisCustomerWithdrawer ? ' (WITHDRAWAL SETTLEMENT)' : ''}`,
            groupName: grp.name,
            monthNo: m,
            debitG: premiumDemanded,
            creditG: isThisCustomerWithdrawer ? (parseFloat(draw?.net_silver_to_issue_g) || 0) : 0,
            isWithdrawal: isThisCustomerWithdrawer,
            withdrawalNetG: isThisCustomerWithdrawer ? parseFloat(draw?.net_silver_to_issue_g) || 0 : 0,
          })
        }
      }

      // From vouchers: receipt = credit, issue = debit
      for (const v of vouchers) {
        const pure = parseFloat(v.total_pure_g) || 0
        events.push({
          _sort: v.voucher_date,
          type: v.type === 'receipt' ? 'receipt' : 'issue',
          date: v.voucher_date,
          ref: `${v.type === 'receipt' ? 'RV' : 'IV'}-${String(v.voucher_no).padStart(4,'0')}`,
          particulars: v.type === 'receipt' ? 'Silver Receipt Voucher' : 'Silver Issue Voucher',
          debitG: v.type === 'issue' ? pure : 0,
          creditG: v.type === 'receipt' ? pure : 0,
        })
      }

      // Sort by date ascending
      events.sort((a, b) => {
        if (!a._sort) return -1
        if (!b._sort) return 1
        return a._sort.localeCompare(b._sort)
      })

      // Running balance (positive = customer owes us, negative = we owe customer)
      let runningBalance = 0
      const rows = events.map(ev => {
        runningBalance += ev.debitG - ev.creditG
        const closingBalance = Math.round(runningBalance)  // grams due (positive) or excess (negative)
        return { ...ev, closingBalance }
      })

      setLedgerRows(rows)
    } catch (err) {
      console.error(err)
      toast.error('Failed to load ledger')
    } finally {
      setLoading(false)
    }
  }

  const finalBalance = ledgerRows.length > 0 ? ledgerRows[ledgerRows.length - 1].closingBalance : 0

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="modal modal-xl">
        <div className="modal-header no-print">
          <div>
            <div className="modal-title">{t('customer_ledger_title')} — {customer.name}</div>
            <div className="text-xs text-muted mt-1">
              {customer.phone && `📞 ${customer.phone}`}
              {customer.city && ` · ${customer.city}`}
            </div>
          </div>
          <div className="flex gap-2">
            <button className="btn btn-ghost btn-sm" onClick={() => window.print()}>
              <Printer size={13} /> {t('print')}
            </button>
            <button className="btn btn-ghost btn-sm btn-icon" onClick={onClose}><X size={16} /></button>
          </div>
        </div>

        <div className="modal-body">
          {/* Group enrollments */}
          {memberships.length > 0 && (
            <div className="flex gap-2 mb-5" style={{ flexWrap: 'wrap' }}>
              {memberships.map(m => (
                <div key={m.id} style={{
                  background: 'var(--clr-gold-bg)',
                  border: '1px solid var(--clr-gold-dim)',
                  borderRadius: 'var(--r-md)',
                  padding: '6px 14px',
                  fontSize: '0.8rem',
                }}>
                  <span className="text-gold font-semibold">{m.groups?.name}</span>
                  <span className="text-muted"> · Ticket #{m.ticket_no}</span>
                  <span className="text-muted"> · {gramsToKg(m.groups?.num_months * m.groups?.unit_limit_g)} kg liability</span>
                  {m.is_withdrawn && (
                    <span className="badge badge-maroon" style={{ marginLeft: 6, fontSize: '0.65rem' }}>Withdrawn M{m.withdrawal_month}</span>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Final balance summary */}
          <div style={{
            display: 'flex',
            gap: 16,
            marginBottom: 20,
            flexWrap: 'wrap',
          }}>
            <div className="stat-card" style={{ flex: 1, minWidth: 160 }}>
              <div className="stat-label">{t('net_closing_balance')}</div>
              <div className={`stat-value ${finalBalance > 0 ? 'red' : finalBalance < 0 ? 'green' : ''}`}>
                {finalBalance > 0
                  ? `${Math.abs(finalBalance).toLocaleString('en-IN')} g ${t('badge_due')}`
                  : finalBalance < 0
                  ? `+${Math.abs(finalBalance).toLocaleString('en-IN')} g ${t('badge_excess')}`
                  : t('badge_settled')
                }
              </div>
            </div>
          </div>

          {/* Main ledger table */}
          {loading ? (
            <div className="loading-overlay"><div className="spinner" /> {t('loading')}</div>
          ) : ledgerRows.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-title">{lang === 'ta' ? 'இந்த வாடிக்கையாளருக்கு பரிவர்த்தனைகள் எதுவும் இல்லை' : 'No transactions found for this customer'}</div>
            </div>
          ) : (
            <>
              <div className="table-scroll-hint mb-2">{t('swipe_hint')}</div>
              <div className="table-wrap" style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
                <table style={{ minWidth: 680 }}>
                  <thead>
                    <tr>
                      <th>{t('th_ledger_date')}</th>
                      <th>{t('th_ledger_ref')}</th>
                      <th>{t('th_ledger_desc')}</th>
                      <th>{t('th_ledger_debit')}</th>
                      <th>{t('th_ledger_credit')}</th>
                      <th style={{ color: 'var(--clr-danger-text)', minWidth: 120 }}>{t('th_ledger_close_due')}</th>
                      <th style={{ color: 'var(--clr-success-text)', minWidth: 120 }}>{t('th_ledger_close_excess')}</th>
                    </tr>
                  </thead>
                <tbody>
                  {ledgerRows.map((row, i) => {
                    const isBalance = row.closingBalance > 0
                    const isExcess  = row.closingBalance < 0
                    const absBalance = Math.abs(row.closingBalance)

                    return (
                      <tr key={i} style={{
                        background: row.isWithdrawal ? 'rgba(201,168,76,0.04)' : undefined,
                      }}>
                        <td className="text-secondary text-sm" style={{ whiteSpace: 'nowrap' }}>
                          {row.date ? format(parseISO(row.date), 'dd MMM yyyy') : '—'}
                        </td>
                        <td className="font-mono font-semibold text-sm">{row.ref}</td>
                        <td>
                          <div className="flex items-center gap-2">
                            {row.type === 'chit_demand' && (
                              <span className={`badge ${row.isWithdrawal ? 'badge-gold' : 'badge-gray'}`}
                                style={{ fontSize: '0.65rem' }}>
                                {row.isWithdrawal ? '🏆 Withdrew' : 'Chit'}
                              </span>
                            )}
                            {row.type === 'receipt' && (
                              <span className="badge badge-green" style={{ fontSize: '0.65rem' }}>Receipt</span>
                            )}
                            {row.type === 'issue' && (
                              <span className="badge badge-red" style={{ fontSize: '0.65rem' }}>Issue</span>
                            )}
                            <span style={{ fontSize: '0.82rem' }}>{row.particulars}</span>
                          </div>
                        </td>
                        <td className="font-mono">
                          {row.debitG > 0
                            ? <span className="ledger-balance">{row.debitG.toLocaleString('en-IN', { maximumFractionDigits: 3 })} g</span>
                            : <span className="text-muted">—</span>
                          }
                        </td>
                        <td className="font-mono">
                          {row.creditG > 0
                            ? <span className="ledger-excess">+{row.creditG.toLocaleString('en-IN', { maximumFractionDigits: 3 })} g</span>
                            : <span className="text-muted">—</span>
                          }
                        </td>
                        <td>
                          {isBalance
                            ? <span className="ledger-balance">{absBalance.toLocaleString('en-IN')} g</span>
                            : <span className="ledger-settled">—</span>
                          }
                        </td>
                        <td>
                          {isExcess
                            ? <span className="ledger-excess">+{absBalance.toLocaleString('en-IN')} g</span>
                            : <span className="ledger-settled">—</span>
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

        <div className="modal-footer no-print">
          <button className="btn btn-ghost" onClick={onClose}>{t('close')}</button>
        </div>
      </div>
    </div>
  )
}
