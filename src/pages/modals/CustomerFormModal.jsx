import { useState, useRef } from 'react'
import { customersApi } from '../../lib/api'
import { Camera, X, Save } from 'lucide-react'
import toast from 'react-hot-toast'
import { useLanguage } from '../../context/LanguageContext'

export default function CustomerFormModal({ customer, onClose, onSaved }) {
  const { t, lang } = useLanguage()
  const isEdit = !!customer
  const [saving, setSaving] = useState(false)
  const [photoPreview, setPhotoPreview] = useState(customer?.photo_url || null)
  const [photoFile, setPhotoFile] = useState(null)
  const fileRef = useRef(null)

  const [form, setForm] = useState({
    name:      customer?.name || '',
    phone:     customer?.phone || '',
    whatsapp:  customer?.whatsapp || '',
    address:   customer?.address || '',
    city:      customer?.city || '',
    pincode:   customer?.pincode || '',
    id_proof:  customer?.id_proof || '',
  })

  const set = (field, value) => setForm(p => ({ ...p, [field]: value }))

  const handlePhoto = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setPhotoFile(file)
    setPhotoPreview(URL.createObjectURL(file))
  }

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error('Customer name is required'); return }

    setSaving(true)
    try {
      let photoUrl = customer?.photo_url || null

      if (isEdit) {
        const updated = await customersApi.update(customer.id, { ...form, photo_url: photoUrl })
        if (photoFile) {
          photoUrl = await customersApi.uploadPhoto(photoFile, updated.id)
          await customersApi.update(updated.id, { photo_url: photoUrl })
        }
        toast.success('Customer updated')
      } else {
        const created = await customersApi.create({ ...form, photo_url: null })
        if (photoFile) {
          photoUrl = await customersApi.uploadPhoto(photoFile, created.id)
          await customersApi.update(created.id, { photo_url: photoUrl })
        }
        toast.success('Customer added')
      }
      onSaved()
    } catch (err) {
      console.error(err)
      toast.error(err.message || 'Failed to save customer')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="modal modal-md">
        <div className="modal-header">
          <span className="modal-title">{isEdit ? t('modal_edit_cust') : t('modal_new_cust')}</span>
          <button className="btn btn-ghost btn-sm btn-icon" onClick={onClose}><X size={16} /></button>
        </div>
        <div className="modal-body">

          {/* Photo */}
          <div className="flex items-center gap-4 mb-5">
            <div
              className="avatar avatar-lg"
              style={{ cursor: 'pointer', flexShrink: 0, overflow: 'hidden' }}
              onClick={() => fileRef.current?.click()}
              title="Click to upload photo"
            >
              {photoPreview
                ? <img src={photoPreview} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
                : <Camera size={24} style={{ opacity: 0.5 }} />
              }
            </div>
            <div>
              <button className="btn btn-ghost btn-sm" onClick={() => fileRef.current?.click()}>
                <Camera size={13} /> {t('upload_photo')}
              </button>
              <div className="text-xs text-muted mt-1">JPG, PNG up to 5MB</div>
              <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handlePhoto} />
            </div>
          </div>

          <div className="form-grid form-grid-2">
            <div className="form-group" style={{ gridColumn: '1/-1' }}>
              <label className="form-label" htmlFor="cust-name">{t('full_name_req')}</label>
              <input id="cust-name" className="form-control" value={form.name} onChange={e => set('name', e.target.value)} placeholder={t('customer_name')} />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="cust-phone">{t('phone_label')}</label>
              <input id="cust-phone" className="form-control" value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="Primary phone" />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="cust-wa">{t('whatsapp_label')}</label>
              <input id="cust-wa" className="form-control" value={form.whatsapp} onChange={e => set('whatsapp', e.target.value)} placeholder="WhatsApp number" />
            </div>

            <div className="form-group" style={{ gridColumn: '1/-1' }}>
              <label className="form-label" htmlFor="cust-address">{t('address_label')}</label>
              <textarea id="cust-address" className="form-control" rows={2} value={form.address} onChange={e => set('address', e.target.value)} placeholder="Street address" />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="cust-city">{t('city_label')}</label>
              <input id="cust-city" className="form-control" value={form.city} onChange={e => set('city', e.target.value)} placeholder="City" />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="cust-pin">{t('pincode_label')}</label>
              <input id="cust-pin" className="form-control" value={form.pincode} onChange={e => set('pincode', e.target.value)} placeholder="PIN code" />
            </div>

            <div className="form-group" style={{ gridColumn: '1/-1' }}>
              <label className="form-label" htmlFor="cust-id">{t('id_proof_label')}</label>
              <input id="cust-id" className="form-control" value={form.id_proof} onChange={e => set('id_proof', e.target.value)} placeholder="Aadhaar / PAN" />
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>{t('cancel')}</button>
          <button id="btn-save-customer" className="btn btn-gold" onClick={handleSave} disabled={saving}>
            {saving ? <><div className="spinner" style={{ width: 13, height: 13, borderWidth: 2 }} /> {t('saving')}</> : <><Save size={13} /> {t('save')}</>}
          </button>
        </div>
      </div>
    </div>
  )
}
