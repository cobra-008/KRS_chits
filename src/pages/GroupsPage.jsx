import { useState, useEffect } from 'react'
import { Plus, Edit2, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { groupsApi } from '../lib/api'
import GroupFormModal from './modals/GroupFormModal'
import { gramsToKg } from '../lib/silverCalc'
import { format, parseISO } from 'date-fns'

export default function GroupsPage() {
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
          <h1 className="page-title">Group Management</h1>
          <p className="page-sub">Silver chit schemes · Create and manage groups</p>
        </div>
        <button id="btn-new-group" className="btn btn-gold" onClick={() => setFormModal('new')}>
          <Plus /> Create Group
        </button>
      </div>

      {loading ? (
        <div className="loading-overlay"><div className="spinner" /> Loading…</div>
      ) : groups.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-title">No groups created yet</div>
          <button className="btn btn-gold mt-4" onClick={() => setFormModal('new')}>
            <Plus /> Create First Group
          </button>
        </div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Group Name</th>
                <th>Draw Day</th>
                <th>Duration</th>
                <th>Unit Limit</th>
                <th>Capacity / Member</th>
                <th>Months Done</th>
                <th>Start Date</th>
                <th>Actions</th>
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
              <span className="modal-title">Delete Group</span>
              <button className="btn btn-ghost btn-sm btn-icon" onClick={() => setDeleteConfirm(null)}>✕</button>
            </div>
            <div className="modal-body">
              <p style={{ color: 'var(--clr-text-secondary)', lineHeight: 1.6 }}>
                Delete <strong style={{ color: 'var(--clr-text-primary)' }}>{deleteConfirm.name}</strong>?
                This will also remove all member enrollments.
                Voucher history is preserved.
              </p>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setDeleteConfirm(null)}>Cancel</button>
              <button className="btn btn-maroon" onClick={() => handleDelete(deleteConfirm)}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
