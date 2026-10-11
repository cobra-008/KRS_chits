import { useState, useEffect, useCallback } from 'react'
import { FileText, Send, Users, ChevronDown, ChevronRight, Plus, Minus, Edit2, Trash2 } from 'lucide-react'
import { groupsApi, membersApi, chitDrawsApi } from '../lib/api'
import { getTotalFineDemanded, gramsToKg, formatGrams } from '../lib/silverCalc'
import { format, parseISO } from 'date-fns'
import toast from 'react-hot-toast'
import AddMemberModal from './modals/AddMemberModal'
import EditMemberModal from './modals/EditMemberModal'
import GenerateChitModal from './modals/GenerateChitModal'
import CustomerLedgerModal from './modals/CustomerLedgerModal'
import { useLanguage } from '../context/LanguageContext'

export default function HomePage({ onNavigate }) {
  const { t } = useLanguage()
  const [groups, setGroups] = useState([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState({})
  const [members, setMembers] = useState({})         // groupId → members[]
  const [draws, setDraws] = useState({})             // groupId → draws[]
  const [loadingMembers, setLoadingMembers] = useState({})

  // Modals
  const [addMemberModal, setAddMemberModal] = useState(null)  // groupId
  const [editMemberModal, setEditMemberModal] = useState(null) // member obj
  const [removeMemberConfirm, setRemoveMemberConfirm] = useState(null) // member obj
  const [chitModal, setChitModal] = useState(null)            // group obj
  const [ledgerCustomer, setLedgerCustomer] = useState(null)  // customer obj

  const loadGroups = useCallback(async () => {
    try {
      setLoading(true)
      const data = await groupsApi.getAll()
      setGroups(data)
    } catch (err) {
      toast.error('Failed to load groups')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadGroups() }, [loadGroups])

  const toggleGroup = async (groupId) => {
    const isOpen = expanded[groupId]
    setExpanded(p => ({ ...p, [groupId]: !isOpen }))

    if (!isOpen && !members[groupId]) {
      setLoadingMembers(p => ({ ...p, [groupId]: true }))
      try {
        const [mData, dData] = await Promise.all([
          membersApi.getByGroup(groupId),
          chitDrawsApi.getByGroup(groupId),
        ])
        setMembers(p => ({ ...p, [groupId]: mData }))
        setDraws(p => ({ ...p, [groupId]: dData }))
      } catch {
        toast.error('Failed to load group members')
      } finally {
        setLoadingMembers(p => ({ ...p, [groupId]: false }))
      }
    }
  }

  const refreshGroup = async (groupId) => {
    const [mData, dData] = await Promise.all([
      membersApi.getByGroup(groupId),
      chitDrawsApi.getByGroup(groupId),
    ])
    setMembers(p => ({ ...p, [groupId]: mData }))
    setDraws(p => ({ ...p, [groupId]: dData }))
  }

  const handleIncrementMonth = async (group) => {
    if (group.months_happened >= group.num_months) {
      toast.error('Group has completed all months')
      return
    }
    try {
      await groupsApi.incrementMonth(group.id, group.months_happened, group.num_months)
      toast.success(`Month ${group.months_happened + 1} recorded`)
      loadGroups()
      // refresh members if open
      if (expanded[group.id]) refreshGroup(group.id)
    } catch {
      toast.error('Failed to update month')
    }
  }

  const handleRemoveMember = async (member) => {
    try {
      await membersApi.delete(member.id)
      toast.success('Member removed')
      setRemoveMemberConfirm(null)
      refreshGroup(member.group_id)
    } catch {
      toast.error('Failed to remove member')
    }
  }

  const getMemberStatus = (member, group, groupDraws) => {
    const demanded = getTotalFineDemanded(
      groupDraws || [],
      group.months_happened,
      group.unit_limit_g
    )
    const deposited = parseFloat(member.fine_deposited) || 0
    const diff = deposited - demanded
    return { demanded, deposited, diff }
  }

  return (
    <div className="page">
      {/* Quick Actions */}
      <div className="quick-btn-row">
        <button
          id="btn-quick-receipt"
          className="btn btn-gold btn-sm"
          onClick={() => onNavigate('receipt')}
        >
          <FileText /> {t('quick_receipt', 'Receipt Voucher')}
        </button>
        <button
          id="btn-quick-issue"
          className="btn btn-ghost btn-sm"
          onClick={() => onNavigate('issue')}
        >
          <Send /> {t('quick_issue', 'Issue Voucher')}
        </button>
        <button
          id="btn-quick-customers"
          className="btn btn-ghost btn-sm"
          onClick={() => onNavigate('customers')}
        >
          <Users /> {t('quick_customers', 'Customers')}
        </button>
      </div>

      {/* Groups */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="page-title">{t('active_groups', 'Active Groups')}</h2>
          <p className="page-sub">{t('active_groups_sub', 'Silver chit schemes — click to view members')}</p>
        </div>
        <button
          id="btn-create-group"
          className="btn btn-ghost btn-sm"
          onClick={() => onNavigate('groups')}
        >
          <Plus /> {t('new_group', 'New Group')}
        </button>
      </div>

      {loading ? (
        <div className="loading-overlay"><div className="spinner" /> {t('loading', 'Loading groups…')}</div>
      ) : groups.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-title">{t('no_groups', 'No groups yet')}</div>
          <div className="empty-state-sub">{t('create_first_group', 'Create your first silver chit scheme')}</div>
          <button className="btn btn-gold mt-4" onClick={() => onNavigate('groups')}>
            <Plus /> {t('create_group_btn', 'Create Group')}
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {groups.map(group => {
            const isOpen = !!expanded[group.id]
            const groupMembers = members[group.id] || []
            const groupDraws = draws[group.id] || []
            const latestDraw = [...groupDraws].sort((a, b) => b.month_no - a.month_no)[0]

            return (
              <div key={group.id} className="group-card">
                {/* Group header row */}
                <div className="group-card-header" onClick={() => toggleGroup(group.id)}>
                  <div className="group-badge">{group.draw_day || '?'}</div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold" style={{ fontSize: '0.95rem' }}>
                        {group.name}
                      </span>
                      <span className="badge badge-gold">
                        {group.months_happened}/{group.num_months} {t('month_word', 'Months')}
                      </span>
                    </div>
                    <div className="flex gap-3 mt-1 text-xs text-muted">
                      <span>{group.num_months} {t('month_scheme', 'month scheme')}</span>
                      <span>·</span>
                      <span>{gramsToKg(group.unit_limit_g)} {t('kg_per_month', 'kg/month')}</span>
                      <span>·</span>
                      <span>{t('capacity_prefix', 'Capacity:')} {gramsToKg(group.num_months * group.unit_limit_g)} {t('kg_per_member', 'kg/member')}</span>
                    </div>
                  </div>

                  <div className="group-card-actions" onClick={e => e.stopPropagation()}>
                    {/* Members count */}
                    <span className="badge badge-gray">
                      {groupMembers.length > 0 ? `${groupMembers.length}` : '0'} {t('members_count', 'members')}
                    </span>

                    {/* +Month button */}
                    <button
                      id={`btn-incr-month-${group.id}`}
                      className="btn btn-ghost btn-sm"
                      title="Record next month"
                      onClick={() => handleIncrementMonth(group)}
                    >
                      <Plus /> {t('btn_plus_month', 'Month')}
                    </button>

                    {/* Generate Chit */}
                    <button
                      id={`btn-gen-chit-${group.id}`}
                      className="btn btn-gold btn-sm"
                      onClick={() => setChitModal(group)}
                    >
                      {t('btn_gen_chit', 'Generate Chit')}
                    </button>

                    <ChevronDown
                      className={`accordion-chevron ${isOpen ? 'open' : ''}`}
                      size={16}
                    />
                  </div>
                </div>

                {/* Expanded member list */}
                {isOpen && (
                  <div style={{
                    borderTop: '1px solid var(--clr-border-soft)',
                    animation: 'fadeIn 0.2s ease',
                  }}>
                    {/* Draw history summary */}
                    {latestDraw && (
                      <div style={{
                        background: 'var(--clr-gold-bg)',
                        borderBottom: '1px solid var(--clr-border-soft)',
                        padding: '8px 20px',
                        fontSize: '0.78rem',
                        color: 'var(--clr-gold)',
                        display: 'flex',
                        gap: '16px',
                        flexWrap: 'wrap',
                      }}>
                        <span>
                          {t('last_draw', 'Last Draw:')} {t('month_word', 'Month')} {latestDraw.month_no} — {format(parseISO(latestDraw.draw_date), 'dd MMM yyyy')}
                        </span>
                        <span>·</span>
                        <span>
                          {t('withdrawer_prefix', 'Withdrawer:')} {latestDraw.group_members?.customers?.name || '—'}
                        </span>
                        <span>·</span>
                        <span>
                          {t('premium_prefix', 'Premium:')} {formatGrams(latestDraw.monthly_premium_g)}
                        </span>
                        <span>·</span>
                        <span>
                          {t('net_issued_prefix', 'Net Issued:')} {formatGrams(latestDraw.net_silver_to_issue_g)}
                        </span>
                      </div>
                    )}

                    {/* Member table header */}
                    <div className="flex items-center justify-between" style={{ padding: '10px 20px' }}>
                      <span className="text-xs text-muted font-semibold" style={{ textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                        {t('members_heading', 'Members')} ({groupMembers.length})
                      </span>
                      <button
                        id={`btn-add-member-${group.id}`}
                        className="btn btn-ghost btn-sm"
                        onClick={() => setAddMemberModal(group)}
                      >
                        <Plus /> {t('btn_add_member', 'Add Member')}
                      </button>
                    </div>

                    {loadingMembers[group.id] ? (
                      <div className="loading-overlay" style={{ padding: '20px' }}>
                        <div className="spinner" /> {t('loading_members', 'Loading members…')}
                      </div>
                    ) : groupMembers.length === 0 ? (
                      <div className="empty-state" style={{ padding: '24px' }}>
                        <div className="empty-state-title">{t('no_members_enrolled', 'No members enrolled')}</div>
                      </div>
                    ) : (
                      <>
                        <div className="table-wrap" style={{ borderRadius: 0, border: 'none', overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
                          <table style={{ minWidth: 620 }}>
                            <thead>
                              <tr>
                                <th style={{ width: 70 }}>{t('th_ticket', 'Ticket')}</th>
                                <th style={{ minWidth: 140 }}>{t('th_member', 'Member')}</th>
                                <th style={{ minWidth: 100 }}>{t('th_phone', 'Phone')}</th>
                                <th style={{ minWidth: 110 }}>{t('th_months_paid', 'Months Paid')}</th>
                                <th style={{ minWidth: 110 }}>{t('th_fine_deposited', 'Fine Deposited')}</th>
                                <th style={{ minWidth: 110 }}>{t('th_fine_demanded', 'Fine Demanded')}</th>
                                <th style={{ minWidth: 95 }}>{t('th_status', 'Status')}</th>
                                <th style={{ minWidth: 80 }}>{t('th_actions', 'Actions')}</th>
                              </tr>
                            </thead>
                            <tbody>
                              {groupMembers.map(member => {
                                const { demanded, deposited, diff } = getMemberStatus(member, group, groupDraws)
                                const isOverdue = diff < 0
                                const isExcess  = diff > 0
                                const isSettled = diff === 0

                                return (
                                  <tr
                                    key={member.id}
                                    style={{ cursor: 'pointer' }}
                                    onDoubleClick={() => setLedgerCustomer(member.customers)}
                                    title="Double-click to view full ledger"
                                  >
                                    <td>
                                      <span className="badge badge-gold">#{member.ticket_no}</span>
                                    </td>
                                    <td>
                                      <div className="flex items-center gap-2">
                                        <div className="avatar" style={{ width: 28, height: 28, fontSize: '0.7rem' }}>
                                          {member.customers?.photo_url
                                            ? <img src={member.customers.photo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
                                            : member.customers?.name?.[0]?.toUpperCase()
                                          }
                                        </div>
                                        <span className="font-semibold">{member.customers?.name}</span>
                                        {member.is_withdrawn && (
                                          <span className="badge badge-maroon" style={{ fontSize: '0.65rem' }}>{t('badge_withdrawn', 'Withdrawn')}</span>
                                        )}
                                      </div>
                                    </td>
                                    <td className="text-secondary">{member.customers?.phone || '—'}</td>
                                    <td>
                                      <span className={isOverdue ? 'text-danger font-semibold' : 'text-secondary'}>
                                        {group.months_happened} {t('happened_suffix', 'happened')}
                                      </span>
                                    </td>
                                    <td className="font-mono">
                                      {formatGrams(deposited)}
                                    </td>
                                    <td className="font-mono">
                                      {formatGrams(demanded)}
                                    </td>
                                    <td>
                                      {isOverdue ? (
                                        <span className="badge badge-red">
                                          {formatGrams(Math.abs(diff))} {t('badge_due', 'Due')}
                                        </span>
                                      ) : isExcess ? (
                                        <span className="badge badge-green">
                                          +{formatGrams(diff)} {t('badge_excess', 'Excess')}
                                        </span>
                                      ) : (
                                        <span className="badge badge-gray">{t('badge_settled', 'Settled')}</span>
                                      )}
                                    </td>
                                    <td>
                                      <div className="flex gap-1">
                                        <button
                                          className="btn btn-ghost btn-sm btn-icon"
                                          title="Edit member"
                                          onClick={(e) => { e.stopPropagation(); setEditMemberModal(member) }}
                                        >
                                        <Edit2 size={12} />
                                      </button>
                                      <button
                                        className="btn btn-maroon btn-sm btn-icon"
                                        title="Remove member"
                                        onClick={(e) => { e.stopPropagation(); setRemoveMemberConfirm(member) }}
                                      >
                                        <Trash2 size={12} />
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* ── Modals ── */}
      {addMemberModal && (
        <AddMemberModal
          group={addMemberModal}
          onClose={() => setAddMemberModal(null)}
          onSaved={() => {
            setAddMemberModal(null)
            refreshGroup(addMemberModal.id)
          }}
        />
      )}

      {editMemberModal && (
        <EditMemberModal
          member={editMemberModal}
          onClose={() => setEditMemberModal(null)}
          onSaved={() => {
            const gid = editMemberModal.group_id
            setEditMemberModal(null)
            refreshGroup(gid)
          }}
        />
      )}

      {removeMemberConfirm && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal modal-sm">
            <div className="modal-header">
              <span className="modal-title">Remove Member</span>
              <button className="btn btn-ghost btn-sm btn-icon" onClick={() => setRemoveMemberConfirm(null)}>✕</button>
            </div>
            <div className="modal-body">
              <p style={{ color: 'var(--clr-text-secondary)', lineHeight: 1.6 }}>
                Are you sure you want to remove <strong style={{ color: 'var(--clr-text-primary)' }}>
                {removeMemberConfirm.customers?.name}</strong> from this group?
                Their voucher history will be preserved.
              </p>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setRemoveMemberConfirm(null)}>Cancel</button>
              <button className="btn btn-maroon" onClick={() => handleRemoveMember(removeMemberConfirm)}>
                Remove Member
              </button>
            </div>
          </div>
        </div>
      )}

      {chitModal && (
        <GenerateChitModal
          group={chitModal}
          members={members[chitModal.id] || []}
          draws={draws[chitModal.id] || []}
          onClose={() => setChitModal(null)}
          onSaved={() => {
            setChitModal(null)
            loadGroups()
            refreshGroup(chitModal.id)
          }}
          onNavigate={onNavigate}
        />
      )}

      {ledgerCustomer && (
        <CustomerLedgerModal
          customer={ledgerCustomer}
          onClose={() => setLedgerCustomer(null)}
        />
      )}
    </div>
  )
}
