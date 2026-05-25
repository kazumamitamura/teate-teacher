import type { SupabaseClient } from '@supabase/supabase-js'

export type UserOption = {
  user_id: string
  email: string
  display_name: string
}

export type AllowanceRecord = {
  id: number
  user_id: string
  user_email: string
  date: string
  activity_type: string
  amount: number
  destination_type: string | null
  destination_detail: string | null
  is_driving: boolean
  is_accommodation: boolean
  user_profiles?: { user_id?: string; display_name?: string } | null
}

export function getMonthDateRange(year: number, month: number) {
  const yearMonth = `${year}-${String(month).padStart(2, '0')}`
  const lastDay = new Date(year, month, 0).getDate()
  return {
    yearMonth,
    start: `${yearMonth}-01`,
    end: `${yearMonth}-${String(lastDay).padStart(2, '0')}`,
  }
}

export async function fetchUserOptions(supabase: SupabaseClient): Promise<UserOption[]> {
  const { data, error } = await supabase
    .from('user_profiles')
    .select('user_id, email, display_name')
    .order('display_name')
  if (error) {
    console.error('fetchUserOptions:', error)
    return []
  }
  return (data ?? []).filter((u): u is UserOption => !!u.user_id)
}

export async function fetchAllowancesForPeriod(
  supabase: SupabaseClient,
  opts: { year: number; month: number; userId?: string }
): Promise<AllowanceRecord[]> {
  const { start, end } = getMonthDateRange(opts.year, opts.month)

  const buildQuery = (withJoin: boolean) => {
    let q = supabase
      .from('allowances')
      .select(
        withJoin
          ? `*, user_profiles ( user_id, display_name )`
          : '*'
      )
      .gte('date', start)
      .lte('date', end)
    if (opts.userId) q = q.eq('user_id', opts.userId)
    return q.order('date', { ascending: true })
  }

  let res = await buildQuery(true)
  if (
    res.error &&
    (res.error.message?.includes('foreign key') ||
      res.error.code === 'PGRST301' ||
      res.error.code === '42P01')
  ) {
    res = await buildQuery(false)
  }

  if (res.error) throw new Error(res.error.message)
  return (res.data as AllowanceRecord[]) ?? []
}
