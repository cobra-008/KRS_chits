import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { chitDrawsApi, groupsApi, membersApi } from '../../lib/api'
import { calcChitDraw, gramsToKg } from '../../lib/silverCalc'
import { format } from 'date-fns'
import toast from 'react-hot-toast'
import { Trophy, Printer, ArrowRight, X } from 'lucide-react'
import { useLanguage } from '../../context/LanguageContext'

export default function GenerateChitModal({ group, members: initialMembers, draws: initialDraws, onClose, onSaved, onNavigate }) {
  const { t, lang } = useLanguage()
  const [allGroups, setAllGroups] = useState([])
  const [selectedGroupId, setSelectedGroupId] = useState(group?.id || '')
  const [groupMembers, setGroupMembers] = useState(initialMembers || [])
  const [drawDate, setDrawDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [selectedRound, setSelectedRound] = useState(1)
  const [withdrawerMemberId, setWithdrawerMemberId] = useState('')
  const [discountG, setDiscountG] = useState(9000)
  const [oldDuesG, setOldDuesG] = useState(555)
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

  // Calculation engine matches Image 2 perfectly
  const calc = calcChitDraw({
    numMonths,
    unitLimitG,
    numMembers: numMonths,
    discountG: parseFloat(discountG) || 0,
    companyProfitPct: currentGroup.company_profit_pct || 4,
    oldDuesG: parseFloat(oldDuesG) || 0,
    withdrawerSharePct,
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
      // And if 'hold_excess' selected, credit net silver to their deposited account as excess credit!
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

      // 4. Log in transaction_log for active ledger reflection
      await supabase.from('transaction_log').insert({
        log_date: drawDate,
        type: 'chit_settlement',
        ref_id: draw.id,
        ref_type: 'chit_draw',
        customer_id: selectedMember?.customer_id,
        customer_name: selectedMember?.customers?.name,
        voucher_ref: `CHIT-${currentGroup.name}-M${selectedRound}`,
        description: `Month ${selectedRound} Chit Draw Settlement — Withdrawer: ${selectedMember?.customers?.name} (${withdrawerSharePct}% Share) [${deliveryStatus === 'hold_excess' ? 'Held as Customer Excess Fine' : 'Physical Delivery'}]`,
        pure_in_g: deliveryStatus === 'hold_excess' ? calc.netSilverToIssueG : 0,
        pure_out_g: deliveryStatus === 'hold_excess' ? 0 : calc.netSilverToIssueG,
      })

      toast.success(lang === 'ta' ? `மாதம் ${selectedRound} சீட்டு முடிவு சேமிக்கப்பட்டது!` : `Month ${selectedRound} Chit Settlement Saved!`)

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
    window.print()
  }

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="modal modal-xl" style={{ maxWidth: 860, background: '#0b111e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 14 }}>
        {/* Modal Header */}
        <div className="modal-header" style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', padding: '16px 24px', alignItems: 'flex-start' }}>
          <div className="flex items-start gap-3">
            <div style={{ background: 'rgba(245, 158, 11, 0.15)', padding: 8, borderRadius: 8, marginTop: 2 }}>
              <Trophy size={22} style={{ color: '#f59e0b' }} />
            </div>
            <div>
              <div style={{ fontSize: '1.2rem', fontWeight: 700, color: '#f3f4f6' }}>
                {t('monthly_chit_draw_settlement', 'Monthly Chit Draw & Settlement')}
              </div>
              <div style={{ fontSize: '0.8rem', color: '#9ca3af', marginTop: 3 }}>
                {schemeBaseKg} KG Pure Silver Scheme • 4% Company Profit ({baseProfitG.toLocaleString('en-IN')} g) Deducted
              </div>
            </div>
          </div>
          <button className="btn btn-ghost btn-sm btn-icon" onClick={onClose} style={{ color: '#9ca3af' }}>
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="modal-body" style={{ padding: '24px' }}>
          {/* Top Form Row: Scheme, Round, Date */}
          <div className="grid grid-cols-3 gap-4 mb-4" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
            <div className="form-group">
              <label className="form-label" style={{ fontSize: '0.82rem', color: '#9ca3af', marginBottom: 6 }}>
                {t('select_chit_scheme', 'Select Chit Scheme:')}
              </label>
              <select
                className="form-control"
                value={selectedGroupId}
                onChange={e => setSelectedGroupId(e.target.value)}
                style={{ background: '#080d16', borderColor: '#222f46', color: '#f9fafb', height: 42, borderRadius: 8 }}
              >
                {allGroups.map(g => (
                  <option key={g.id} value={g.id}>{g.name}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label" style={{ fontSize: '0.82rem', color: '#9ca3af', marginBottom: 6 }}>
                {t('draw_month_round', 'Draw Month / Round:')}
              </label>
              <select
                className="form-control"
                value={selectedRound}
                onChange={e => setSelectedRound(Number(e.target.value))}
                style={{ background: '#080d16', borderColor: '#222f46', color: '#f9fafb', height: 42, borderRadius: 8 }}
              >
                {Array.from({ length: numMonths }, (_, i) => i + 1).map(m => (
                  <option key={m} value={m}>
                    {lang === 'ta' ? `மாதம் ${m} / ${numMonths}` : `Month ${m} of ${numMonths}`}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label" style={{ fontSize: '0.82rem', color: '#9ca3af', marginBottom: 6 }}>
                {t('settlement_date', 'Settlement Date:')}
              </label>
              <input
                type="date"
                className="form-control font-mono"
                value={drawDate}
                onChange={e => setDrawDate(e.target.value)}
                style={{ background: '#080d16', borderColor: '#222f46', color: '#f9fafb', height: 42, borderRadius: 8 }}
              />
            </div>
          </div>

          {/* Row 2: Withdrawing Member & Accepted Auction Discount */}
          <div className="grid grid-cols-2 gap-4 mb-5" style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '16px' }}>
            <div className="form-group">
              <label className="form-label" style={{ fontSize: '0.82rem', color: '#9ca3af', marginBottom: 6 }}>
                {t('withdrawing_member', 'Withdrawing Member:')} <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <select
                id="chit-withdrawer"
                className="form-control"
                value={withdrawerMemberId}
                onChange={e => setWithdrawerMemberId(e.target.value)}
                style={{ background: '#080d16', borderColor: '#222f46', color: '#f9fafb', height: 42, borderRadius: 8 }}
              >
                <option value="">Select Member</option>
                {groupMembers.map(m => (
                  <option key={m.id} value={m.id} disabled={m.is_withdrawn}>
                    Ticket #{m.ticket_no} - {m.customers?.name} ({m.share_pct || 100}% Share) {m.is_withdrawn ? '(Withdrawn)' : ''}
                  </option>
                ))}
              </select>
              <div style={{ fontSize: '0.78rem', color: '#f59e0b', marginTop: 5, fontWeight: 600 }}>
                Portion: {withdrawerSharePct}% ({shareRatio}x Share) • Capacity: {withdrawerCapKg} KG
              </div>
            </div>

            <div className="form-group">
              <label className="form-label" style={{ fontSize: '0.82rem', color: '#9ca3af', marginBottom: 6 }}>
                {t('accepted_auction_discount', 'Accepted Auction Discount (g):')}
              </label>
              <input
                id="chit-discount"
                type="number"
                step="any"
                min="0"
                className="form-control font-mono"
                value={discountG}
                onChange={e => setDiscountG(e.target.value)}
                placeholder="9000"
                style={{ background: '#080d16', borderColor: '#222f46', color: '#f9fafb', height: 42, borderRadius: 8, fontSize: '1rem', fontWeight: 700 }}
              />
            </div>
          </div>

          {/* SETTLEMENT FORMULA & AUDIT BREAKDOWN */}
          <div style={{
            background: '#070b13',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 12,
            padding: '20px 24px',
            marginBottom: 20
          }}>
            <div style={{
              fontSize: '0.78rem',
              fontWeight: 800,
              letterSpacing: '0.08em',
              color: '#d1d5db',
              textTransform: 'uppercase',
              marginBottom: 16
            }}>
              {t('settlement_formula_breakdown', 'SETTLEMENT FORMULA & AUDIT BREAKDOWN:')}
            </div>

            {/* Top row of formula: 4 metrics */}
            <div className="grid grid-cols-4 gap-4 mb-5" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
              <div>
                <div style={{ fontSize: '0.72rem', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>
                  GROSS CAPACITY
                </div>
                <div className="font-mono" style={{ fontSize: '1.15rem', fontWeight: 800, color: '#f9fafb' }}>
                  {calc.totalCapacityG.toLocaleString('en-IN')} g
                </div>
              </div>

              <div>
                <div style={{ fontSize: '0.72rem', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>
                  AUCTION DISCOUNT
                </div>
                <div className="font-mono" style={{ fontSize: '1.15rem', fontWeight: 800, color: '#f43f5e' }}>
                  - {calc.discountG.toLocaleString('en-IN')} g
                </div>
              </div>

              <div>
                <div style={{ fontSize: '0.72rem', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>
                  4% PROFIT (CO.)
                </div>
                <div className="font-mono" style={{ fontSize: '1.15rem', fontWeight: 800, color: '#f59e0b' }}>
                  {calc.companyProfitG.toLocaleString('en-IN')} g
                </div>
              </div>

              <div>
                <div style={{ fontSize: '0.72rem', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>
                  DIVIDEND / MEMBER
                </div>
                <div className="font-mono" style={{ fontSize: '1.15rem', fontWeight: 800, color: '#10b981' }}>
                  {calc.dividendPerMemberG.toLocaleString('en-IN')} g
                </div>
              </div>
            </div>

            {/* Bottom row of formula: Premium, Old Dues & Prominent Net Disburse Card */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1.3fr', gap: '16px', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: '0.72rem', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>
                  MONTHLY PREMIUM (DEMANDED)
                </div>
                <div className="font-mono" style={{ fontSize: '1.15rem', fontWeight: 800, color: '#f9fafb' }}>
                  {calc.monthlyPremiumG.toLocaleString('en-IN')} g
                </div>
                <div style={{ fontSize: '0.72rem', color: '#6b7280', marginTop: 3 }}>
                  ({Math.round(unitLimitG * shareRatio).toLocaleString('en-IN')} g - Dividend)
                </div>
              </div>

              <div>
                <div style={{ fontSize: '0.72rem', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>
                  OLD DUES DEDUCTED
                </div>
                <div className="font-mono" style={{ fontSize: '1.15rem', fontWeight: 800, color: '#f43f5e' }}>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    value={oldDuesG}
                    onChange={e => setOldDuesG(e.target.value)}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      borderBottom: '1px solid #f43f5e',
                      color: '#f43f5e',
                      width: 90,
                      fontWeight: 800,
                      fontSize: '1.15rem',
                      fontFamily: 'monospace'
                    }}
                  /> g
                </div>
              </div>

              {/* Net Silver to Disburse Card */}
              <div style={{
                background: '#15110d',
                border: '1.5px solid #854d0e',
                borderRadius: 10,
                padding: '12px 18px',
                textAlign: 'left'
              }}>
                <div style={{ fontSize: '0.72rem', color: '#f59e0b', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  NET SILVER TO DISBURSE
                </div>
                <div className="font-mono" style={{ fontSize: '1.75rem', fontWeight: 900, color: '#fbbf24', lineHeight: 1.2, marginTop: 4 }}>
                  {calc.netSilverToIssueG.toLocaleString('en-IN')} g
                </div>
                <div className="font-mono" style={{ fontSize: '0.8rem', color: '#d97706', marginTop: 2 }}>
                  {gramsToKg(calc.netSilverToIssueG)} KG
                </div>
              </div>
            </div>
          </div>

          {/* Silver Delivery Status Dropdown */}
          <div style={{
            background: '#080d16',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 10,
            padding: '14px 18px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 16
          }}>
            <div>
              <div style={{ fontSize: '0.88rem', fontWeight: 700, color: '#f3f4f6' }}>
                {t('silver_delivery_status', 'Silver Delivery Status:')}
              </div>
              <div style={{ fontSize: '0.78rem', color: '#9ca3af', marginTop: 2 }}>
                {t('silver_delivery_hint', 'If physical silver is not handed over immediately, it will reflect as Customer Excess Fine with Us.')}
              </div>
            </div>

            <select
              className="form-control"
              value={deliveryStatus}
              onChange={e => setDeliveryStatus(e.target.value)}
              style={{
                width: 340,
                background: '#0f172a',
                borderColor: '#334155',
                color: '#f8fafc',
                fontWeight: 600,
                height: 42,
                borderRadius: 8
              }}
            >
              <option value="hold_excess">Hold as Customer Excess Fine (Advance)</option>
              <option value="physical">Immediate Physical Silver Delivery</option>
            </select>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="modal-footer" style={{ borderTop: '1px solid rgba(255,255,255,0.08)', padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <button
            id="btn-print-chit-voucher"
            type="button"
            className="btn btn-ghost"
            onClick={handlePrint}
            style={{
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.1)',
              color: '#d1d5db',
              borderRadius: 8,
              padding: '10px 18px',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              fontWeight: 600
            }}
          >
            <Printer size={16} /> {t('print_voucher', 'Print Voucher')}
          </button>

          <div style={{ display: 'flex', gap: 12 }}>
            <button
              id="btn-save-chit"
              type="button"
              className="btn btn-secondary"
              onClick={() => handleSave(false)}
              disabled={saving}
              style={{
                background: '#1e293b',
                border: '1px solid #334155',
                color: '#f8fafc',
                borderRadius: 8,
                padding: '10px 22px',
                fontWeight: 700,
                cursor: saving ? 'not-allowed' : 'pointer'
              }}
            >
              {saving ? t('saving', 'Saving…') : t('save_chit_hold_excess', 'Save Chit (Hold Excess)')}
            </button>

            <button
              id="btn-chit-issue-voucher"
              type="button"
              className="btn btn-gold"
              onClick={() => handleSave(true)}
              disabled={saving}
              style={{
                background: '#f59e0b',
                color: '#000',
                border: 'none',
                borderRadius: 8,
                padding: '10px 22px',
                fontWeight: 800,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                cursor: saving ? 'not-allowed' : 'pointer'
              }}
            >
              {t('issue_voucher_btn', 'Issue Voucher')} <ArrowRight size={16} />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

