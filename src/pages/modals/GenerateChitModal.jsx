import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { chitDrawsApi, vouchersApi } from '../../lib/api'
import { calcChitDraw, gramsToKg } from '../../lib/silverCalc'
import { format } from 'date-fns'
import toast from 'react-hot-toast'
import { Save, Send, X } from 'lucide-react'
import { useLanguage } from '../../context/LanguageContext'

export default function GenerateChitModal({ group, members, draws, onClose, onSaved, onNavigate }) {
  const { t, lang } = useLanguage()
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
            <div className="modal-title">{t('generate_chit_modal_title')} — {group.name}</div>
            <div className="text-xs text-muted mt-1">{lang === 'ta' ? `மாதம் ${nextMonth} / ${group.num_months} · ${numMembers} உறுப்பினர்கள்` : `Month ${nextMonth} of ${group.num_months} · ${numMembers} members enrolled`}</div>
          </div>
          <button className="btn btn-ghost btn-sm btn-icon" onClick={onClose}><X size={16} /></button>
        </div>

        <div className="modal-body">
          <div className="form-grid form-grid-2 mb-5">
            <div className="form-group">
              <label className="form-label">{t('draw_date_label')}</label>
              <input type="date" className="form-control" value={drawDate} onChange={e => setDrawDate(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">{t('month_number_label')}</label>
              <input className="form-control" readOnly value={`${t('month_word')} ${nextMonth}`} />
            </div>
            <div className="form-group">
              <label className="form-label">{t('withdrawer_member_label')}</label>
              <select
                id="chit-withdrawer"
                className="form-control"
                value={withdrawerMemberId}
                onChange={e => setWithdrawerMemberId(e.target.value)}
              >
                <option value="">{t('select_member_ph')}</option>
                {members.filter(m => !m.is_withdrawn).map(m => (
                  <option key={m.id} value={m.id}>
                    #{m.ticket_no} — {m.customers?.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">{t('discount_accepted_label')}</label>
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
              <label className="form-label">{t('old_dues_label')}</label>
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
              {t('chit_calc_box')}
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
                <span className="text-muted">{t('group_total_cap_row')}</span>
                <span className="font-semibold text-gold">
                  {calc.totalCapacityG.toLocaleString('en-IN')} g ({gramsToKg(calc.totalCapacityG)} kg)
                </span>
              </div>
              <div className="flex justify-between mt-1">
                <span className="text-muted text-xs">{group.num_months} {lang === 'ta' ? 'மாதங்கள்' : 'months'} × {gramsToKg(group.unit_limit_g)} kg</span>
              </div>
            </div>

            {/* Step-by-step */}
            <div>
              <div className="calc-row">
                <span className="text-muted">{t('discount_row')}</span>
                <span className="font-mono">− {(parseFloat(discountG)||0).toLocaleString('en-IN')} g</span>
              </div>
              <div className="calc-row">
                <span className="text-muted">{t('company_profit_row')}</span>
                <span className="font-mono">− {calc.companyProfitG.toLocaleString('en-IN')} g</span>
              </div>
              <div className="calc-row">
                <span className="text-muted">{t('net_div_pool_row')}</span>
                <span className="font-mono text-secondary">= {calc.netDividendPoolG.toLocaleString('en-IN')} g</span>
              </div>
              <div className="calc-row">
                <span className="text-muted">{t('div_per_member_row')} (÷ {numMembers})</span>
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
                  <span className="text-muted">{t('this_month_premium_row')}</span>
                  <span style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--clr-gold)' }}>
                    {calc.monthlyPremiumG.toLocaleString('en-IN', { maximumFractionDigits: 3 })} g
                  </span>
                </div>
                <div className="text-xs text-muted mt-1">
                  {gramsToKg(group.unit_limit_g)} kg − {calc.dividendPerMemberG.toFixed(3)} g {lang === 'ta' ? 'டிவிடெண்ட்' : 'dividend'} = {gramsToKg(calc.monthlyPremiumG)} kg
                </div>
              </div>

              {/* Withdrawer net */}
              <div className="calc-row">
                <span className="text-muted">{t('group_total_cap_row')}</span>
                <span className="font-mono">{calc.totalCapacityG.toLocaleString('en-IN')} g</span>
              </div>
              <div className="calc-row">
                <span className="text-muted">{lang === 'ta' ? 'கழிக்க: தள்ளுபடி' : 'Less: Discount'}</span>
                <span className="font-mono">− {calc.discountG.toLocaleString('en-IN')} g</span>
              </div>
              <div className="calc-row">
                <span className="text-muted">{lang === 'ta' ? 'கழிக்க: இந்த மாத தவணை' : "Less: This Month's Premium"}</span>
                <span className="font-mono">− {calc.monthlyPremiumG.toLocaleString('en-IN', { maximumFractionDigits: 3 })} g</span>
              </div>
              {calc.oldDuesG > 0 && (
                <div className="calc-row">
                  <span className="text-muted">{lang === 'ta' ? 'கழிக்க: பழைய பாக்கி' : 'Less: Old Balance Recovered'}</span>
                  <span className="font-mono">− {calc.oldDuesG.toLocaleString('en-IN')} g</span>
                </div>
              )}
              <div className="calc-row calc-row-total">
                <span>{t('net_silver_to_issue_row')}</span>
                <span className="font-mono">
                  {calc.netSilverToIssueG.toLocaleString('en-IN', { maximumFractionDigits: 3 })} g
                  &nbsp;({gramsToKg(calc.netSilverToIssueG)} kg)
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>{t('cancel')}</button>
          <button
            id="btn-save-chit"
            className="btn btn-success btn-sm"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? <><div className="spinner" style={{ width: 13, height: 13, borderWidth: 2 }} /> {t('saving')}</> : <><Save size={13} /> {t('btn_save_chit')}</>}
          </button>
          <button
            id="btn-chit-issue-voucher"
            className="btn btn-maroon btn-sm"
            onClick={() => { onClose(); onNavigate('issue') }}
          >
            <Send size={13} /> {t('nav_issue')} →
          </button>
        </div>
      </div>
    </div>
  )
}
