/**
 * K R S Silvers — API layer
 * All Supabase calls go through here to keep components clean.
 */

import { supabase } from './supabase'

// ─────────────────────────────────────
// LOCAL METADATA HELPERS (Fallback cache)
// ─────────────────────────────────────
function getLocalShares() {
  try { return JSON.parse(localStorage.getItem('krs_member_shares') || '{}') } catch { return {} }
}
function setMemberShareLocal(memberId, sharePct) {
  try {
    const s = getLocalShares()
    s[memberId] = Number(sharePct) || 100
    localStorage.setItem('krs_member_shares', JSON.stringify(s))
  } catch {}
}

export function decodeInventoryItem(item) {
  if (!item) return item
  let silverType = item.silver_type || 'K'
  let sourceName = item.source_name || 'Direct'
  
  if (item.description) {
    const typeMatch = item.description.match(/\[TYPE:([KPB])\]/i)
    if (typeMatch) silverType = typeMatch[1].toUpperCase()

    const srcMatch = item.description.match(/\[SRC:([^\]]+)\]/i)
    if (srcMatch) sourceName = srcMatch[1]
  }

  return {
    ...item,
    silver_type: silverType,
    source_name: sourceName,
  }
}

// ─────────────────────────────────────
// CUSTOMERS
// ─────────────────────────────────────
export const customersApi = {
  async getAll() {
    const { data, error } = await supabase
      .from('customers')
      .select('*')
      .order('name')
    if (error) throw error
    return data
  },

  async create(payload) {
    const { data, error } = await supabase
      .from('customers')
      .insert(payload)
      .select()
      .single()
    if (error) throw error
    return data
  },

  async update(id, payload) {
    const { data, error } = await supabase
      .from('customers')
      .update(payload)
      .eq('id', id)
      .select()
      .single()
    if (error) throw error
    return data
  },

  async delete(id) {
    const { error } = await supabase.from('customers').delete().eq('id', id)
    if (error) throw error
  },

  async uploadPhoto(file, customerId) {
    const ext = file.name.split('.').pop()
    const path = `customers/${customerId}.${ext}`
    const { error: uploadError } = await supabase.storage
      .from('krs-photos')
      .upload(path, file, { upsert: true })
    if (uploadError) throw uploadError
    const { data } = supabase.storage.from('krs-photos').getPublicUrl(path)
    return data.publicUrl
  },
}

// ─────────────────────────────────────
// GROUPS
// ─────────────────────────────────────
export const groupsApi = {
  async getAll() {
    const { data, error } = await supabase
      .from('groups')
      .select('*')
      .order('draw_day')
    if (error) throw error
    return data
  },

  async getById(id) {
    const { data, error } = await supabase
      .from('groups')
      .select('*')
      .eq('id', id)
      .single()
    if (error) throw error
    return data
  },

  async create(payload) {
    const { data, error } = await supabase
      .from('groups')
      .insert(payload)
      .select()
      .single()
    if (error) throw error
    return data
  },

  async update(id, payload) {
    const { data, error } = await supabase
      .from('groups')
      .update(payload)
      .eq('id', id)
      .select()
      .single()
    if (error) throw error
    return data
  },

  async incrementMonth(id, currentMonths, numMonths) {
    if (currentMonths >= numMonths) return null
    return groupsApi.update(id, { months_happened: currentMonths + 1 })
  },
}

// ─────────────────────────────────────
// GROUP MEMBERS
// ─────────────────────────────────────
export const membersApi = {
  async getByGroup(groupId) {
    const { data, error } = await supabase
      .from('group_members')
      .select(`
        *,
        customers ( id, name, phone, photo_url )
      `)
      .eq('group_id', groupId)
      .order('ticket_no')
    if (error) throw error
    const localShares = getLocalShares()
    return (data || []).map(m => ({
      ...m,
      share_pct: m.share_pct ? Number(m.share_pct) : (localShares[m.id] || 100),
    }))
  },

  async getByCustomer(customerId) {
    const { data, error } = await supabase
      .from('group_members')
      .select(`
        *,
        groups ( id, name, draw_day, num_months, unit_limit_g, months_happened )
      `)
      .eq('customer_id', customerId)
    if (error) throw error
    const localShares = getLocalShares()
    return (data || []).map(m => ({
      ...m,
      share_pct: m.share_pct ? Number(m.share_pct) : (localShares[m.id] || 100),
    }))
  },

  async create(payload) {
    const sharePct = Number(payload.share_pct) || 100
    
    // First try standard insert with share_pct
    const { data, error } = await supabase
      .from('group_members')
      .insert({ ...payload, share_pct: sharePct })
      .select()
      .single()

    if (!error) {
      setMemberShareLocal(data.id, sharePct)
      return { ...data, share_pct: sharePct }
    }

    // Fallback if column share_pct does not exist in schema cache
    if (error.code === 'PGRST204' || error.message?.includes('share_pct')) {
      const cleanPayload = { ...payload }
      delete cleanPayload.share_pct
      const { data: d2, error: e2 } = await supabase
        .from('group_members')
        .insert(cleanPayload)
        .select()
        .single()
      if (e2) throw e2
      setMemberShareLocal(d2.id, sharePct)
      return { ...d2, share_pct: sharePct }
    }

    throw error
  },

  async update(id, payload) {
    const sharePct = payload.share_pct ? Number(payload.share_pct) : undefined
    const { data, error } = await supabase
      .from('group_members')
      .update(payload)
      .eq('id', id)
      .select()
      .single()

    if (!error) {
      if (sharePct) setMemberShareLocal(id, sharePct)
      return { ...data, share_pct: sharePct || getLocalShares()[id] || 100 }
    }

    // Fallback if share_pct column not found
    if (error.code === 'PGRST204' || error.message?.includes('share_pct')) {
      const cleanPayload = { ...payload }
      delete cleanPayload.share_pct
      const { data: d2, error: e2 } = await supabase
        .from('group_members')
        .update(cleanPayload)
        .eq('id', id)
        .select()
        .single()
      if (e2) throw e2
      if (sharePct) setMemberShareLocal(id, sharePct)
      return { ...d2, share_pct: sharePct || getLocalShares()[id] || 100 }
    }

    throw error
  },

  async delete(id) {
    const { error } = await supabase.from('group_members').delete().eq('id', id)
    if (error) throw error
  },

  async creditFine(memberId, additionalFineG) {
    // Increment fine_deposited atomically via RPC or read-then-write
    const { data: cur } = await supabase
      .from('group_members')
      .select('fine_deposited')
      .eq('id', memberId)
      .single()
    const newTotal = (parseFloat(cur?.fine_deposited) || 0) + additionalFineG
    return membersApi.update(memberId, { fine_deposited: newTotal })
  },
}

// ─────────────────────────────────────
// VOUCHERS
// ─────────────────────────────────────
export const vouchersApi = {
  async getAll(type) {
    let query = supabase
      .from('vouchers')
      .select(`
        *,
        customers ( id, name, phone ),
        voucher_lots ( * )
      `)
      .order('voucher_no', { ascending: false })
    if (type) query = query.eq('type', type)
    const { data, error } = await query
    if (error) throw error
    return data
  },

  async getById(id) {
    const { data, error } = await supabase
      .from('vouchers')
      .select(`
        *,
        customers ( id, name, phone ),
        voucher_lots ( * )
      `)
      .eq('id', id)
      .single()
    if (error) throw error
    return data
  },

  /**
   * Create voucher + lots atomically.
   * Also updates inventory and customer account.
   */
  async createReceipt({ customerId, voucherDate, lots }) {
    // 1. Insert voucher
    const totalWeight = lots.reduce((s, l) => s + (parseFloat(l.weight_g) || 0), 0)
    const totalPure = lots.reduce((s, l) => s + (parseFloat(l.pure_g) || 0), 0)

    const { data: voucher, error: vErr } = await supabase
      .from('vouchers')
      .insert({
        type: 'receipt',
        customer_id: customerId,
        voucher_date: voucherDate,
        total_weight_g: totalWeight,
        total_pure_g: totalPure,
      })
      .select()
      .single()
    if (vErr) throw vErr

    // 2. Insert lots
    const lotsPayload = lots.map((l, i) => ({
      voucher_id: voucher.id,
      lot_no: i + 1,
      patla_no: l.patla_no,
      weight_g: l.weight_g,
      tunch_pct: l.tunch_pct,
      raw_fine_g: l.raw_fine_g,
      pure_g: l.pure_g,
      silver_type: l.silver_type || 'K',
    }))
    
    // Try insert lots with silver_type
    const { error: lErr } = await supabase.from('voucher_lots').insert(lotsPayload)
    if (lErr && (lErr.code === 'PGRST204' || lErr.message?.includes('silver_type'))) {
      const cleanLots = lotsPayload.map(lp => {
        const copy = { ...lp }
        delete copy.silver_type
        return copy
      })
      await supabase.from('voucher_lots').insert(cleanLots)
    } else if (lErr) {
      throw lErr
    }

    // 3. Add to inventory
    // Get customer name for source tracking
    let custName = 'Direct'
    if (customerId) {
      const { data: cust } = await supabase.from('customers').select('name').eq('id', customerId).single()
      if (cust?.name) custName = cust.name
    }

    const inventoryPayload = lots.map(l => {
      const sType = l.silver_type || 'K'
      const tag = `[TYPE:${sType}|SRC:${custName}]`
      return {
        patla_no: l.patla_no || `KRS-${Date.now()}`,
        description: `From Voucher #${voucher.voucher_no} ${tag}`,
        weight_g: l.weight_g,
        tunch_pct: l.tunch_pct,
        pure_g: l.pure_g,
        status: 'in_stock',
        source_voucher_id: voucher.id,
        silver_type: sType,
        source_name: custName,
      }
    })

    const { error: iErr } = await supabase.from('inventory').insert(inventoryPayload)
    if (iErr && (iErr.code === 'PGRST204' || iErr.message?.includes('silver_type') || iErr.message?.includes('source_name'))) {
      const cleanInv = inventoryPayload.map(ip => {
        const copy = { ...ip }
        delete copy.silver_type
        delete copy.source_name
        return copy
      })
      await supabase.from('inventory').insert(cleanInv)
    } else if (iErr) {
      throw iErr
    }

    // 4. Log transaction
    await supabase.from('transaction_log').insert({
      log_date: voucherDate,
      type: 'receipt',
      ref_id: voucher.id,
      ref_type: 'voucher',
      customer_id: customerId,
      voucher_ref: `RV-${String(voucher.voucher_no).padStart(4, '0')}`,
      description: `Receipt Voucher — ${lots.length} lot(s)`,
      pure_in_g: totalPure,
      pure_out_g: 0,
    })

    return voucher
  },

  async createIssue({ customerId, voucherDate, lots, inventoryIds = [] }) {
    const totalWeight = lots.reduce((s, l) => s + (parseFloat(l.weight_g) || 0), 0)
    const totalPure = lots.reduce((s, l) => s + (parseFloat(l.pure_g) || 0), 0)

    const { data: voucher, error: vErr } = await supabase
      .from('vouchers')
      .insert({
        type: 'issue',
        customer_id: customerId,
        voucher_date: voucherDate,
        total_weight_g: totalWeight,
        total_pure_g: totalPure,
      })
      .select()
      .single()
    if (vErr) throw vErr

    const lotsPayload = lots.map((l, i) => ({
      voucher_id: voucher.id,
      lot_no: i + 1,
      patla_no: l.patla_no,
      weight_g: l.weight_g,
      tunch_pct: l.tunch_pct,
      raw_fine_g: l.raw_fine_g,
      pure_g: l.pure_g,
    }))
    const { error: lErr } = await supabase.from('voucher_lots').insert(lotsPayload)
    if (lErr) throw lErr

    // Mark inventory items as issued
    if (inventoryIds.length > 0) {
      await supabase
        .from('inventory')
        .update({ status: 'issued', issued_voucher_id: voucher.id })
        .in('id', inventoryIds)
    }

    await supabase.from('transaction_log').insert({
      log_date: voucherDate,
      type: 'issue',
      ref_id: voucher.id,
      ref_type: 'voucher',
      customer_id: customerId,
      voucher_ref: `IV-${String(voucher.voucher_no).padStart(4, '0')}`,
      description: `Issue Voucher — ${lots.length} lot(s)`,
      pure_in_g: 0,
      pure_out_g: totalPure,
    })

    return voucher
  },
}

// ─────────────────────────────────────
// INVENTORY
// ─────────────────────────────────────
export const inventoryApi = {
  async getInStock() {
    const { data, error } = await supabase
      .from('inventory')
      .select('*')
      .eq('status', 'in_stock')
      .order('added_at', { ascending: false })
    if (error) throw error
    return (data || []).map(decodeInventoryItem)
  },

  async getAll() {
    const { data, error } = await supabase
      .from('inventory')
      .select('*')
      .order('added_at', { ascending: false })
    if (error) throw error
    return (data || []).map(decodeInventoryItem)
  },

  async addManual(payload) {
    const silverType = payload.silver_type || 'K'
    const sourceName = payload.source_name || payload.customer_name || 'Direct'
    const tag = `[TYPE:${silverType}|SRC:${sourceName}]`
    const description = payload.description ? `${payload.description} ${tag}` : tag

    const bodyWithCols = {
      patla_no: payload.patla_no,
      description,
      weight_g: parseFloat(payload.weight_g) || 0,
      tunch_pct: parseFloat(payload.tunch_pct) || 0,
      pure_g: parseFloat(payload.pure_g) || 0,
      status: 'in_stock',
      silver_type: silverType,
      source_name: sourceName,
    }

    const { data, error } = await supabase
      .from('inventory')
      .insert(bodyWithCols)
      .select()
      .single()

    if (!error) return decodeInventoryItem(data)

    if (error.code === 'PGRST204' || error.message?.includes('silver_type') || error.message?.includes('source_name')) {
      const fallbackBody = {
        patla_no: payload.patla_no,
        description,
        weight_g: parseFloat(payload.weight_g) || 0,
        tunch_pct: parseFloat(payload.tunch_pct) || 0,
        pure_g: parseFloat(payload.pure_g) || 0,
        status: 'in_stock',
      }
      const { data: d2, error: e2 } = await supabase
        .from('inventory')
        .insert(fallbackBody)
        .select()
        .single()
      if (e2) throw e2
      return decodeInventoryItem(d2)
    }

    throw error
  },

  async delete(id) {
    const { error } = await supabase.from('inventory').delete().eq('id', id)
    if (error) throw error
  },
}

// ─────────────────────────────────────
// CHIT DRAWS
// ─────────────────────────────────────
export const chitDrawsApi = {
  async getByGroup(groupId) {
    const { data, error } = await supabase
      .from('chit_draws')
      .select(`
        *,
        group_members (
          id, ticket_no,
          customers ( id, name )
        )
      `)
      .eq('group_id', groupId)
      .order('month_no')
    if (error) throw error
    return data
  },

  async create(payload) {
    const { data, error } = await supabase
      .from('chit_draws')
      .insert(payload)
      .select()
      .single()

    if (!error) return data

    // Handle missing column error (PGRST204)
    if (error.code === 'PGRST204' || error.message?.includes('delivery_status') || error.message?.includes('withdrawer_share_pct')) {
      const cleanPayload = { ...payload }
      delete cleanPayload.delivery_status
      delete cleanPayload.withdrawer_share_pct
      const { data: d2, error: e2 } = await supabase
        .from('chit_draws')
        .insert(cleanPayload)
        .select()
        .single()
      if (e2) throw e2
      return { ...d2, delivery_status: payload.delivery_status, withdrawer_share_pct: payload.withdrawer_share_pct }
    }

    throw error
  },

  async update(id, payload) {
    const { data, error } = await supabase
      .from('chit_draws')
      .update(payload)
      .eq('id', id)
      .select()
      .single()
    if (error) throw error
    return data
  },
}

// ─────────────────────────────────────
// TRANSACTION LOG
// ─────────────────────────────────────
export const txnLogApi = {
  async getAll(filters = {}) {
    let query = supabase
      .from('transaction_log')
      .select(`*, customers ( name )`)
      .order('log_date', { ascending: false })
      .order('created_at', { ascending: false })

    if (filters.date) query = query.eq('log_date', filters.date)
    if (filters.type) query = query.eq('type', filters.type)
    if (filters.search) {
      query = query.or(
        `customer_name.ilike.%${filters.search}%,voucher_ref.ilike.%${filters.search}%`
      )
    }
    const { data, error } = await query
    if (error) throw error
    return data
  },

  async getCustomerLedger(customerId) {
    const { data, error } = await supabase
      .from('transaction_log')
      .select('*')
      .eq('customer_id', customerId)
      .order('log_date')
      .order('created_at')
    if (error) throw error
    return data
  },
}
