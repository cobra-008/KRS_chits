import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { chitDrawsApi, groupsApi, membersApi } from '../../lib/api'
import { calcChitDraw, gramsToKg } from '../../lib/silverCalc'
import { downloadChitSettlementPdf, printChitSettlementVoucher } from '../../lib/pdfGenerator'
import { format } from 'date-fns'
import toast from 'react-hot-toast'
import { Trophy, Printer, X, Download, CheckCircle2 } from 'lucide-react'
import { useLanguage } from '../../context/LanguageContext'

export default function GenerateChitModal({ group, members: initialMembers, onClose, onSaved }) {
  const { t, lang } = useLanguage()
  const [allGroups, setAllGroups] = useState([])
  const [selectedGroupId, setSelectedGroupId] = useState(group?.id || '')
  const [groupMembers, setGroupMembers] = useState(initialMembers || [])
  const [existingDraws, setExistingDraws] = useState([])
  const [drawDate, setDrawDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [selectedRound, setSelectedRound] = useState(1)
  const [withdrawerMemberId, setWithdrawerMemberId] = useState('')
  const [discountG, setDiscountG] = useState('')
  const [oldDuesG, setOldDuesG] = useState('')
  const [saving, setSaving] = useState(false)

  // Load all groups if not present
  useEffect(() => {
    groupsApi.getAll().then(res => {
      setAllGroups(res || [])
      if (!selectedGroupId && res?.length) {
        setSelectedGroupId(res[0].id)
      }
    }).catch(() => {})
  }, [])

  const currentGroup = allGroups.find(g => g.id === selectedGroupId) || group || {}

  // Load members and existing draws for this group
  useEffect(() => {
    if (currentGroup?.id) {
      Promise.all([
        membersApi.getByGroup(currentGroup.id),
        supabase.from('chit_draws').select('*').eq('group_id', currentGroup.id).order('month_no')
      ]).then(([mems, drawRes]) => {
        const memList = mems || []
        const drawsList = drawRes.data || []
        setGroupMembers(memList)
        setExistingDraws(drawsList)

        // Select first eligible member who hasn't withdrawn
        const eligible = memList.filter(m => !m.is_withdrawn)
        if (eligible.length > 0) {
          setWithdrawerMemberId(eligible[0].id)
        } else {
          setWithdrawerMemberId('')
        }

        // Find completed months and pick the first available undrawn month
        const drawnSet = new Set(drawsList.map(d => d.month_no))
        const totalMonths = currentGroup.num_months || 20
        let nextUndrawn = 1
        while (drawnSet.has(nextUndrawn) && nextUndrawn <= totalMonths) {
          nextUndrawn++
        }
        setSelectedRound(nextUndrawn <= totalMonths ? nextUndrawn : totalMonths)
      }).catch(err => {
        console.error(err)
        toast.error('Failed to load group details')
      })
    }
  }, [currentGroup?.id])

  const drawnMonthsSet = new Set(existingDraws.map(d => d.month_no))
  const isSelectedRoundDrawn = drawnMonthsSet.has(parseInt(selectedRound))

  const selectedMember = groupMembers.find(m => m.id === withdrawerMemberId)
  const withdrawerSharePct = selectedMember?.share_pct || 100
  const shareRatio = withdrawerSharePct / 100

  const numMonths = currentGroup.num_months || 20
  const unitLimitG = currentGroup.unit_limit_g || 1000
  const schemeBaseKg = gramsToKg(numMonths * unitLimitG)
  const withdrawerCapKg = (parseFloat(schemeBaseKg) * shareRatio).toFixed(3)
  const baseProfitG = Math.round((numMonths * unitLimitG) * 0.04)

  // Pure mathematical calculation engine matching user's exact specification
  const calc = calcChitDraw({
    numMonths,
    unitLimitG,
    numMembers: numMonths,
    discountG: parseFloat(discountG) || 0,
    companyProfitPct: currentGroup.company_profit_pct || 4,
    oldDuesG: parseFloat(oldDuesG) || 0,
    withdrawerSharePct,
  })

  const getPdfParams = () => ({
    schemeName: currentGroup.name || 'KRS Silver Scheme',
    roundNo: parseInt(selectedRound) || 1,
    totalRounds: numMonths,
    drawDate,
    customerName: selectedMember?.customers?.name || 'Member',
    ticketNo: selectedMember?.ticket_no || 1,
    sharePct: withdrawerSharePct,
    grossCapacityG: calc.totalCapacityG,
    discountG: calc.discountG,
    companyProfitG: calc.companyProfitG,
    dividendPerMemberG: calc.dividendPerMemberG,
    monthlyPremiumG: calc.monthlyPremiumG,
    oldDuesG: calc.oldDuesG,
    netDisburseG: calc.netSilverToIssueG,
    deliveryStatus: 'Held as Customer Excess Fine',
  })

  const handleSaveChit = async () => {
    if (!currentGroup?.id) {
      toast.error('Please select a chit scheme')
      return
    }
    if (!withdrawerMemberId) {
      toast.error('Please select an eligible withdrawing member')
      return
    }
    if (selectedMember?.is_withdrawn) {
      toast.error(`Member #${selectedMember.ticket_no} has already withdrawn in Month ${selectedMember.withdrawal_month}. Cannot withdraw again.`)
      return
    }
    if (isSelectedRoundDrawn) {
      toast.error(`Month ${selectedRound} has already been completed and settled. You cannot generate another chit for the same month.`)
      return
    }
    if (!discountG || parseFloat(discountG) <= 0) {
      toast.error('Accepted Auction Discount is mandatory. Please enter the accepted discount in grams.')
      return
    }

    setSaving(true)
    try {
      // 1. Create chit draw entry in database
      const draw = await chitDrawsApi.create({
        group_id: currentGroup.id,
        month_no: parseInt(selectedRound),
        draw_date: drawDate,
        withdrawer_member_id: withdrawerMemberId,
        total_capacity_g: calc.totalCapacityG,
        discount_g: calc.discountG,
        company_profit_g: calc.companyProfitG,
        net_dividend_pool_g: calc.netDividendPoolG,
        dividend_per_member_g: calc.dividendPerMemberG,
        monthly_premium_g: calc.monthlyPremiumG,
        old_dues_g: calc.oldDuesG,
        net_silver_to_issue_g: calc.netSilverToIssueG,
        delivery_status: 'hold_excess',
        withdrawer_share_pct: withdrawerSharePct,
      })

      // 2. Advance group months_happened if this round is greater
      if (parseInt(selectedRound) > (currentGroup.months_happened || 0)) {
        await supabase
          .from('groups')
          .update({ months_happened: parseInt(selectedRound) })
          .eq('id', currentGroup.id)
      }

      // 3. Mark member as withdrawn specifically for this month and credit net fine
      const currentDeposited = parseFloat(selectedMember?.fine_deposited) || 0
      const newDeposited = currentDeposited + calc.netSilverToIssueG + calc.monthlyPremiumG

      await membersApi.update(withdrawerMemberId, {
        is_withdrawn: true,
        withdrawal_month: parseInt(selectedRound),
        fine_disbursed: calc.netSilverToIssueG,
        fine_deposited: newDeposited,
      })

      // 4. Log in transaction_log for active ledger reflection
      try {
        await supabase.from('transaction_log').insert({
          log_date: drawDate,
          type: 'chit_settlement',
          ref_id: draw.id,
          ref_type: 'chit_draw',
          customer_id: selectedMember?.customer_id,
          customer_name: selectedMember?.customers?.name,
          voucher_ref: `CHIT-${currentGroup.name}-M${selectedRound}`,
          description: `Month ${selectedRound} Chit Draw Settlement — Withdrawer: ${selectedMember?.customers?.name} (${withdrawerSharePct}% Share) [Held as Customer Excess Fine]`,
          pure_in_g: calc.netSilverToIssueG,
          pure_out_g: 0,
        })
      } catch (logErr) {
        console.warn('Transaction log insert notice:', logErr)
      }

      // 5. Automatically generate & download custom formal PDF
      try {
        await downloadChitSettlementPdf(getPdfParams())
      } catch (pdfErr) {
        console.warn('PDF auto-download notice:', pdfErr)
      }

      toast.success(lang === 'ta'
        ? `மாதம் ${selectedRound} சீட்டு சேமிக்கப்பட்டது! PDF பதிவிறக்கப்பட்டது`
        : `Month ${selectedRound} Chit Settlement Saved & PDF Downloaded!`
      )

      onSaved()
    } catch (err) {
      console.error(err)
      toast.error(err.message || 'Failed to save chit settlement')
    } finally {
      setSaving(false)
    }
  }

  const handlePrint = () => {
    printChitSettlementVoucher(getPdfParams())
  }

  const handleDownloadPdf = () => {
    if (!discountG || parseFloat(discountG) <= 0) {
      toast.error('Please enter accepted auction discount first')
      return
    }
    downloadChitSettlementPdf(getPdfParams())
  }

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="modal modal-xl">
        {/* Modal Header */}
        <div className="modal-header">
          <div className="flex items-start gap-3">
            <div style={{
              background: 'var(--clr-gold-bg)',
              color: 'var(--clr-gold)',
              padding: '8px 10px',
              borderRadius: 'var(--r-md)',
              border: '1px solid var(--clr-gold-border)'
            }}>
              <Trophy size={22} />
            </div>
            <div>
              <div className="modal-title">
                {t('monthly_chit_draw_settlement', 'Monthly Chit Draw & Settlement')}
              </div>
              <div className="text-xs text-muted mt-1">
                {schemeBaseKg} KG Pure Silver Scheme • 4% Company Profit ({baseProfitG.toLocaleString('en-IN')} g) Deducted
              </div>
            </div>
          </div>
          <button className="btn btn-ghost btn-sm btn-icon" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="modal-body">
          {/* Top Form Row: Scheme, Round, Date */}
          <div className="form-row mb-4">
            <div className="form-group flex-1">
              <label className="form-label">
                {t('select_chit_scheme', 'Select Chit Scheme:')}
              </label>
              <select
                className="form-control"
                value={selectedGroupId}
                onChange={e => setSelectedGroupId(e.target.value)}
              >
                {allGroups.map(g => (
                  <option key={g.id} value={g.id}>{g.name}</option>
                ))}
              </select>
            </div>

            <div className="form-group" style={{ width: 220 }}>
              <label className="form-label">
                {t('draw_month_round', 'Draw Month / Round:')} <span className="text-danger">*</span>
              </label>
              <select
                className="form-control font-semibold"
                value={selectedRound}
                onChange={e => setSelectedRound(Number(e.target.value))}
              >
                {Array.from({ length: numMonths }, (_, i) => i + 1).map(m => {
                  const isDrawn = drawnMonthsSet.has(m)
                  return (
                    <option key={m} value={m} disabled={isDrawn}>
                      {lang === 'ta' ? `மாதம் ${m} / ${numMonths}` : `Month ${m} of ${numMonths}`} {isDrawn ? '(✓ Completed)' : ''}
                    </option>
                  )
                })}
              </select>
            </div>

            <div className="form-group" style={{ width: 170 }}>
              <label className="form-label">
                {t('settlement_date', 'Settlement Date:')}
              </label>
              <input
                type="date"
                className="form-control font-mono"
                value={drawDate}
                onChange={e => setDrawDate(e.target.value)}
              />
            </div>
          </div>

          {/* Already Completed Warning */}
          {isSelectedRoundDrawn && (
            <div className="card mb-4" style={{ background: 'var(--clr-danger-bg)', border: '1.5px solid var(--clr-danger)', padding: '10px 14px' }}>
              <div className="text-danger font-bold text-xs">
                ⚠️ Month {selectedRound} has already been drawn and settled! You cannot re-generate a chit for an already completed month.
              </div>
            </div>
          )}

          {/* Row 2: Withdrawing Member & Accepted Auction Discount */}
          <div className="form-row mb-5">
            <div className="form-group flex-1">
              <label className="form-label">
                {t('withdrawing_member', 'Withdrawing Member:')} <span className="text-danger">*</span>
              </label>
              <select
                id="chit-withdrawer"
                className="form-control"
                value={withdrawerMemberId}
                onChange={e => setWithdrawerMemberId(e.target.value)}
              >
                <option value="">Select Member</option>
                {groupMembers.map(m => (
                  <option key={m.id} value={m.id} disabled={m.is_withdrawn}>
                    Ticket #{m.ticket_no} - {m.customers?.name} ({m.share_pct || 100}% Share) {m.is_withdrawn ? `[Withdrawn in Month ${m.withdrawal_month}]` : ''}
                  </option>
                ))}
              </select>
              <div className="text-xs text-gold font-semibold mt-1">
                Portion: {withdrawerSharePct}% ({shareRatio}x Share) • Capacity: {withdrawerCapKg} KG
              </div>
            </div>

            <div className="form-group" style={{ width: 280 }}>
              <label className="form-label font-bold">
                {t('accepted_auction_discount', 'Accepted Auction Discount (g):')} <span className="text-danger">*</span>
              </label>
              <input
                id="chit-discount"
                type="number"
                step="any"
                min="1"
                className="form-control font-mono font-bold"
                value={discountG}
                onChange={e => setDiscountG(e.target.value)}
                placeholder="Enter discount (e.g. 9000)"
                required
              />
              <div className="text-xs text-muted mt-1">
                Mandatory auction discount in grams
              </div>
            </div>
          </div>

          {/* SETTLEMENT FORMULA & AUDIT BREAKDOWN */}
          <div className="card card-gold mb-5" style={{ padding: '18px 20px' }}>
            <div className="text-xs font-bold text-gold uppercase tracking-wider mb-4">
              {t('settlement_formula_breakdown', 'SETTLEMENT FORMULA & AUDIT BREAKDOWN:')}
            </div>

            {/* Top row of formula: 4 metrics */}
            <div className="grid grid-cols-4 gap-4 mb-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '14px' }}>
              <div className="stat-card" style={{ padding: '12px 14px' }}>
                <div className="stat-label">GROSS CAPACITY</div>
                <div className="stat-value font-mono" style={{ fontSize: '1.25rem' }}>
                  {calc.totalCapacityG.toLocaleString('en-IN')} g
                </div>
              </div>

              <div className="stat-card" style={{ padding: '12px 14px' }}>
                <div className="stat-label">AUCTION DISCOUNT</div>
                <div className="stat-value font-mono text-danger" style={{ fontSize: '1.25rem' }}>
                  - {calc.discountG.toLocaleString('en-IN')} g
                </div>
              </div>

              <div className="stat-card" style={{ padding: '12px 14px' }}>
                <div className="stat-label">4% PROFIT (CO.)</div>
                <div className="stat-value font-mono text-gold" style={{ fontSize: '1.25rem' }}>
                  {calc.companyProfitG.toLocaleString('en-IN')} g
                </div>
              </div>

              <div className="stat-card" style={{ padding: '12px 14px' }}>
                <div className="stat-label">DIVIDEND / MEMBER</div>
                <div className="stat-value font-mono text-success" style={{ fontSize: '1.25rem' }}>
                  {calc.dividendPerMemberG.toLocaleString('en-IN')} g
                </div>
              </div>
            </div>

            {/* Bottom row of formula: Premium, Old Dues & Prominent Net Disburse Card */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1.3fr', gap: '14px', alignItems: 'center' }}>
              <div className="stat-card" style={{ padding: '12px 14px' }}>
                <div className="stat-label">MONTHLY PREMIUM (DEMANDED)</div>
                <div className="stat-value font-mono" style={{ fontSize: '1.2rem' }}>
                  {calc.monthlyPremiumG.toLocaleString('en-IN')} g
                </div>
                <div className="text-xs text-muted mt-1">
                  ({Math.round(unitLimitG * shareRatio).toLocaleString('en-IN')} g - Dividend)
                </div>
              </div>

              <div className="stat-card" style={{ padding: '12px 14px' }}>
                <div className="stat-label">OLD DUES DEDUCTED</div>
                <div className="font-mono flex items-center gap-1 mt-1">
                  <input
                    type="number"
                    step="any"
                    min="0"
                    placeholder="0"
                    value={oldDuesG}
                    onChange={e => setOldDuesG(e.target.value)}
                    className="form-control font-mono font-bold text-danger"
                    style={{ width: 110, padding: '4px 8px', height: 32 }}
                  />
                  <span className="text-danger font-bold">g</span>
                </div>
              </div>

              {/* Net Silver to Disburse Card */}
              <div style={{
                background: 'var(--clr-gold-bg)',
                border: '1.5px solid var(--clr-gold)',
                borderRadius: 'var(--r-md)',
                padding: '12px 18px',
                textAlign: 'left'
              }}>
                <div className="text-xs font-bold text-gold uppercase tracking-wider">
                  NET SILVER TO DISBURSE
                </div>
                <div className="font-mono text-gold font-bold" style={{ fontSize: '1.75rem', lineHeight: 1.2, marginTop: 4 }}>
                  {calc.netSilverToIssueG.toLocaleString('en-IN')} g
                </div>
                <div className="font-mono text-xs text-gold-dim mt-1">
                  {gramsToKg(calc.netSilverToIssueG)} KG Pure Silver
                </div>
              </div>
            </div>
          </div>

          {/* Account Credit Notice Card */}
          <div className="card" style={{ padding: '12px 18px', background: 'var(--clr-success-bg)', border: '1px solid var(--clr-success)', display: 'flex', alignItems: 'center', gap: 12 }}>
            <CheckCircle2 size={20} className="text-success" style={{ flexShrink: 0 }} />
            <div className="text-xs text-success" style={{ lineHeight: 1.45 }}>
              <strong>Automatic Account Credit:</strong> Upon generating this chit, the net fine ({calc.netSilverToIssueG.toLocaleString('en-IN')} g) will be credited to {selectedMember?.customers?.name || 'the member'}&apos;s account as <strong>Customer Excess Fine</strong>. When silver is physically handed over later, use the <strong>Issue Voucher</strong> page to record the disbursal from inventory.
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="modal-footer" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div className="flex gap-2">
            <button
              id="btn-download-chit-pdf"
              type="button"
              className="btn btn-secondary"
              onClick={handleDownloadPdf}
            >
              <Download size={15} /> Download PDF
            </button>
            <button
              id="btn-print-chit-voucher"
              type="button"
              className="btn btn-ghost"
              onClick={handlePrint}
            >
              <Printer size={15} /> {t('print_voucher', 'Print Voucher')}
            </button>
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              className="btn btn-ghost"
              onClick={onClose}
              disabled={saving}
            >
              {t('cancel', 'Cancel')}
            </button>

            <button
              id="btn-save-chit"
              type="button"
              className="btn btn-gold"
              onClick={handleSaveChit}
              disabled={saving || isSelectedRoundDrawn}
            >
              {saving ? t('saving', 'Saving…') : 'Generate & Save Chit'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
