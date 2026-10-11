import { useState, useEffect } from 'react'
import { customersApi, membersApi, groupsApi } from '../../lib/api'
import { UserPlus, X } from 'lucide-react'
import { format } from 'date-fns'
import toast from 'react-hot-toast'
import { useLanguage } from '../../context/LanguageContext'
import { gramsToKg } from '../../lib/silverCalc'

export default function AddMemberModal({ group, onClose, onSaved }) {
  const { t, lang } = useLanguage()
  const [allGroups, setAllGroups] = useState([])
  const [selectedGroupId, setSelectedGroupId] = useState(group?.id || '')
  const [customers, setCustomers] = useState([])
  const [saving, setSaving] = useState(false)
  const [customerId, setCustomerId] = useState('')
  const [ticketNo, setTicketNo] = useState('')
  const [sharePct, setSharePct] = useState(100)
  const [joiningMonth, setJoiningMonth] = useState(1)
  const [joiningDate, setJoiningDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [existingMembersCount, setExistingMembersCount] = useState(0)

  useEffect(() => {
    Promise.all([
      groupsApi.getAll().then(res => {
        setAllGroups(res || [])
        if (!selectedGroupId && res?.length) setSelectedGroupId(res[0].id)
      }),
      customersApi.getAll().then(setCustomers),
    ]).catch(() => toast.error('Failed to load initial data'))
  }, [])

  const currentGroup = allGroups.find(g => g.id === selectedGroupId) || group || {}

  useEffect(() => {
    if (currentGroup?.id) {
      membersApi.getByGroup(currentGroup.id).then(mems => {
        setExistingMembersCount(mems?.length || 0)
        // Suggest next available ticket number
        const usedTickets = new Set((mems || []).map(m => m.ticket_no))
        let nextTicket = 1
        while (usedTickets.has(nextTicket) && nextTicket <= (currentGroup.num_months || 20)) {
          nextTicket++
        }
        setTicketNo(nextTicket)
      }).catch(() => {})
    }
  }, [currentGroup?.id])

  const totalSchemeCapKg = gramsToKg((currentGroup.num_months || 20) * (currentGroup.unit_limit_g || 1000))
  const memberCapKg = (parseFloat(totalSchemeCapKg) * (sharePct / 100)).toFixed(3)

  const portionOptions = [
    { pct: 50,  ratio: '0.5x', label: '50% Half Portion' },
    { pct: 100, ratio: '1.0x', label: '100% Full Portion' },
    { pct: 150, ratio: '1.5x', label: '150% Portion' },
    { pct: 200, ratio: '2.0x', label: '200% Double Portion' },
  ]

  const handleSave = async () => {
    if (!currentGroup?.id) { toast.error('Select a Scheme / Group'); return }
    if (!customerId)       { toast.error('Select a Customer'); return }
    if (!ticketNo)         { toast.error('Enter Ticket Number'); return }

    setSaving(true)
    try {
      await membersApi.create({
        group_id:       currentGroup.id,
        customer_id:    customerId,
        ticket_no:      parseInt(ticketNo),
        share_pct:      parseFloat(sharePct) || 100,
        joining_month:  parseInt(joiningMonth) || 1,
        joining_date:   joiningDate,
        fine_deposited: 0,
      })
      toast.success(lang === 'ta' ? 'உறுப்பினர் வெற்றிகரமாக சேர்க்கப்பட்டார்' : 'Member enrolled successfully')
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
      <div className="modal modal-md" style={{ maxWidth: 540, background: '#0e1420', border: '1px solid rgba(255,255,255,0.1)' }}>
        {/* Header */}
        <div className="modal-header" style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', padding: '16px 20px' }}>
          <div className="flex items-center gap-2">
            <UserPlus size={20} style={{ color: '#f59e0b' }} />
            <span className="modal-title" style={{ fontSize: '1.15rem', fontWeight: 700, color: '#f3f4f6' }}>
              {t('modal_add_member', 'Enroll Member in Scheme')}
            </span>
          </div>
          <button className="btn btn-ghost btn-sm btn-icon" onClick={onClose} style={{ color: '#9ca3af' }}>
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="modal-body" style={{ padding: '20px' }}>
          <div className="flex flex-col gap-4">
            {/* Select Scheme / Group */}
            <div className="form-group">
              <label className="form-label" style={{ fontSize: '0.85rem', color: '#9ca3af', marginBottom: 6 }}>
                {lang === 'ta' ? 'திட்டம் / குழுவை தேர்ந்தெடுக்கவும்:' : 'Select Scheme / Group:'} <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <select
                id="select-scheme-group"
                className="form-control"
                value={selectedGroupId}
                onChange={e => setSelectedGroupId(e.target.value)}
                style={{ background: '#090d16', borderColor: '#222f46', color: '#f9fafb', height: 44, borderRadius: 8 }}
              >
                {allGroups.map(g => (
                  <option key={g.id} value={g.id}>
                    {g.name} ({g.id === currentGroup.id ? existingMembersCount : '—'}/{g.num_months || 20} Members)
                  </option>
                ))}
              </select>
            </div>

            {/* Select Customer */}
            <div className="form-group">
              <label className="form-label" style={{ fontSize: '0.85rem', color: '#9ca3af', marginBottom: 6 }}>
                {lang === 'ta' ? 'வாடிக்கையாளரை தேர்ந்தெடுக்கவும்:' : 'Select Customer:'} <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <select
                id="select-customer"
                className="form-control"
                value={customerId}
                onChange={e => setCustomerId(e.target.value)}
                style={{ background: '#090d16', borderColor: '#222f46', color: '#f9fafb', height: 44, borderRadius: 8 }}
              >
                <option value="">{t('select_customer', 'Select Customer')}</option>
                {customers.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.name} {c.city ? `(${c.city})` : c.phone ? `(${c.phone})` : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* Ticket Number */}
            <div className="form-group">
              <label className="form-label" style={{ fontSize: '0.85rem', color: '#9ca3af', marginBottom: 6 }}>
                {lang === 'ta' ? `டிக்கெட் எண் (1 - ${currentGroup.num_months || 20}):` : `Ticket Number (1 - ${currentGroup.num_months || 20}):`} <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <input
                id="mem-ticket-no"
                type="number"
                min="1"
                max={currentGroup.num_months || 20}
                className="form-control font-mono"
                value={ticketNo}
                onChange={e => setTicketNo(e.target.value)}
                placeholder="6"
                style={{ background: '#090d16', borderColor: '#222f46', color: '#f59e0b', fontWeight: 700, height: 44, borderRadius: 8 }}
              />
            </div>

            {/* Participating Percentage / Portion Ratio */}
            <div className="form-group">
              <label className="form-label" style={{ fontSize: '0.85rem', color: '#9ca3af', marginBottom: 8 }}>
                {lang === 'ta' ? 'பங்கு சதவீதம் (%) / விகிதம்:' : 'Participating Percentage (%) / Portion Ratio:'} <span style={{ color: '#ef4444' }}>*</span>
              </label>

              {/* 4 Capsule Buttons */}
              <div className="grid grid-cols-4 gap-2 mb-2" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
                {portionOptions.map(opt => {
                  const isActive = sharePct === opt.pct
                  return (
                    <button
                      key={opt.pct}
                      type="button"
                      onClick={() => setSharePct(opt.pct)}
                      style={{
                        padding: '10px 4px',
                        borderRadius: 8,
                        fontSize: '0.88rem',
                        fontWeight: 700,
                        fontFamily: 'monospace',
                        textAlign: 'center',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                        background: isActive ? 'rgba(245, 158, 11, 0.15)' : '#121929',
                        color: isActive ? '#f59e0b' : '#9ca3af',
                        border: isActive ? '1.5px solid #f59e0b' : '1px solid rgba(255,255,255,0.08)',
                      }}
                    >
                      {opt.pct}% ({opt.ratio})
                    </button>
                  )
                })}
              </div>

              {/* Portion description display dropdown */}
              <select
                className="form-control font-mono"
                value={sharePct}
                onChange={e => setSharePct(Number(e.target.value))}
                style={{ background: '#090d16', borderColor: '#222f46', color: '#f9fafb', height: 44, borderRadius: 8, fontSize: '0.88rem', fontWeight: 600 }}
              >
                {portionOptions.map(opt => (
                  <option key={opt.pct} value={opt.pct}>
                    {opt.label} ({opt.ratio} Share - {memberCapKg} KG Scheme Capacity)
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="modal-footer" style={{ borderTop: '1px solid rgba(255,255,255,0.08)', padding: '14px 20px', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
          <button
            className="btn btn-ghost"
            onClick={onClose}
            style={{ color: '#9ca3af', background: 'transparent', border: 'none', padding: '8px 18px' }}
          >
            {t('cancel', 'Cancel')}
          </button>
          <button
            id="btn-save-member"
            className="btn btn-gold"
            onClick={handleSave}
            disabled={saving}
            style={{
              background: '#f59e0b',
              color: '#000',
              fontWeight: 700,
              padding: '10px 24px',
              borderRadius: 8,
              border: 'none',
              cursor: saving ? 'not-allowed' : 'pointer'
            }}
          >
            {saving ? (
              <span className="flex items-center gap-2">
                <div className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} /> {t('saving', 'Saving…')}
              </span>
            ) : (
              t('save_member', 'Save Member')
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

