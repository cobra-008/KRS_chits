/**
 * K R S Silvers — API layer
 * All Supabase calls go through here to keep components clean.
 */

import { supabase } from './supabase'

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
    return data
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
    return data
  },

  async create(payload) {
    const { data, error } = await supabase
      .from('group_members')
      .insert(payload)
      .select()
      .single()
    if (error) throw error
    return data
  },

  async update(id, payload) {
    const { data, error } = await supabase
      .from('group_members')
      .update(payload)
      .eq('id', id)
      .select()
      .single()
    if (error) throw error
    return data
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
    }))
    const { error: lErr } = await supabase.from('voucher_lots').insert(lotsPayload)
    if (lErr) throw lErr

    // 3. Add to inventory
    const inventoryPayload = lots.map(l => ({
      patla_no: l.patla_no || `KRS-${Date.now()}`,
      description: `From Voucher #${voucher.voucher_no}`,
      weight_g: l.weight_g,
      tunch_pct: l.tunch_pct,
      pure_g: l.pure_g,
      status: 'in_stock',
      source_voucher_id: voucher.id,
    }))
    const { error: iErr } = await supabase.from('inventory').insert(inventoryPayload)
    if (iErr) throw iErr

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
    return data
  },

  async getAll() {
    const { data, error } = await supabase
      .from('inventory')
      .select('*')
      .order('added_at', { ascending: false })
    if (error) throw error
    return data
  },

  async addManual(payload) {
    const { data, error } = await supabase
      .from('inventory')
      .insert({ ...payload, status: 'in_stock' })
      .select()
      .single()
    if (error) throw error
    return data
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
    if (error) throw error
    return data
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
