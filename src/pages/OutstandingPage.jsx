import { useState, useEffect, useMemo } from 'react'
import { Search, Eye, ArrowUpDown, Filter, Users, AlertCircle, CheckCircle2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '../lib/supabase'
import { gramsToKg } from '../lib/silverCalc'
import CustomerLedgerModal from './modals/CustomerLedgerModal'
import { useLanguage } from '../context/LanguageContext'

export default function OutstandingPage() {
  const { t, lang } = useLanguage()
  const [customersData, setCustomersData] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState('due_desc') // 'due_desc' | 'excess_desc' | 'name_asc'
  const [filterType, setFilterType] = useState('all') // 'all' | 'due' | 'excess' | 'settled'
  const [ledgerCustomer, setLedgerCustomer] = useState(null)

  useEffect(() => { load() }, [])

  const load = async () => {
    try {
      setLoading(true)

      // 1. Fetch all customers
      const { data: customers, error: cErr } = await supabase
        .from('customers')
        .select('*')
        .order('name')
      if (cErr) throw cErr

      // 2. Fetch all group memberships with group details
      const { data: members, error: mErr } = await supabase
        .from('group_members')
        .select(`
          *,
          groups ( id, name, num_months, unit_limit_g, months_happened, start_date )
        `)
      if (mErr) throw mErr

      // 3. Fetch all chit draws
      const { data: draws, error: dErr } = await supabase
        .from('chit_draws')
        .select('*')
      if (dErr) throw dErr

      // 4. Fetch all vouchers (receipts & issues)
      const { data: vouchers, error: vErr } = await supabase
        .from('vouchers')
        .select('customer_id, type, total_pure_g, voucher_date')
      if (vErr) throw vErr

      // 5. Aggregate strictly ONCE per customer from their complete ledger
      const aggregated = (customers || []).map(cust => {
        const custMembers = (members || []).filter(m => m.customer_id === cust.id)
        const custVouchers = (vouchers || []).filter(v => v.customer_id === cust.id)

        let totalChitDemanded = 0
        let totalChitWithdrawerCredit = 0

        // Calculate chit demands and withdrawer credits across all schemes customer is in
        for (const mem of custMembers) {
          const grp = mem.groups
          if (!grp) continue
          const groupDraws = (draws || []).filter(d => d.group_id === grp.id)
          const shareRatio = (parseFloat(mem.share_pct) || 100) / 100

          for (let round = 1; round <= (grp.months_happened || 0); round++) {
            const draw = groupDraws.find(d => d.month_no === round)
            let baseDemanded = parseFloat(grp.unit_limit_g) || 1000

            if (draw) {
              if (draw.withdrawer_share_pct && draw.withdrawer_share_pct !== 100) {
                const div = parseFloat(draw.dividend_per_member_g) || 0
                const baseUnit = parseFloat(grp.unit_limit_g) || 1000
                baseDemanded = Math.max(0, baseUnit - div)
              } else {
                baseDemanded = parseFloat(draw.monthly_premium_g) || (baseDemanded - (parseFloat(draw.dividend_per_member_g) || 0))
              }

              // If this member was the withdrawer in this round
              if (draw.withdrawer_member_id === mem.id) {
                totalChitWithdrawerCredit += parseFloat(draw.net_silver_to_issue_g) || 0
              }
            }

            totalChitDemanded += Math.round(baseDemanded * shareRatio)
          }
        }

        // Voucher debits and credits
        let totalReceiptVouchers = 0
        let totalIssueVouchers = 0

        for (const v of custVouchers) {
          const pure = parseFloat(v.total_pure_g) || 0
          if (v.type === 'receipt') {
            totalReceiptVouchers += pure
          } else if (v.type === 'issue') {
            totalIssueVouchers += pure
          }
        }

        // Check if customer had fine_deposited recorded directly on member tickets without vouchers
        const totalMemberDeposits = custMembers.reduce((s, m) => s + (parseFloat(m.fine_deposited) || 0), 0)
        // If member deposits exceed voucher receipts (e.g. legacy direct deposits), account for max
        const effectiveDeposits = Math.max(totalReceiptVouchers, totalMemberDeposits)

        // Ledger formula:
        // Total Debits against customer = Chit Demands + Silver Issued to them
        // Total Credits in favor of customer = Silver Deposited + Chit Net Silver Credited (held as excess)
        const totalDebits = totalChitDemanded + totalIssueVouchers
        const totalCredits = effectiveDeposits + totalChitWithdrawerCredit

        const netPosition = Math.round(totalDebits - totalCredits)

        const balanceDue = netPosition > 0 ? netPosition : 0
        const excessCredit = netPosition < 0 ? Math.abs(netPosition) : 0

        // Schemes summary
        const enrolledSchemes = custMembers.map(m =>
          `${m.groups?.name || 'Scheme'} (#${m.ticket_no}${m.is_withdrawn ? ` · Withdrawn M${m.withdrawal_month || 1}` : ''})`
        ).join(', ')

        return {
          ...cust,
          enrolledCount: custMembers.length,
          enrolledSchemes: enrolledSchemes || 'None',
          custMembers,
          totalChitDemanded: Math.round(totalChitDemanded),
          totalCredits: Math.round(totalCredits),
          totalDebits: Math.round(totalDebits),
          balanceDue,
          excessCredit,
          netPosition,
        }
      })

      setCustomersData(aggregated)
    } catch (err) {
      console.error(err)
      toast.error('Failed to load outstanding data')
    } finally {
      setLoading(false)
    }
  }

  // Filter and sort customers
  const filteredAndSorted = useMemo(() => {
    return customersData
      .filter(c => {
        // Text search
        const q = search.toLowerCase()
        const matchesSearch =
          c.name?.toLowerCase().includes(q) ||
          c.phone?.includes(q) ||
          c.city?.toLowerCase().includes(q) ||
          c.enrolledSchemes?.toLowerCase().includes(q)

        if (!matchesSearch) return false

        // Type filter
        if (filterType === 'due') return c.balanceDue > 0
        if (filterType === 'excess') return c.excessCredit > 0
        if (filterType === 'settled') return c.balanceDue === 0 && c.excessCredit === 0 && c.enrolledCount > 0
        return true
      })
      .sort((a, b) => {
        if (sortBy === 'due_desc') {
          return b.balanceDue - a.balanceDue
        }
        if (sortBy === 'excess_desc') {
          return b.excessCredit - a.excessCredit
        }
        if (sortBy === 'name_asc') {
          return (a.name || '').localeCompare(b.name || '')
        }
        return 0
      })
  }, [customersData, search, sortBy, filterType])

  // Summary Totals
  const totalDueG = customersData.reduce((s, c) => s + c.balanceDue, 0)
  const totalExcessG = customersData.reduce((s, c) => s + c.excessCredit, 0)
  const dueCount = customersData.filter(c => c.balanceDue > 0).length
  const excessCount = customersData.filter(c => c.excessCredit > 0).length

  return (
    <div className="page">
      {/* Page Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">{t('outstanding_balances', 'Outstanding Balances & Excess Register')}</h1>
          <p className="page-sub">
            {lang === 'ta'
              ? 'வாடிக்கையாளர் கணக்குகளின் நிகர நிலுவைத் தொகை மற்றும் அதிகப்படியான வெள்ளிப் பதிவேடு'
              : 'Consolidated customer position — single aggregated entry per member calculated directly from account ledger'}
          </p>
        </div>

        {/* Search */}
        <div style={{ position: 'relative', width: 280 }}>
          <Search size={15} style={{
            position: 'absolute', left: 12, top: '50%',
            transform: 'translateY(-50%)', color: 'var(--clr-text-muted)',
          }} />
          <input
            id="outstanding-search"
            type="text"
            className="form-control"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={t('search_customer_ph', 'Search customer name, scheme...')}
            style={{ paddingLeft: 36 }}
          />
        </div>
      </div>

      {/* Top Stat Cards (Theme Compliant: Silver / White / Gold) */}
      <div className="stats-grid mb-6">
        {/* Card 1: Total Silver Due */}
        <div className="stat-card" style={{ borderLeft: '4px solid var(--clr-danger)' }}>
          <div className="stat-label flex items-center justify-between">
            <span>{t('total_silver_due', 'TOTAL SILVER DUE (CUSTOMER OWES)')}</span>
            <span className="badge badge-red">{dueCount} {t('members', 'members')}</span>
          </div>
          <div className="stat-value font-mono text-danger">
            {totalDueG.toLocaleString('en-IN')} g
          </div>
          <div className="stat-sub font-mono">
            {gramsToKg(totalDueG)} KG Pure Silver Pending Recovery
          </div>
        </div>

        {/* Card 2: Total Excess Silver */}
        <div className="stat-card" style={{ borderLeft: '4px solid var(--clr-success)' }}>
          <div className="stat-label flex items-center justify-between">
            <span>{t('total_excess_silver', 'TOTAL EXCESS SILVER (HELD WITH US)')}</span>
            <span className="badge badge-green">{excessCount} {t('members', 'members')}</span>
          </div>
          <div className="stat-value font-mono text-success">
            {totalExcessG.toLocaleString('en-IN')} g
          </div>
          <div className="stat-sub font-mono">
            {gramsToKg(totalExcessG)} KG Pure Silver Available for Issue
          </div>
        </div>

        {/* Card 3: Total Enrolled Members */}
        <div className="stat-card" style={{ borderLeft: '4px solid var(--clr-gold)' }}>
          <div className="stat-label">{t('total_registered_customers', 'TOTAL REGISTERED CUSTOMERS')}</div>
          <div className="stat-value font-mono text-gold">
            {customersData.length}
          </div>
          <div className="stat-sub">
            {customersData.filter(c => c.enrolledCount > 0).length} active enrolled members
          </div>
        </div>
      </div>

      {/* Filters and Sort Controls */}
      <div className="card mb-4" style={{ padding: '12px 18px' }}>
        <div className="flex items-center justify-between" style={{ flexWrap: 'wrap', gap: 14 }}>
          {/* Filter Pills */}
          <div className="flex gap-2">
            <button
              className={`btn btn-sm ${filterType === 'all' ? 'btn-gold' : 'btn-ghost'}`}
              onClick={() => setFilterType('all')}
            >
              All ({customersData.length})
            </button>
            <button
              className={`btn btn-sm ${filterType === 'due' ? 'btn-gold' : 'btn-ghost'}`}
              onClick={() => setFilterType('due')}
              style={{ color: filterType === 'due' ? undefined : 'var(--clr-danger-text)' }}
            >
              Due Only ({dueCount})
            </button>
            <button
              className={`btn btn-sm ${filterType === 'excess' ? 'btn-gold' : 'btn-ghost'}`}
              onClick={() => setFilterType('excess')}
              style={{ color: filterType === 'excess' ? undefined : 'var(--clr-success-text)' }}
            >
              Excess Only ({excessCount})
            </button>
            <button
              className={`btn btn-sm ${filterType === 'settled' ? 'btn-gold' : 'btn-ghost'}`}
              onClick={() => setFilterType('settled')}
            >
              Settled
            </button>
          </div>

          {/* Sort Selector */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted flex items-center gap-1 font-semibold">
              <ArrowUpDown size={13} /> {t('sort_by', 'Sort by:')}
            </span>
            <select
              id="sort-outstanding-select"
              className="form-control font-semibold"
              value={sortBy}
              onChange={e => setSortBy(e.target.value)}
              style={{ height: 34, padding: '4px 10px', fontSize: '0.82rem', width: 200 }}
            >
              <option value="due_desc">Most Due on Top (High → Low)</option>
              <option value="excess_desc">Most Excess on Top (High → Low)</option>
              <option value="name_asc">Member Name (A → Z)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main Consolidated Table */}
      {loading ? (
        <div className="loading-overlay"><div className="spinner" /> {t('loading', 'Loading balances…')}</div>
      ) : filteredAndSorted.length === 0 ? (
        <div className="empty-state">
          <Users size={48} style={{ opacity: 0.3 }} />
          <div className="empty-state-title mt-3">No matching customer records found</div>
          <div className="empty-state-sub">Try searching with another keyword or change your filter</div>
        </div>
      ) : (
        <>
          <div className="table-scroll-hint mb-2">{t('swipe_hint')}</div>
          <div className="table-wrap" style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
            <table style={{ minWidth: 880 }}>
              <thead>
                <tr>
                  <th style={{ width: 40 }}>#</th>
                  <th>{t('th_customer', 'Customer / Member')}</th>
                  <th>{t('th_enrolled_schemes', 'Enrolled Schemes & Tickets')}</th>
                  <th className="font-mono text-right">{t('th_total_demanded', 'Demands + Issues')}</th>
                  <th className="font-mono text-right">{t('th_total_deposits', 'Deposits + Chit Credits')}</th>
                  <th className="font-mono text-right" style={{ color: 'var(--clr-danger-text)' }}>
                    {t('th_balance_due', 'Balance Due (g)')}
                  </th>
                  <th className="font-mono text-right" style={{ color: 'var(--clr-success-text)' }}>
                    {t('th_excess_credit', 'Excess Credit (g)')}
                  </th>
                  <th style={{ textAlign: 'center' }}>{t('status', 'Status')}</th>
                  <th style={{ textAlign: 'center' }}>{t('th_action', 'Action')}</th>
                </tr>
              </thead>
              <tbody>
                {filteredAndSorted.map((row, idx) => (
                  <tr
                    key={row.id}
                    style={{ cursor: 'pointer' }}
                    onDoubleClick={() => setLedgerCustomer(row)}
                    title="Double-click to view ledger"
                  >
                    <td className="text-muted text-sm">{idx + 1}</td>

                    <td>
                      <div>
                        <div className="font-bold text-primary">{row.name}</div>
                        <div className="text-xs text-muted">
                          {row.phone ? `📞 ${row.phone}` : ''}
                          {row.city ? ` · ${row.city}` : ''}
                        </div>
                      </div>
                    </td>

                    <td>
                      <div className="text-xs" style={{ maxWidth: 220 }}>
                        {row.enrolledCount > 0 ? (
                          <span className="text-secondary font-semibold">{row.enrolledSchemes}</span>
                        ) : (
                          <span className="text-muted">—</span>
                        )}
                      </div>
                    </td>

                    <td className="font-mono text-right">
                      {row.totalDebits > 0 ? `${row.totalDebits.toLocaleString('en-IN')} g` : '—'}
                    </td>

                    <td className="font-mono text-right">
                      {row.totalCredits > 0 ? `${row.totalCredits.toLocaleString('en-IN')} g` : '—'}
                    </td>

                    <td className="font-mono font-bold text-right">
                      {row.balanceDue > 0 ? (
                        <span className="ledger-balance">{row.balanceDue.toLocaleString('en-IN')} g</span>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </td>

                    <td className="font-mono font-bold text-right">
                      {row.excessCredit > 0 ? (
                        <span className="ledger-excess">+{row.excessCredit.toLocaleString('en-IN')} g</span>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </td>

                    <td style={{ textAlign: 'center' }}>
                      {row.balanceDue > 0 ? (
                        <span className="badge badge-red font-semibold">Due</span>
                      ) : row.excessCredit > 0 ? (
                        <span className="badge badge-green font-semibold">Excess</span>
                      ) : (
                        <span className="badge badge-silver font-semibold">Settled</span>
                      )}
                    </td>

                    <td style={{ textAlign: 'center' }}>
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={(e) => { e.stopPropagation(); setLedgerCustomer(row) }}
                      >
                        <Eye size={13} /> {t('btn_view_ledger', 'Ledger')}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Customer Ledger Modal */}
      {ledgerCustomer && (
        <CustomerLedgerModal
          customer={ledgerCustomer}
          onClose={() => setLedgerCustomer(null)}
        />
      )}
    </div>
  )
}
