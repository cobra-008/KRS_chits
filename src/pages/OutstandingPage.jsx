import { useState, useEffect } from 'react'
import { Search, AlertCircle } from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '../lib/supabase'
import { gramsToKg, getTotalFineDemanded } from '../lib/silverCalc'
import CustomerLedgerModal from './modals/CustomerLedgerModal'
import { useLanguage } from '../context/LanguageContext'

export default function OutstandingPage() {
  const { t, lang } = useLanguage()
  const [data, setData] = useState([])   // enriched member records
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [ledgerCustomer, setLedgerCustomer] = useState(null)

  useEffect(() => { load() }, [])

  const load = async () => {
    try {
      setLoading(true)

      // Load all group members with group + customer info + chit draws
      const { data: members, error: mErr } = await supabase
        .from('group_members')
        .select(`
          *,
          customers ( id, name, phone, photo_url ),
          groups ( id, name, num_months, unit_limit_g, months_happened )
        `)
        .order('created_at')
      if (mErr) throw mErr

      // Load all chit draws (to compute actual premiums)
      const { data: draws, error: dErr } = await supabase
        .from('chit_draws')
        .select('group_id, month_no, monthly_premium_g')
      if (dErr) throw dErr

      // Enrich each member
      const enriched = members.map(m => {
        const grp = m.groups
        const groupDraws = draws.filter(d => d.group_id === grp?.id)
        const demanded = getTotalFineDemanded(groupDraws, grp?.months_happened || 0, grp?.unit_limit_g || 0)
        const deposited = parseFloat(m.fine_deposited) || 0
        const disbursed = parseFloat(m.fine_disbursed) || 0
        const totalLiability = (grp?.num_months || 0) * (grp?.unit_limit_g || 0)
        const diff = deposited - demanded
        return { ...m, demanded, deposited, disbursed, totalLiability, diff }
      })

      setData(enriched)
    } catch (err) {
      toast.error('Failed to load outstanding data')
    } finally {
      setLoading(false)
    }
  }

  const filtered = data.filter(m =>
    m.customers?.name?.toLowerCase().includes(search.toLowerCase()) ||
    m.customers?.phone?.includes(search) ||
    m.groups?.name?.toLowerCase().includes(search.toLowerCase())
  )

  const totalDue = filtered.filter(m => m.diff < 0).reduce((s, m) => s + Math.abs(m.diff), 0)
  const totalExcess = filtered.filter(m => m.diff > 0).reduce((s, m) => s + m.diff, 0)

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">{t('outstanding_title')}</h1>
          <p className="page-sub">{t('outstanding_sub')}</p>
        </div>
      </div>

      {/* Summary */}
      <div className="stat-grid stat-grid-3 mb-5">
        <div className="stat-card">
          <div className="stat-label">{t('total_members_stat')}</div>
          <div className="stat-value">{filtered.length}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">{t('total_out_due_stat')}</div>
          <div className="stat-value red">{totalDue.toLocaleString('en-IN')} g</div>
          <div className="stat-sub">{gramsToKg(totalDue)} kg</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">{t('total_excess_stat')}</div>
          <div className="stat-value green">{totalExcess.toLocaleString('en-IN')} g</div>
          <div className="stat-sub">{gramsToKg(totalExcess)} kg</div>
        </div>
      </div>

      <div style={{ position: 'relative', marginBottom: 'var(--sp-4)' }}>
        <Search size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--clr-text-muted)' }} />
        <input
          id="outstanding-search"
          className="form-control"
          style={{ paddingLeft: 36 }}
          placeholder={t('search_outstanding_ph')}
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {loading ? (
        <div className="loading-overlay"><div className="spinner" /> {t('loading')}</div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <AlertCircle size={48} style={{ opacity: 0.3 }} />
          <div className="empty-state-title">{t('no_customers_found')}</div>
        </div>
      ) : (
        <>
          <div className="table-scroll-hint mb-2">{t('swipe_hint')}</div>
          <div className="table-wrap" style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
            <table style={{ minWidth: 680 }}>
              <thead>
                <tr>
                  <th>{t('th_customer')}</th>
                  <th>{t('th_group')}</th>
                  <th>{t('th_ticket')}</th>
                  <th>{t('th_total_scheme')}</th>
                  <th>{t('th_fine_demanded')}</th>
                  <th>{t('th_fine_deposited')}</th>
                  <th>{t('th_net_position')}</th>
                  <th>{t('th_actions')}</th>
                </tr>
              </thead>
            <tbody>
              {filtered.map(m => {
                const isOverdue = m.diff < 0
                const isExcess  = m.diff > 0
                return (
                  <tr
                    key={m.id}
                    style={{ cursor: 'pointer' }}
                    onDoubleClick={() => setLedgerCustomer(m.customers)}
                  >
                    <td>
                      <div className="flex items-center gap-2">
                        <div className="avatar" style={{ width: 28, height: 28, fontSize: '0.7rem' }}>
                          {m.customers?.photo_url
                            ? <img src={m.customers.photo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
                            : m.customers?.name?.[0]?.toUpperCase()
                          }
                        </div>
                        <div>
                          <div className="font-semibold">{m.customers?.name}</div>
                          <div className="text-xs text-muted">{m.customers?.phone}</div>
                        </div>
                      </div>
                    </td>
                    <td className="text-secondary">{m.groups?.name}</td>
                    <td><span className="badge badge-gold">#{m.ticket_no}</span></td>
                    <td className="font-mono">{m.totalLiability.toLocaleString('en-IN')} g</td>
                    <td className="font-mono">{m.demanded.toLocaleString('en-IN')} g</td>
                    <td className="font-mono">{m.deposited.toLocaleString('en-IN')} g</td>
                    <td>
                      {isOverdue ? (
                        <span className="ledger-balance">
                          {Math.abs(m.diff).toLocaleString('en-IN')} g {t('badge_due')}
                        </span>
                      ) : isExcess ? (
                        <span className="ledger-excess">
                          +{m.diff.toLocaleString('en-IN')} g {t('badge_excess')}
                        </span>
                      ) : (
                        <span className="ledger-settled">{t('badge_settled')}</span>
                      )}
                    </td>
                    <td>
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={() => setLedgerCustomer(m.customers)}
                      >
                        {t('btn_view_ledger')}
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </>
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
