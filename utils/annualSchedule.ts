import type { SupabaseClient } from '@supabase/supabase-js'

export type AnnualScheduleRow = {
  id?: number
  date: string
  work_type: string
  event_name: string
}

const FETCH_PAGE_SIZE = 1000
const UPSERT_CHUNK_SIZE = 200

/** CSV登録・編集で使う勤務区分 */
export const WORK_TYPE_OPTIONS = ['勤務日', '休日', '祝', 'A', 'B', 'C'] as const

/** DBから返る日付を YYYY-MM-DD に統一 */
export function normalizeScheduleDate(date: string): string {
  return date.replace(/\r/g, '').trim().slice(0, 10)
}

/** CSVの日付を YYYY-MM-DD に変換 */
export function normalizeCsvDate(dateStr: string): string | null {
  const s = dateStr.replace(/\r/g, '').trim()
  if (!s) return null

  const pad = (y: string, m: string, d: string) =>
    `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`

  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s
  if (/^\d{4}\/\d{2}\/\d{2}$/.test(s)) return s.replace(/\//g, '-')

  const dashMatch = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/)
  if (dashMatch) return pad(dashMatch[1], dashMatch[2], dashMatch[3])

  const slashMatch = s.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/)
  if (slashMatch) return pad(slashMatch[1], slashMatch[2], slashMatch[3])

  return null
}

export function isWorkDayWorkType(workType: string): boolean {
  const wt = workType.trim()
  if (wt === '勤務日') return true
  const upper = wt.toUpperCase()
  return upper === 'A' || upper === 'B' || upper === 'C'
}

export function isHolidayWorkType(workType: string): boolean {
  const wt = workType.trim()
  return wt === '休' || wt === '祝' || wt === '休日' || wt === '祝日'
}

/** 一覧表示用の行背景クラス */
export function getScheduleRowClass(workType: string): string {
  if (isWorkDayWorkType(workType)) return 'bg-white'
  if (isHolidayWorkType(workType)) return 'bg-red-50'
  return 'bg-amber-50'
}

/** 勤務区分バッジの色 */
export function getWorkTypeBadgeClass(workType: string): string {
  if (isWorkDayWorkType(workType)) return 'bg-white text-gray-900 border-slate-200'
  if (isHolidayWorkType(workType)) return 'bg-red-50 text-red-700 border-red-200'
  return 'bg-amber-50 text-amber-800 border-amber-200'
}

/** 曜日テキストの色（土=青、日=赤） */
export function getWeekdayTextClass(weekday: string): string {
  if (weekday === '土') return 'text-blue-600'
  if (weekday === '日') return 'text-red-500'
  return 'text-gray-600'
}

function parseCsvLine(line: string): string[] {
  const parts: string[] = []
  let current = ''
  let inQuotes = false
  const cleaned = line.replace(/\r/g, '')

  for (let i = 0; i < cleaned.length; i++) {
    const char = cleaned[i]
    if (char === '"') {
      inQuotes = !inQuotes
    } else if (char === ',' && !inQuotes) {
      parts.push(current.trim())
      current = ''
    } else {
      current += char
    }
  }
  parts.push(current.trim())
  return parts.map((v) => v.replace(/^"|"$/g, '').trim())
}

export type ParseAnnualScheduleCsvResult = {
  records: Omit<AnnualScheduleRow, 'id'>[]
  skipped: { line: number; reason: string }[]
}

/** 年間勤務表CSVをパース（Googleスプレッドシート形式: 2026/4/1,勤務日,） */
export function parseAnnualScheduleCsv(text: string): ParseAnnualScheduleCsvResult {
  const cleaned = text.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  const lines = cleaned.split('\n').filter((line) => line.trim())
  const dataLines = lines.slice(1)

  const records: Omit<AnnualScheduleRow, 'id'>[] = []
  const skipped: { line: number; reason: string }[] = []

  dataLines.forEach((line, index) => {
    const lineNo = index + 2
    const parts = parseCsvLine(line)
    const [date, workType, eventName] = parts

    const normalizedDate = normalizeCsvDate(date ?? '')
    if (!normalizedDate) {
      skipped.push({ line: lineNo, reason: `日付が無効: ${date ?? '(空)'}` })
      return
    }

    if (!workType?.trim()) {
      skipped.push({ line: lineNo, reason: '勤務区分が空' })
      return
    }

    records.push({
      date: normalizedDate,
      work_type: workType.trim(),
      event_name: (eventName ?? '').trim(),
    })
  })

  return { records, skipped }
}

/** 分割 upsert で全件登録 */
export async function upsertAnnualSchedulesBatch(
  supabase: SupabaseClient,
  records: Omit<AnnualScheduleRow, 'id'>[],
): Promise<{ error: string | null; upserted: number }> {
  let upserted = 0

  for (let i = 0; i < records.length; i += UPSERT_CHUNK_SIZE) {
    const chunk = records.slice(i, i + UPSERT_CHUNK_SIZE)
    const { error } = await supabase
      .from('annual_schedules')
      .upsert(chunk, { onConflict: 'date' })

    if (error) {
      return { error: error.message, upserted }
    }
    upserted += chunk.length
  }

  return { error: null, upserted }
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
