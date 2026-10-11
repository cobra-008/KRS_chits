import { useState, useEffect } from 'react'
import { Plus, Edit2, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { groupsApi } from '../lib/api'
import GroupFormModal from './modals/GroupFormModal'
import { gramsToKg } from '../lib/silverCalc'
import { format, parseISO } from 'date-fns'
import { useLanguage } from '../context/LanguageContext'

export default function GroupsPage() {
  const { t, lang } = useLanguage()
  const [groups, setGroups] = useState([])
  const [loading, setLoading] = useState(true)
  const [formModal, setFormModal] = useState(null) // null | 'new' | group
  const [deleteConfirm, setDeleteConfirm] = useState(null)

  const load = async () => {
    try {
      setLoading(true)
      setGroups(await groupsApi.getAll())
    } catch {
      toast.error('Failed to load groups')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const handleDelete = async (group) => {
    try {
      // Note: Supabase ON DELETE CASCADE handles related records
      const { error } = await import('../lib/supabase').then(m =>
        m.supabase.from('groups').delete().eq('id', group.id)
      )
      if (error) throw error
      toast.success('Group deleted')
      setDeleteConfirm(null)
      load()
    } catch (err) {
      toast.error('Cannot delete group with active data')
    }
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">{t('group_management')}</h1>
          <p className="page-sub">{t('group_mgmt_sub')}</p>
        </div>
        <button id="btn-new-group" className="btn btn-gold" onClick={() => setFormModal('new')}>
          <Plus /> {t('btn_new_group')}
        </button>
      </div>

      {loading ? (
        <div className="loading-overlay"><div className="spinner" /> {t('loading')}</div>
      ) : groups.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-title">{t('no_groups_created')}</div>
          <button className="btn btn-gold mt-4" onClick={() => setFormModal('new')}>
            <Plus /> {t('btn_create_first_group')}
          </button>
        </div>
      ) : (
        <>
          <div className="table-scroll-hint mb-2">{t('swipe_hint')}</div>
          <div className="table-wrap" style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
            <table style={{ minWidth: 650 }}>
              <thead>
                <tr>
                  <th>{t('th_group_name')}</th>
                  <th>{t('th_draw_day')}</th>
                  <th>{t('th_duration')}</th>
                  <th>{t('th_unit_limit')}</th>
                  <th>{t('th_capacity_member')}</th>
                  <th>{t('th_months_done')}</th>
                  <th>{t('th_start_date')}</th>
                  <th>{t('th_actions')}</th>
                </tr>
              </thead>
            <tbody>
              {groups.map(group => (
                <tr key={group.id}>
                  <td>
                    <div className="font-semibold">{group.name}</div>
                  </td>
                  <td>
                    <span className="badge badge-gold">Date {group.draw_day}</span>
                  </td>
                  <td className="text-secondary">{group.num_months} months</td>
                  <td className="font-mono">{gramsToKg(group.unit_limit_g)} kg</td>
                  <td className="font-mono text-gold font-semibold">
                    {gramsToKg(group.num_months * group.unit_limit_g)} kg
                  </td>
                  <td>
                    <div className="flex items-center gap-2">
                      <div style={{
                        flex: 1,
                        height: 6,
                        background: 'var(--clr-surface-3)',
                        borderRadius: 3,
                        overflow: 'hidden',
                        minWidth: 60,
                      }}>
                        <div style={{
                          height: '100%',
                          width: `${(group.months_happened / group.num_months) * 100}%`,
                          background: 'var(--clr-gold)',
                          borderRadius: 3,
                          transition: 'width 0.4s ease',
                        }} />
                      </div>
                      <span className="text-sm text-secondary">
                        {group.months_happened}/{group.num_months}
                      </span>
                    </div>
                  </td>
                  <td className="text-secondary text-sm">
                    {group.start_date ? format(parseISO(group.start_date), 'dd MMM yyyy') : '—'}
                  </td>
                  <td>
                    <div className="flex gap-1">
                      <button
                        className="btn btn-ghost btn-sm btn-icon"
                        onClick={() => setFormModal(group)}
                        title="Edit group"
                      >
                        <Edit2 size={12} />
                      </button>
                      <button
                        className="btn btn-maroon btn-sm btn-icon"
                        onClick={() => setDeleteConfirm(group)}
                        title="Delete group"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </>
      )}

      {/* Group Form Modal */}
      {formModal && (
        <GroupFormModal
          group={formModal === 'new' ? null : formModal}
          onClose={() => setFormModal(null)}
          onSaved={() => { setFormModal(null); load() }}
        />
      )}

      {/* Delete confirm */}
      {deleteConfirm && (
        <div className="modal-backdrop">
          <div className="modal modal-sm">
            <div className="modal-header">
              <span className="modal-title">{t('delete')}</span>
              <button className="btn btn-ghost btn-sm btn-icon" onClick={() => setDeleteConfirm(null)}>✕</button>
            </div>
            <div className="modal-body">
              <p style={{ color: 'var(--clr-text-secondary)', lineHeight: 1.6 }}>
                {lang === 'ta'
                  ? `${deleteConfirm.name} குழுவை நிச்சயமாக நீக்க வேண்டுமா? இது அனைத்து உறுப்பினர் பதிவுகளையும் நீக்கிவிடும்.`
                  : `Delete ${deleteConfirm.name}? This will also remove all member enrollments. Voucher history is preserved.`
                }
              </p>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setDeleteConfirm(null)}>{t('cancel')}</button>
              <button className="btn btn-maroon" onClick={() => handleDelete(deleteConfirm)}>{t('delete')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
