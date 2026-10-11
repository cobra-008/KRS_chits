import { useState, useEffect } from 'react'
import { Search } from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '../lib/supabase'
import { gramsToKg } from '../lib/silverCalc'
import CustomerLedgerModal from './modals/CustomerLedgerModal'
import { useLanguage } from '../context/LanguageContext'

export default function OutstandingPage() {
  const { t, lang } = useLanguage()
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [ledgerCustomer, setLedgerCustomer] = useState(null)

  useEffect(() => { load() }, [])

  const load = async () => {
    try {
      setLoading(true)

      // 1. Fetch group members with customers and groups
      const { data: members, error: mErr } = await supabase
        .from('group_members')
        .select(`
          *,
          customers ( id, name, phone, city ),
          groups ( id, name, num_months, unit_limit_g, months_happened )
        `)
        .order('ticket_no')
      if (mErr) throw mErr

      // 2. Fetch all chit draws
      const { data: draws, error: dErr } = await supabase
        .from('chit_draws')
        .select('group_id, month_no, monthly_premium_g, dividend_per_member_g, withdrawer_share_pct')
      if (dErr) throw dErr

      // 3. Compute active calculations for each enrolled ticket
      const enriched = (members || []).map(m => {
        const grp = m.groups
        const groupDraws = (draws || []).filter(d => d.group_id === grp?.id)
        const shareRatio = (parseFloat(m.share_pct) || 100) / 100

        // Calculate base demanded for 100% share
        let baseDemanded = 0
        const monthsHappened = grp?.months_happened || 0
        for (let round = 1; round <= monthsHappened; round++) {
          const draw = groupDraws.find(d => d.month_no === round)
          if (draw) {
            let roundDemand = parseFloat(draw.monthly_premium_g) || 0
            // Normalize if withdrawer had different share
            if (draw.withdrawer_share_pct && draw.withdrawer_share_pct !== 100) {
              const div = parseFloat(draw.dividend_per_member_g) || 0
              const baseUnit = parseFloat(grp?.unit_limit_g) || 1000
              roundDemand = Math.max(0, baseUnit - div)
            }
            baseDemanded += roundDemand
          } else {
            baseDemanded += parseFloat(grp?.unit_limit_g) || 1000
          }
        }

        // Proportional demanded fine
        const demanded = Math.round(baseDemanded * shareRatio)
        const deposited = Math.round(parseFloat(m.fine_deposited) || 0)

        const balanceDue = deposited < demanded ? demanded - deposited : 0
        const excessCredit = deposited > demanded ? deposited - demanded : 0

        return {
          ...m,
          share_pct: m.share_pct || 100,
          demanded,
          deposited,
          balanceDue,
          excessCredit,
        }
      })

      setData(enriched)
    } catch (err) {
      console.error(err)
      toast.error('Failed to load outstanding data')
    } finally {
      setLoading(false)
    }
  }

  const filtered = data.filter(m =>
    m.customers?.name?.toLowerCase().includes(search.toLowerCase()) ||
    m.groups?.name?.toLowerCase().includes(search.toLowerCase()) ||
    String(m.ticket_no).includes(search)
  )

  const totalDue = filtered.reduce((s, m) => s + m.balanceDue, 0)
  const totalExcess = filtered.reduce((s, m) => s + m.excessCredit, 0)
  const totalTickets = filtered.length

  return (
    <div className="page" style={{ padding: '24px 32px' }}>
      {/* Header & Search */}
      <div className="flex items-center justify-between mb-6" style={{ flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h1 className="page-title" style={{ fontSize: '1.4rem', fontWeight: 800, color: '#f9fafb', letterSpacing: '-0.02em', margin: 0 }}>
            Outstanding Balances & Excess Register
          </h1>
          <p className="page-sub" style={{ fontSize: '0.85rem', color: '#9ca3af', marginTop: 4 }}>
            Real-time silver dues owed by customers vs excess silver held with us
          </p>
        </div>

        {/* Search Input */}
        <div style={{ position: 'relative', width: 280 }}>
          <Search size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#6b7280' }} />
          <input
            id="outstanding-search"
            type="text"
            className="form-control"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search member, ticket..."
            style={{
              paddingLeft: 36,
              background: '#090d16',
              borderColor: '#222f46',
              color: '#f9fafb',
              height: 40,
              borderRadius: 8,
              fontSize: '0.88rem'
            }}
          />
        </div>
      </div>

      {/* Top 3 Stat Cards */}
      <div className="grid grid-cols-3 gap-5 mb-6" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px' }}>
        {/* Card 1: Total Silver Due */}
        <div style={{
          background: '#0c0f1a',
          border: '1.5px solid rgba(244, 63, 94, 0.4)',
          borderRadius: 12,
          padding: '20px 24px',
        }}>
          <div style={{ fontSize: '0.82rem', color: '#9ca3af', fontWeight: 600 }}>
            Total Silver Due (Customer Owes)
          </div>
          <div className="font-mono" style={{ fontSize: '2.1rem', fontWeight: 900, color: '#f43f5e', marginTop: 6, lineHeight: 1.1 }}>
            {totalDue.toLocaleString('en-IN')} g
          </div>
          <div className="font-mono" style={{ fontSize: '0.82rem', color: '#e11d48', marginTop: 4 }}>
            {gramsToKg(totalDue)} KG
          </div>
        </div>

        {/* Card 2: Total Excess Silver */}
        <div style={{
          background: '#0c0f1a',
          border: '1.5px solid rgba(16, 185, 129, 0.4)',
          borderRadius: 12,
          padding: '20px 24px',
        }}>
          <div style={{ fontSize: '0.82rem', color: '#9ca3af', fontWeight: 600 }}>
            Total Excess Silver (Held with Us)
          </div>
          <div className="font-mono" style={{ fontSize: '2.1rem', fontWeight: 900, color: '#10b981', marginTop: 6, lineHeight: 1.1 }}>
            {totalExcess.toLocaleString('en-IN')} g
          </div>
          <div className="font-mono" style={{ fontSize: '0.82rem', color: '#059669', marginTop: 4 }}>
            {gramsToKg(totalExcess)} KG
          </div>
        </div>

        {/* Card 3: Active Enrolled Tickets */}
        <div style={{
          background: '#0c0f1a',
          border: '1.5px solid rgba(245, 158, 11, 0.4)',
          borderRadius: 12,
          padding: '20px 24px',
        }}>
          <div style={{ fontSize: '0.82rem', color: '#9ca3af', fontWeight: 600 }}>
            Active Enrolled Tickets
          </div>
          <div className="font-mono" style={{ fontSize: '2.1rem', fontWeight: 900, color: '#f59e0b', marginTop: 6, lineHeight: 1.1 }}>
            {totalTickets}
          </div>
          <div style={{ fontSize: '0.82rem', color: '#b45309', marginTop: 4 }}>
            Across ALL 20.000 KG Schemes
          </div>
        </div>
      </div>

      {/* Main Table */}
      {loading ? (
        <div className="loading-overlay" style={{ padding: 40 }}><div className="spinner" /> Loading outstanding balances…</div>
      ) : filtered.length === 0 ? (
        <div className="empty-state" style={{ padding: 40 }}>
          <div className="empty-state-title">No matching enrolled tickets found</div>
        </div>
      ) : (
        <div className="table-wrap" style={{ background: '#070b13', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, overflowX: 'auto' }}>
          <table style={{ minWidth: 920, width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', background: '#090e18' }}>
                <th style={{ padding: '14px 18px', fontSize: '0.72rem', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  TKT #
                </th>
                <th style={{ padding: '14px 18px', fontSize: '0.72rem', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  SHARE %
                </th>
                <th style={{ padding: '14px 18px', fontSize: '0.72rem', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  MEMBER NAME
                </th>
                <th style={{ padding: '14px 18px', fontSize: '0.72rem', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  SCHEME NAME
                </th>
                <th style={{ padding: '14px 18px', fontSize: '0.72rem', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  DEMANDED FINE (G)
                </th>
                <th style={{ padding: '14px 18px', fontSize: '0.72rem', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  DEPOSITED FINE (G)
                </th>
                <th style={{ padding: '14px 18px', fontSize: '0.72rem', color: '#f43f5e', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  BALANCE DUE (G)
                </th>
                <th style={{ padding: '14px 18px', fontSize: '0.72rem', color: '#10b981', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  EXCESS CREDIT (G)
                </th>
                <th style={{ padding: '14px 18px', fontSize: '0.72rem', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.06em', textAlign: 'center' }}>
                  ACTION
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(row => (
                <tr
                  key={row.id}
                  style={{
                    borderBottom: '1px solid rgba(255,255,255,0.04)',
                    transition: 'background 0.15s ease'
                  }}
                >
                  <td className="font-mono font-bold" style={{ padding: '13px 18px', color: '#f59e0b', fontSize: '0.95rem' }}>
                    {row.ticket_no}
                  </td>

                  <td className="font-mono" style={{ padding: '13px 18px', color: '#38bdf8', fontSize: '0.9rem', fontWeight: 600 }}>
                    {row.share_pct}%
                  </td>

                  <td style={{ padding: '13px 18px', color: '#f9fafb', fontWeight: 600, fontSize: '0.95rem' }}>
                    {row.customers?.name || '—'}
                  </td>

                  <td style={{ padding: '13px 18px', color: '#9ca3af', fontSize: '0.85rem' }}>
                    {row.groups?.name || '—'}
                  </td>

                  <td className="font-mono" style={{ padding: '13px 18px', color: '#d1d5db', fontSize: '0.9rem' }}>
                    {row.demanded.toLocaleString('en-IN')} g
                  </td>

                  <td className="font-mono" style={{ padding: '13px 18px', color: '#d1d5db', fontSize: '0.9rem' }}>
                    {row.deposited.toLocaleString('en-IN')} g
                  </td>

                  <td className="font-mono font-bold" style={{ padding: '13px 18px', color: row.balanceDue > 0 ? '#f43f5e' : '#6b7280', fontSize: '0.95rem' }}>
                    {row.balanceDue > 0 ? `${row.balanceDue.toLocaleString('en-IN')} g` : '—'}
                  </td>

                  <td className="font-mono font-bold" style={{ padding: '13px 18px', color: row.excessCredit > 0 ? '#10b981' : '#6b7280', fontSize: '0.95rem' }}>
                    {row.excessCredit > 0 ? `+${row.excessCredit.toLocaleString('en-IN')} g` : '—'}
                  </td>

                  <td style={{ padding: '13px 18px', textAlign: 'center' }}>
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() => setLedgerCustomer(row.customers)}
                      style={{
                        color: '#f59e0b',
                        background: 'transparent',
                        border: 'none',
                        fontSize: '0.88rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                        padding: '4px 10px'
                      }}
                    >
                      Ledger
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Customer Ledger Modal */}
      {ledgerCustomer && (
        <CustomerLedgerModal
          customer={ledgerCustomer}
          onClose={() => setLedgerCustomer(null)}
        />
      )}
    </div>
  )
}
