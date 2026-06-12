export type AnnualScheduleRow = {
  id?: number
  date: string
  work_type: string
  event_name: string
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
  const [y, m, d] = dateStr.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  return {
    label: `${y}/${String(m).padStart(2, '0')}/${String(d).padStart(2, '0')}`,
    weekday: WEEKDAYS[date.getDay()],
  }
}

export function getMonthKey(dateStr: string): string {
  return dateStr.slice(0, 7)
}

export function formatMonthLabel(monthKey: string): string {
  const [y, m] = monthKey.split('-').map(Number)
  return `${y}年${m}月`
}
