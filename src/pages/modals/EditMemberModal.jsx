import { useState } from 'react'
import { membersApi } from '../../lib/api'
import { X, Save } from 'lucide-react'
import toast from 'react-hot-toast'
import { useLanguage } from '../../context/LanguageContext'

export default function EditMemberModal({ member, onClose, onSaved }) {
  const { t, lang } = useLanguage()
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    ticket_no:      member.ticket_no || '',
    fine_deposited: member.fine_deposited || 0,
    joining_month:  member.joining_month || 1,
    joining_date:   member.joining_date || '',
  })

  const set = (f, v) => setForm(p => ({ ...p, [f]: v }))

  const handleSave = async () => {
    setSaving(true)
    try {
      await membersApi.update(member.id, {
        ticket_no:      parseInt(form.ticket_no),
        fine_deposited: parseFloat(form.fine_deposited) || 0,
        joining_month:  parseInt(form.joining_month),
        joining_date:   form.joining_date || null,
      })
      toast.success('Member updated')
      onSaved()
    } catch (err) {
      toast.error(err.message || 'Failed to update member')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="modal modal-sm">
        <div className="modal-header">
          <span className="modal-title">{t('modal_edit_member')} — {member.customers?.name}</span>
          <button className="btn btn-ghost btn-sm btn-icon" onClick={onClose}><X size={16} /></button>
        </div>
        <div className="modal-body">
          <div className="flex flex-col gap-4">
            <div className="form-group">
              <label className="form-label" htmlFor="edit-mem-ticket">{t('ticket_req')}</label>
              <input id="edit-mem-ticket" type="number" min="1" className="form-control" value={form.ticket_no} onChange={e => set('ticket_no', e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="edit-mem-deposit">{t('th_fine_deposited')} (g)</label>
              <input id="edit-mem-deposit" type="number" step="any" min="0" className="form-control" value={form.fine_deposited} onChange={e => set('fine_deposited', e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="edit-mem-jm">{t('join_month_lbl')}</label>
              <input id="edit-mem-jm" type="number" min="1" className="form-control" value={form.joining_month} onChange={e => set('joining_month', e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="edit-mem-jd">{t('join_date_lbl')}</label>
              <input id="edit-mem-jd" type="date" className="form-control" value={form.joining_date} onChange={e => set('joining_date', e.target.value)} />
            </div>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>{t('cancel')}</button>
          <button id="btn-update-member" className="btn btn-gold" onClick={handleSave} disabled={saving}>
            {saving ? <><div className="spinner" style={{ width: 13, height: 13, borderWidth: 2 }} /> {t('saving')}</> : <><Save size={13} /> {t('save')}</>}
          </button>
        </div>
      </div>
    </div>
  )
}
