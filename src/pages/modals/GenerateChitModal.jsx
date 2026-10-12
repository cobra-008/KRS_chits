import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { chitDrawsApi, groupsApi, membersApi } from '../../lib/api'
import { calcChitDraw, gramsToKg } from '../../lib/silverCalc'
import { downloadChitSettlementPdf, printChitSettlementVoucher } from '../../lib/pdfGenerator'
import { format } from 'date-fns'
import toast from 'react-hot-toast'
import { Trophy, Printer, ArrowRight, X, Download } from 'lucide-react'
import { useLanguage } from '../../context/LanguageContext'

export default function GenerateChitModal({ group, members: initialMembers, draws: initialDraws, onClose, onSaved, onNavigate }) {
  const { t, lang } = useLanguage()
  const [allGroups, setAllGroups] = useState([])
  const [selectedGroupId, setSelectedGroupId] = useState(group?.id || '')
  const [groupMembers, setGroupMembers] = useState(initialMembers || [])
  const [drawDate, setDrawDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [selectedRound, setSelectedRound] = useState(1)
  const [withdrawerMemberId, setWithdrawerMemberId] = useState('')
  const [discountG, setDiscountG] = useState('')
  const [oldDuesG, setOldDuesG] = useState('')
  const [deliveryStatus, setDeliveryStatus] = useState('hold_excess')
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

  useEffect(() => {
    if (currentGroup?.id) {
      membersApi.getByGroup(currentGroup.id).then(mems => {
        setGroupMembers(mems || [])
        const eligible = (mems || []).filter(m => !m.is_withdrawn)
        if (eligible.length > 0 && !withdrawerMemberId) {
          setWithdrawerMemberId(eligible[0].id)
        }
      }).catch(() => {})
      const nextM = (currentGroup.months_happened || 0) + 1
      setSelectedRound(nextM <= (currentGroup.num_months || 20) ? nextM : currentGroup.num_months || 20)
    }
  }, [currentGroup?.id])

  const selectedMember = groupMembers.find(m => m.id === withdrawerMemberId)
  const withdrawerSharePct = selectedMember?.share_pct || 100
  const shareRatio = withdrawerSharePct / 100

  const numMonths = currentGroup.num_months || 20
  const unitLimitG = currentGroup.unit_limit_g || 1000
  const schemeBaseKg = gramsToKg(numMonths * unitLimitG)
  const withdrawerCapKg = (parseFloat(schemeBaseKg) * shareRatio).toFixed(3)
  const baseProfitG = Math.round((numMonths * unitLimitG) * 0.04)

  // Calculation engine matches user example
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
    deliveryStatus: deliveryStatus === 'hold_excess' ? 'Held as Customer Excess Fine' : 'Immediate Physical Delivery',
  })

  const handleSave = async (isIssueNavigation = false) => {
    if (!withdrawerMemberId) { toast.error('Select a withdrawing member'); return }
    if (!currentGroup?.id)   { toast.error('Select a chit scheme'); return }

    setSaving(true)
    try {
      // 1. Create chit draw
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
        delivery_status: deliveryStatus,
        withdrawer_share_pct: withdrawerSharePct,
      })

      // 2. Advance group months_happened if this is the next round
      if (parseInt(selectedRound) > (currentGroup.months_happened || 0)) {
        await supabase
          .from('groups')
          .update({ months_happened: parseInt(selectedRound) })
          .eq('id', currentGroup.id)
      }

      // 3. Update withdrawer member: mark withdrawn, record disbursed amount
      const currentDeposited = parseFloat(selectedMember?.fine_deposited) || 0
      const newDeposited = deliveryStatus === 'hold_excess'
        ? currentDeposited + calc.netSilverToIssueG + calc.monthlyPremiumG
        : currentDeposited + calc.monthlyPremiumG

      await membersApi.update(withdrawerMemberId, {
        is_withdrawn: true,
        withdrawal_month: parseInt(selectedRound),
        fine_disbursed: calc.netSilverToIssueG,
        fine_deposited: newDeposited,
      })

      // 4. Log in transaction_log for withdrawer
      try {
        await supabase.from('transaction_log').insert({
          log_date: drawDate,
          type: 'chit_settlement',
          ref_id: draw.id,
          ref_type: 'chit_draw',
          customer_id: selectedMember?.customer_id,
          customer_name: selectedMember?.customers?.name,
          voucher_ref: `CHIT-${currentGroup.name}-M${selectedRound}`,
          description: `Month ${selectedRound} Chit Settlement — Withdrawer: ${selectedMember?.customers?.name} (${withdrawerSharePct}% Share) [${deliveryStatus === 'hold_excess' ? 'Held as Customer Excess Fine' : 'Physical Delivery'}]`,
          pure_in_g: deliveryStatus === 'hold_excess' ? calc.netSilverToIssueG : 0,
          pure_out_g: deliveryStatus === 'hold_excess' ? 0 : calc.netSilverToIssueG,
        })
      } catch (logErr) {
        console.warn('Transaction log insert notice:', logErr)
      }

      // 5. Automatically generate & download custom PDF
      try {
        downloadChitSettlementPdf(getPdfParams())
      } catch (pdfErr) {
        console.warn('PDF auto-download notice:', pdfErr)
      }

      toast.success(lang === 'ta' ? `மாதம் ${selectedRound} சீட்டு சேமிக்கப்பட்டது! PDF பதிவிறக்கப்பட்டது` : `Month ${selectedRound} Chit Settlement Saved & PDF Downloaded!`)

      if (isIssueNavigation) {
        onClose()
        onNavigate('issue')
      } else {
        onSaved()
      }
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

            <div className="form-group" style={{ width: 180 }}>
              <label className="form-label">
                {t('draw_month_round', 'Draw Month / Round:')}
              </label>
              <select
                className="form-control"
                value={selectedRound}
                onChange={e => setSelectedRound(Number(e.target.value))}
              >
                {Array.from({ length: numMonths }, (_, i) => i + 1).map(m => (
                  <option key={m} value={m}>
                    {lang === 'ta' ? `மாதம் ${m} / ${numMonths}` : `Month ${m} of ${numMonths}`}
                  </option>
                ))}
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
                    Ticket #{m.ticket_no} - {m.customers?.name} ({m.share_pct || 100}% Share) {m.is_withdrawn ? '(Withdrawn)' : ''}
                  </option>
                ))}
              </select>
              <div className="text-xs text-gold font-semibold mt-1">
                Portion: {withdrawerSharePct}% ({shareRatio}x Share) • Capacity: {withdrawerCapKg} KG
              </div>
            </div>

            <div className="form-group" style={{ width: 260 }}>
              <label className="form-label">
                {t('accepted_auction_discount', 'Accepted Auction Discount (g):')}
              </label>
              <input
                id="chit-discount"
                type="number"
                step="any"
                min="0"
                className="form-control font-mono font-bold"
                value={discountG}
                onChange={e => setDiscountG(e.target.value)}
                placeholder="Enter discount (e.g. 9000)"
              />
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

          {/* Silver Delivery Status Dropdown */}
          <div className="card" style={{ padding: '14px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16 }}>
            <div>
              <div className="font-bold text-primary">
                {t('silver_delivery_status', 'Silver Delivery Status:')}
              </div>
              <div className="text-xs text-muted mt-1">
                {t('silver_delivery_hint', 'Held silver reflects as Customer Excess Fine on account ledger.')}
              </div>
            </div>

            <select
              className="form-control font-semibold"
              value={deliveryStatus}
              onChange={e => setDeliveryStatus(e.target.value)}
              style={{ width: 340 }}
            >
              <option value="hold_excess">Hold as Customer Excess Fine (Account Credit)</option>
              <option value="physical">Immediate Physical Silver Delivery</option>
            </select>
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
              id="btn-save-chit"
              type="button"
              className="btn btn-secondary"
              onClick={() => handleSave(false)}
              disabled={saving}
            >
              {saving ? t('saving', 'Saving…') : t('save_chit_hold_excess', 'Save Chit & Generate PDF')}
            </button>

            <button
              id="btn-chit-issue-voucher"
              type="button"
              className="btn btn-gold"
              onClick={() => handleSave(true)}
              disabled={saving}
            >
              {t('issue_voucher_btn', 'Issue Voucher')} <ArrowRight size={15} />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
