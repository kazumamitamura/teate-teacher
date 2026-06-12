import type { SupabaseClient } from '@supabase/supabase-js'

export type AnnualScheduleRow = {
  id?: number
  date: string
  work_type: string
  event_name: string
}

const FETCH_PAGE_SIZE = 1000

/** DBから返る日付を YYYY-MM-DD に統一 */
export function normalizeScheduleDate(date: string): string {
  return date.slice(0, 10)
}

/** Supabaseの1,000件上限を超えても全件取得する */
export async function fetchAllAnnualSchedules(supabase: SupabaseClient): Promise<{
  data: AnnualScheduleRow[]
  totalCount: number | null
  error: string | null
}> {
  const { count, error: countError } = await supabase
    .from('annual_schedules')
    .select('*', { count: 'exact', head: true })

  if (countError) {
    return { data: [], totalCount: null, error: countError.message }
  }

  const all: AnnualScheduleRow[] = []
  let from = 0

  while (true) {
    const { data, error } = await supabase
      .from('annual_schedules')
      .select('id, date, work_type, event_name')
      .order('date', { ascending: true })
      .range(from, from + FETCH_PAGE_SIZE - 1)

    if (error) {
      return { data: [], totalCount: count, error: error.message }
    }

    const batch = (data ?? []).map((r) => ({
      id: r.id,
      date: normalizeScheduleDate(String(r.date)),
      work_type: r.work_type ?? '',
      event_name: r.event_name ?? '',
    }))

    all.push(...batch)
    if (batch.length < FETCH_PAGE_SIZE) break
    from += FETCH_PAGE_SIZE
  }

  return { data: all, totalCount: count, error: null }
}

/** CSV登録と同じ勤務区分の選択肢 */
export const WORK_TYPE_OPTIONS = ['A', 'B', 'C', '休', '祝'] as const

export function isWorkDayWorkType(workType: string): boolean {
  const wt = workType.trim().toUpperCase()
  return wt === 'A' || wt === 'B' || wt === 'C'
}

export function isHolidayWorkType(workType: string): boolean {
  const wt = workType.trim()
  return wt === '休' || wt === '祝'
}

/** 一覧表示用の行背景クラス */
export function getScheduleRowClass(workType: string): string {
  if (isWorkDayWorkType(workType)) return 'bg-white'
  if (isHolidayWorkType(workType)) return 'bg-red-50'
  return 'bg-amber-50'
}

/** 勤務区分バッジの色 */
export function getWorkTypeBadgeClass(workType: string): string {
  if (isWorkDayWorkType(workType)) return 'bg-blue-100 text-blue-800 border-blue-200'
  if (isHolidayWorkType(workType)) return 'bg-red-100 text-red-700 border-red-200'
  return 'bg-amber-100 text-amber-800 border-amber-200'
}

const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'] as const

export function formatScheduleDate(dateStr: string): { label: string; weekday: string } {
  const normalized = normalizeScheduleDate(dateStr)
  const [y, m, d] = normalized.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  return {
    label: `${y}/${String(m).padStart(2, '0')}/${String(d).padStart(2, '0')}`,
    weekday: WEEKDAYS[date.getDay()],
  }
}

export function getMonthKey(dateStr: string): string {
  return normalizeScheduleDate(dateStr).slice(0, 7)
}

export function formatMonthLabel(monthKey: string): string {
  const [y, m] = monthKey.split('-').map(Number)
  return `${y}年${m}月`
}

/** 年度（4月始まり）: 2026-04-01 〜 2027-03-31 → 2026 */
export function getFiscalYear(dateStr: string): number {
  const [y, m] = normalizeScheduleDate(dateStr).split('-').map(Number)
  return m >= 4 ? y : y - 1
}

export function formatFiscalYearLabel(fy: number): string {
  return `${fy}年度（${fy}/4〜${fy + 1}/3）`
}

export function isInFiscalYear(dateStr: string, fiscalYear: number): boolean {
  return getFiscalYear(dateStr) === fiscalYear
}

export function getDateRangeLabel(rows: AnnualScheduleRow[]): string {
  if (rows.length === 0) return '—'
  const first = formatScheduleDate(rows[0].date).label
  const last = formatScheduleDate(rows[rows.length - 1].date).label
  return `${first} 〜 ${last}`
}
