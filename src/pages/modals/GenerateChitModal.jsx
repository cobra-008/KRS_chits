import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { chitDrawsApi, vouchersApi } from '../../lib/api'
import { calcChitDraw, gramsToKg } from '../../lib/silverCalc'
import { format } from 'date-fns'
import toast from 'react-hot-toast'
import { Save, Send, X } from 'lucide-react'

export default function GenerateChitModal({ group, members, draws, onClose, onSaved, onNavigate }) {
  const [drawDate, setDrawDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [withdrawerMemberId, setWithdrawerMemberId] = useState('')
  const [discountG, setDiscountG] = useState(0)
  const [oldDuesG, setOldDuesG] = useState(0)
  const [saving, setSaving] = useState(false)

  const numMembers = members.length
  const nextMonth = group.months_happened + 1

  // Calculation
  const calc = calcChitDraw({
    numMonths: group.num_months,
    unitLimitG: group.unit_limit_g,
    numMembers: numMembers || 1,
    discountG: parseFloat(discountG) || 0,
    companyProfitPct: group.company_profit_pct || 4,
    oldDuesG: parseFloat(oldDuesG) || 0,
  })

  const selectedMember = members.find(m => m.id === withdrawerMemberId)

  const handleSave = async () => {
    if (!withdrawerMemberId) { toast.error('Select a withdrawer'); return }
    if (nextMonth > group.num_months) { toast.error('Group has completed all months'); return }

    setSaving(true)
    try {
      // 1. Save chit draw record
      const draw = await chitDrawsApi.create({
        group_id: group.id,
        month_no: nextMonth,
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
      })

      // 2. Advance group months_happened
      await supabase
        .from('groups')
        .update({ months_happened: nextMonth })
        .eq('id', group.id)

      // 3. Mark withdrawer as withdrawn, update fine_disbursed
      await supabase
        .from('group_members')
        .update({
          is_withdrawn: true,
          withdrawal_month: nextMonth,
          fine_disbursed: calc.netSilverToIssueG,
          // The net silver issued goes to their credit (excess) if not yet physically given
          fine_deposited: (parseFloat(selectedMember?.fine_deposited) || 0) + calc.monthlyPremiumG
        })
        .eq('id', withdrawerMemberId)

      // 4. Log to transaction log
      await supabase.from('transaction_log').insert({
        log_date: drawDate,
        type: 'chit_settlement',
        ref_id: draw.id,
        ref_type: 'chit_draw',
        customer_id: selectedMember?.customer_id,
        customer_name: selectedMember?.customers?.name,
        voucher_ref: `CHIT-${group.name}-M${nextMonth}`,
        description: `Month ${nextMonth} Chit Draw — Withdrawer: ${selectedMember?.customers?.name}`,
        pure_in_g: 0,
        pure_out_g: calc.netSilverToIssueG,
      })

      toast.success(`Month ${nextMonth} chit settlement saved!`)
      onSaved()
    } catch (err) {
      console.error(err)
      toast.error('Failed to save chit settlement')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="modal modal-lg">
        <div className="modal-header">
          <div>
            <div className="modal-title">Generate Chit — {group.name}</div>
            <div className="text-xs text-muted mt-1">Month {nextMonth} of {group.num_months} · {numMembers} members enrolled</div>
          </div>
          <button className="btn btn-ghost btn-sm btn-icon" onClick={onClose}><X size={16} /></button>
        </div>

        <div className="modal-body">
          <div className="form-grid form-grid-2 mb-5">
            <div className="form-group">
              <label className="form-label">Draw Date</label>
              <input type="date" className="form-control" value={drawDate} onChange={e => setDrawDate(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Month Number</label>
              <input className="form-control" readOnly value={`Month ${nextMonth}`} />
            </div>
            <div className="form-group">
              <label className="form-label">Withdrawer (Member Taking Chit)</label>
              <select
                id="chit-withdrawer"
                className="form-control"
                value={withdrawerMemberId}
                onChange={e => setWithdrawerMemberId(e.target.value)}
              >
                <option value="">— Select Member —</option>
                {members.filter(m => !m.is_withdrawn).map(m => (
                  <option key={m.id} value={m.id}>
                    #{m.ticket_no} — {m.customers?.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Discount Accepted by Withdrawer (g)</label>
              <input
                id="chit-discount"
                type="number"
                step="any"
                min="0"
                className="form-control"
                value={discountG}
                onChange={e => setDiscountG(e.target.value)}
                placeholder="0"
              />
            </div>
            <div className="form-group">
              <label className="form-label">Old Balance to Deduct from Withdrawer (g)</label>
              <input
                id="chit-old-dues"
                type="number"
                step="any"
                min="0"
                className="form-control"
                value={oldDuesG}
                onChange={e => setOldDuesG(e.target.value)}
                placeholder="0"
              />
            </div>
          </div>

          {/* Calculation breakdown */}
          <div className="card card-gold">
            <div className="card-title mb-4" style={{ color: 'var(--clr-gold)' }}>
              📊 Chit Settlement Calculation
            </div>

            {/* Top line: Group capacity */}
            <div style={{
              background: 'var(--clr-gold-bg)',
              border: '1px solid var(--clr-gold-dim)',
              borderRadius: 'var(--r-md)',
              padding: '8px 14px',
              marginBottom: 16,
              fontSize: '0.83rem',
            }}>
              <div className="flex justify-between">
                <span className="text-muted">Group Total Capacity</span>
                <span className="font-semibold text-gold">
                  {calc.totalCapacityG.toLocaleString('en-IN')} g ({gramsToKg(calc.totalCapacityG)} kg)
                </span>
              </div>
              <div className="flex justify-between mt-1">
                <span className="text-muted text-xs">{group.num_months} months × {gramsToKg(group.unit_limit_g)} kg per month</span>
              </div>
            </div>

            {/* Step-by-step */}
            <div>
              <div className="calc-row">
                <span className="text-muted">Discount Accepted by Withdrawer</span>
                <span className="font-mono">− {(parseFloat(discountG)||0).toLocaleString('en-IN')} g</span>
              </div>
              <div className="calc-row">
                <span className="text-muted">Company Profit (4%)</span>
                <span className="font-mono">− {calc.companyProfitG.toLocaleString('en-IN')} g</span>
              </div>
              <div className="calc-row">
                <span className="text-muted">Net Dividend Pool (Discount − Company Profit)</span>
                <span className="font-mono text-secondary">= {calc.netDividendPoolG.toLocaleString('en-IN')} g</span>
              </div>
              <div className="calc-row">
                <span className="text-muted">Dividend per Member (÷ {numMembers} members)</span>
                <span className="font-mono text-gold">= {calc.dividendPerMemberG.toLocaleString('en-IN', { maximumFractionDigits: 3 })} g</span>
              </div>
              <div className="divider divider-gold" style={{ margin: '8px 0' }} />

              {/* Premium box */}
              <div style={{
                background: 'var(--clr-surface-2)',
                borderRadius: 'var(--r-md)',
                padding: '10px 14px',
                marginBottom: 12,
                border: '1px solid var(--clr-border)',
              }}>
                <div className="flex justify-between items-center">
                  <span className="text-muted">This Month's Premium for All Members</span>
                  <span style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--clr-gold)' }}>
                    {calc.monthlyPremiumG.toLocaleString('en-IN', { maximumFractionDigits: 3 })} g
                  </span>
                </div>
                <div className="text-xs text-muted mt-1">
                  {gramsToKg(group.unit_limit_g)} kg − {calc.dividendPerMemberG.toFixed(3)} g dividend = {gramsToKg(calc.monthlyPremiumG)} kg
                </div>
              </div>

              {/* Withdrawer net */}
              <div className="calc-row">
                <span className="text-muted">Total Capacity</span>
                <span className="font-mono">{calc.totalCapacityG.toLocaleString('en-IN')} g</span>
              </div>
              <div className="calc-row">
                <span className="text-muted">Less: Discount</span>
                <span className="font-mono">− {calc.discountG.toLocaleString('en-IN')} g</span>
              </div>
              <div className="calc-row">
                <span className="text-muted">Less: This Month's Premium (paid by withdrawer)</span>
                <span className="font-mono">− {calc.monthlyPremiumG.toLocaleString('en-IN', { maximumFractionDigits: 3 })} g</span>
              </div>
              {calc.oldDuesG > 0 && (
                <div className="calc-row">
                  <span className="text-muted">Less: Old Balance Recovered</span>
                  <span className="font-mono">− {calc.oldDuesG.toLocaleString('en-IN')} g</span>
                </div>
              )}
              <div className="calc-row calc-row-total">
                <span>Net Silver to Issue to Withdrawer</span>
                <span className="font-mono">
                  {calc.netSilverToIssueG.toLocaleString('en-IN', { maximumFractionDigits: 3 })} g
                  &nbsp;({gramsToKg(calc.netSilverToIssueG)} kg)
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button
            id="btn-save-chit"
            className="btn btn-success btn-sm"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? <><div className="spinner" style={{ width: 13, height: 13, borderWidth: 2 }} /> Saving…</> : <><Save size={13} /> Save Chit</>}
          </button>
          <button
            id="btn-chit-issue-voucher"
            className="btn btn-maroon btn-sm"
            onClick={() => { onClose(); onNavigate('issue') }}
          >
            <Send size={13} /> Issue Voucher →
          </button>
        </div>
      </div>
    </div>
  )
}
