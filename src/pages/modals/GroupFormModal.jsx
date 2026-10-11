import { useState } from 'react'
import { groupsApi } from '../../lib/api'
import { X, Save } from 'lucide-react'
import toast from 'react-hot-toast'
import { format } from 'date-fns'
import { useLanguage } from '../../context/LanguageContext'

const MONTH_OPTIONS = [6, 10, 11, 12, 15, 20]
const UNIT_OPTIONS  = [
  { label: '1 kg (1,000 g)', value: 1000 },
  { label: '1.5 kg (1,500 g)', value: 1500 },
]
const DRAW_DAYS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15,
                   16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28]

export default function GroupFormModal({ group, onClose, onSaved }) {
  const { t, lang } = useLanguage()
  const isEdit = !!group
  const [saving, setSaving] = useState(false)

  const [form, setForm] = useState({
    name:         group?.name || '',
    draw_day:     group?.draw_day || 10,
    num_months:   group?.num_months || 20,
    unit_limit_g: group?.unit_limit_g || 1000,
    start_date:   group?.start_date || format(new Date(), 'yyyy-MM-dd'),
    company_profit_pct: group?.company_profit_pct || 4,
  })

  const set = (f, v) => setForm(p => ({ ...p, [f]: v }))

  const capacityPerMember = form.num_months * form.unit_limit_g

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error('Group name is required'); return }

    setSaving(true)
    try {
      if (isEdit) {
        await groupsApi.update(group.id, form)
        toast.success('Group updated')
      } else {
        await groupsApi.create({ ...form, months_happened: 0 })
        toast.success('Group created')
      }
      onSaved()
    } catch (err) {
      toast.error(err.message || 'Failed to save group')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="modal modal-md">
        <div className="modal-header">
          <span className="modal-title">{isEdit ? t('modal_edit_group') : t('modal_new_group')}</span>
          <button className="btn btn-ghost btn-sm btn-icon" onClick={onClose}><X size={16} /></button>
        </div>

        <div className="modal-body">
          <div className="form-grid form-grid-2">
            <div className="form-group" style={{ gridColumn: '1/-1' }}>
              <label className="form-label" htmlFor="grp-name">{t('group_name_req')}</label>
              <input id="grp-name" className="form-control" value={form.name} onChange={e => set('name', e.target.value)} placeholder="e.g. Date 10, Date 20" />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="grp-drawday">{t('draw_day_req')}</label>
              <select id="grp-drawday" className="form-control" value={form.draw_day} onChange={e => set('draw_day', Number(e.target.value))}>
                {DRAW_DAYS.map(d => <option key={d} value={d}>{lang === 'ta' ? `தேதி ${d}` : `Day ${d}`}</option>)}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="grp-start">{t('start_date_req')}</label>
              <input id="grp-start" type="date" className="form-control" value={form.start_date} onChange={e => set('start_date', e.target.value)} />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="grp-months">{t('num_months_req')}</label>
              <select id="grp-months" className="form-control" value={form.num_months} onChange={e => set('num_months', Number(e.target.value))}>
                {MONTH_OPTIONS.map(m => <option key={m} value={m}>{m} {lang === 'ta' ? 'மாதங்கள்' : 'months'}</option>)}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="grp-unit">{t('unit_limit_req')}</label>
              <select id="grp-unit" className="form-control" value={form.unit_limit_g} onChange={e => set('unit_limit_g', Number(e.target.value))}>
                {UNIT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="grp-profit">{t('company_profit_pct')}</label>
              <input id="grp-profit" type="number" step="0.5" min="0" max="20" className="form-control" value={form.company_profit_pct} onChange={e => set('company_profit_pct', parseFloat(e.target.value))} />
            </div>
          </div>

          {/* Capacity summary */}
          <div className="card card-gold mt-5">
            <div className="text-xs text-muted mb-2 font-semibold" style={{ textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              {t('scheme_capacity_sum')}
            </div>
            <div className="flex gap-5" style={{ flexWrap: 'wrap' }}>
              <div>
                <div className="stat-label">{t('cap_per_member_row')}</div>
                <div className="stat-value gold" style={{ fontSize: '1.2rem' }}>
                  {(capacityPerMember / 1000).toFixed(3)} kg
                </div>
                <div className="stat-sub">{capacityPerMember.toLocaleString('en-IN')} g</div>
              </div>
              <div>
                <div className="stat-label">{t('unit_limit_req')}</div>
                <div className="stat-value" style={{ fontSize: '1.2rem' }}>
                  {(form.unit_limit_g / 1000).toFixed(3)} kg
                </div>
              </div>
              <div>
                <div className="stat-label">{lang === 'ta' ? 'கடைசி மாத தவணை' : 'Last Month Premium'}</div>
                <div className="stat-value" style={{ fontSize: '1.2rem' }}>
                  {(form.unit_limit_g / 1000).toFixed(3)} kg
                </div>
                <div className="stat-sub">{lang === 'ta' ? `மாதம் ${form.num_months} எப்போதும் நிலையானது` : `Month ${form.num_months} is always fixed`}</div>
              </div>
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>{t('cancel')}</button>
          <button id="btn-save-group" className="btn btn-gold" onClick={handleSave} disabled={saving}>
            {saving ? <><div className="spinner" style={{ width: 13, height: 13, borderWidth: 2 }} /> {t('saving')}</> : <><Save size={13} /> {t('save')}</>}
          </button>
        </div>
      </div>
    </div>
  )
}
