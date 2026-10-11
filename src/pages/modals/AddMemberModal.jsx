import { useState, useEffect } from 'react'
import { customersApi, membersApi } from '../../lib/api'
import { X, Save } from 'lucide-react'
import { format } from 'date-fns'
import toast from 'react-hot-toast'
import { useLanguage } from '../../context/LanguageContext'

export default function AddMemberModal({ group, onClose, onSaved }) {
  const { t, lang } = useLanguage()
  const [customers, setCustomers] = useState([])
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    customer_id:    '',
    ticket_no:      '',
    joining_month:  1,
    joining_date:   format(new Date(), 'yyyy-MM-dd'),
    fine_deposited: 0,
  })

  useEffect(() => {
    customersApi.getAll().then(setCustomers).catch(() => toast.error('Failed to load customers'))
  }, [])

  const set = (f, v) => setForm(p => ({ ...p, [f]: v }))

  const handleSave = async () => {
    if (!form.customer_id) { toast.error('Select a customer'); return }
    if (!form.ticket_no)   { toast.error('Enter ticket number'); return }

    setSaving(true)
    try {
      await membersApi.create({
        group_id:       group.id,
        customer_id:    form.customer_id,
        ticket_no:      parseInt(form.ticket_no),
        joining_month:  parseInt(form.joining_month),
        joining_date:   form.joining_date,
        fine_deposited: parseFloat(form.fine_deposited) || 0,
      })
      toast.success('Member added to group')
      onSaved()
    } catch (err) {
      if (err.code === '23505') {
        toast.error('This customer or ticket number already exists in this group')
      } else {
        toast.error(err.message || 'Failed to add member')
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="modal modal-sm">
        <div className="modal-header">
          <span className="modal-title">{t('modal_add_member')} — {group.name}</span>
          <button className="btn btn-ghost btn-sm btn-icon" onClick={onClose}><X size={16} /></button>
        </div>
        <div className="modal-body">
          <div className="flex flex-col gap-4">
            <div className="form-group">
              <label className="form-label" htmlFor="mem-customer">{t('cust_req')}</label>
              <select id="mem-customer" className="form-control" value={form.customer_id} onChange={e => set('customer_id', e.target.value)}>
                <option value="">{t('select_customer')}</option>
                {customers.map(c => (
                  <option key={c.id} value={c.id}>{c.name} {c.phone ? `(${c.phone})` : ''}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="mem-ticket">{t('ticket_req')}</label>
              <input id="mem-ticket" type="number" min="1" className="form-control" value={form.ticket_no} onChange={e => set('ticket_no', e.target.value)} placeholder="e.g. 1" />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="mem-joining-month">{t('join_month_lbl')}</label>
              <input id="mem-joining-month" type="number" min="1" max={group.num_months} className="form-control" value={form.joining_month} onChange={e => set('joining_month', e.target.value)} />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="mem-joining-date">{t('join_date_lbl')}</label>
              <input id="mem-joining-date" type="date" className="form-control" value={form.joining_date} onChange={e => set('joining_date', e.target.value)} />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="mem-deposit">{t('opening_deposit_lbl')}</label>
              <input id="mem-deposit" type="number" step="any" min="0" className="form-control" value={form.fine_deposited} onChange={e => set('fine_deposited', e.target.value)} />
            </div>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>{t('cancel')}</button>
          <button id="btn-save-member" className="btn btn-gold" onClick={handleSave} disabled={saving}>
            {saving ? <><div className="spinner" style={{ width: 13, height: 13, borderWidth: 2 }} /> {t('saving')}</> : <><Save size={13} /> {t('modal_add_member')}</>}
          </button>
        </div>
      </div>
    </div>
  )
}
