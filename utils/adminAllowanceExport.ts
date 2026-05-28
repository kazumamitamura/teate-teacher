import * as XLSX from 'xlsx'
import type { SupabaseClient } from '@supabase/supabase-js'
import { getMonthDateRange, type UserOption } from './adminAllowanceData'
import { formatAllowanceForAdmin } from './adminAllowanceDisplay'

type AllowanceRow = {
  date?: string
  activity_type?: string
  amount?: number | null
  destination_detail?: string | null
  destination_type?: string | null
  is_accommodation?: boolean
  is_driving?: boolean
  user_email?: string | null
}

function dayOfWeek(dateStr: string) {
  if (!dateStr) return ''
  const days = ['日', '月', '火', '水', '木', '金', '土']
  const d = new Date(dateStr)
  return isNaN(d.getTime()) ? '' : days[d.getDay()]
}

function findUser(users: UserOption[], userId: string) {
  return users.find((u) => u.user_id === userId || u.email === userId)
}

export async function exportIndividualMonthly(
  supabase: SupabaseClient,
  users: UserOption[],
  selectedUserId: string,
  year: number,
  month: number
) {
  const { yearMonth, start, end } = getMonthDateRange(year, month)
  const { data: allowances, error } = await supabase
    .from('allowances')
    .select('*')
    .eq('user_id', selectedUserId)
    .gte('date', start)
    .lte('date', end)
    .order('date', { ascending: true })

  if (error) throw new Error(error.message)

  const user = findUser(users, selectedUserId)
  const userName = user?.display_name || user?.email || 'unknown'
  const rows = (allowances as AllowanceRow[]) ?? []
  const total = rows.reduce((s, r) => s + (r.amount ?? 0), 0)
  const campCount = rows.filter((a) => a.activity_type?.includes('合宿')).length
  const expeditionCount = rows.filter((a) => a.activity_type?.includes('遠征')).length

  const headerRows = [
    ['氏名', `${userName} 様`, '支給合計額', total],
    ['対象月', `${year}年${month}月`, '活動内訳', `合宿:${campCount}日 / 遠征:${expeditionCount}日`],
    [],
    ['日付', '曜日', '手当区分', '行き先', '宿泊', '運転', '金額'],
  ]
  const bodyRows = rows.map((r) => {
    const view = formatAllowanceForAdmin(r)
    return [
      r.date || '',
      dayOfWeek(r.date || ''),
      view.activityLabel,
      view.regionLabel === '-' ? '' : view.regionLabel,
      view.accommodationLabel || '',
      view.hasDriving ? 'あり' : '',
      r.amount ?? 0,
    ]
  })
  const allRows = [...headerRows, ...bodyRows, ['合計', '', '', '', '', '', total]]
  const ws = XLSX.utils.aoa_to_sheet(allRows)
  ws['!cols'] = [{ wch: 12 }, { wch: 5 }, { wch: 28 }, { wch: 14 }, { wch: 24 }, { wch: 6 }, { wch: 10 }]
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, '手当申請書')
  XLSX.writeFile(wb, `${yearMonth}_手当申請書_${userName}.xlsx`)
}

export async function exportIndividualYearly(
  supabase: SupabaseClient,
  users: UserOption[],
  selectedUserId: string,
  year: number
) {
  const { data: allowances, error } = await supabase
    .from('allowances')
    .select('*')
    .eq('user_id', selectedUserId)
    .gte('date', `${year}-01-01`)
    .lte('date', `${year}-12-31`)
    .order('date', { ascending: true })

  if (error) throw new Error(error.message)

  const user = findUser(users, selectedUserId)
  const userName = user?.display_name || user?.email || 'unknown'
  const rows = (allowances as AllowanceRow[]) ?? []
  const monthlyTotals: Record<number, number> = {}
  rows.forEach((item) => {
    if (!item.date) return
    const m = parseInt(item.date.split('-')[1], 10)
    if (m >= 1 && m <= 12) monthlyTotals[m] = (monthlyTotals[m] || 0) + (item.amount ?? 0)
  })
  const total = Object.values(monthlyTotals).reduce((s, v) => s + v, 0)
  const campCount = rows.filter((a) => a.activity_type?.includes('合宿')).length
  const expeditionCount = rows.filter((a) => a.activity_type?.includes('遠征')).length

  const headerRows = [
    ['氏名', `${userName} 様`, '年間支給合計額', total],
    ['対象年', `${year}年`, '活動内訳', `合宿:${campCount}日 / 遠征:${expeditionCount}日`],
    [],
    ['月', '件数', '金額'],
  ]
  const bodyRows = Array.from({ length: 12 }, (_, i) => {
    const m = i + 1
    const count = rows.filter((a) => a.date && parseInt(a.date.split('-')[1], 10) === m).length
    return [`${m}月`, count, monthlyTotals[m] || 0]
  })
  const allRows = [...headerRows, ...bodyRows, ['年間合計', rows.length, total]]
  const ws = XLSX.utils.aoa_to_sheet(allRows)
  ws['!cols'] = [{ wch: 15 }, { wch: 12 }, { wch: 15 }]
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, '年間集計')
  XLSX.writeFile(wb, `${year}_手当年間集計_${userName}.xlsx`)
}

export async function exportAllMonthly(
  supabase: SupabaseClient,
  users: UserOption[],
  year: number,
  month: number
) {
  const { yearMonth, start, end } = getMonthDateRange(year, month)
  const { data: allowances, error } = await supabase
    .from('allowances')
    .select('*')
    .gte('date', start)
    .lte('date', end)
    .order('user_email')

  if (error) throw new Error(error.message)

  const rows = (allowances as AllowanceRow[]) ?? []
  const userTotals: Record<string, { name: string; count: number; amount: number; camp: number; expedition: number }> = {}

  rows.forEach((item) => {
    const email = item.user_email
    if (!email) return
    if (!userTotals[email]) {
      const u = users.find((x) => x.email === email)
      userTotals[email] = { name: u?.display_name || email, count: 0, amount: 0, camp: 0, expedition: 0 }
    }
    userTotals[email].count++
    userTotals[email].amount += item.amount ?? 0
    if (item.activity_type?.includes('合宿')) userTotals[email].camp++
    if (item.activity_type?.includes('遠征')) userTotals[email].expedition++
  })

  const totalAmount = Object.values(userTotals).reduce((s, d) => s + d.amount, 0)
  const totalCount = Object.values(userTotals).reduce((s, d) => s + d.count, 0)
  const totalCamp = Object.values(userTotals).reduce((s, d) => s + d.camp, 0)
  const totalExpedition = Object.values(userTotals).reduce((s, d) => s + d.expedition, 0)

  const headerRows = [
    ['手当全体集計（月次）', '', '支給合計額', totalAmount],
    ['対象月', `${year}年${month}月`, '活動内訳', `合宿:${totalCamp}日 / 遠征:${totalExpedition}日`],
    [],
    ['職員名', '件数', '金額', '合宿日数', '遠征日数'],
  ]
  const bodyRows = Object.values(userTotals).map((d) => [d.name, d.count, d.amount, d.camp, d.expedition])
  const allRows = [...headerRows, ...bodyRows, ['合計', totalCount, totalAmount, totalCamp, totalExpedition]]
  const ws = XLSX.utils.aoa_to_sheet(allRows)
  ws['!cols'] = [{ wch: 20 }, { wch: 10 }, { wch: 15 }, { wch: 12 }, { wch: 12 }]
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, '全体集計')
  XLSX.writeFile(wb, `${yearMonth}_全体集計.xlsx`)
}

export async function exportAllYearly(supabase: SupabaseClient, users: UserOption[], year: number) {
  const { data: allowances, error } = await supabase
    .from('allowances')
    .select('*')
    .gte('date', `${year}-01-01`)
    .lte('date', `${year}-12-31`)
    .order('user_email')

  if (error) throw new Error(error.message)

  const rows = (allowances as AllowanceRow[]) ?? []
  const userTotals: Record<string, { name: string; count: number; amount: number; camp: number; expedition: number }> = {}

  rows.forEach((item) => {
    const email = item.user_email
    if (!email) return
    if (!userTotals[email]) {
      const u = users.find((x) => x.email === email)
      userTotals[email] = { name: u?.display_name || email, count: 0, amount: 0, camp: 0, expedition: 0 }
    }
    userTotals[email].count++
    userTotals[email].amount += item.amount ?? 0
    if (item.activity_type?.includes('合宿')) userTotals[email].camp++
    if (item.activity_type?.includes('遠征')) userTotals[email].expedition++
  })

  const totalAmount = Object.values(userTotals).reduce((s, d) => s + d.amount, 0)
  const totalCount = Object.values(userTotals).reduce((s, d) => s + d.count, 0)
  const totalCamp = Object.values(userTotals).reduce((s, d) => s + d.camp, 0)
  const totalExpedition = Object.values(userTotals).reduce((s, d) => s + d.expedition, 0)

  const headerRows = [
    ['手当年間全体集計', '', '年間支給合計額', totalAmount],
    ['対象年', `${year}年`, '活動内訳', `合宿:${totalCamp}日 / 遠征:${totalExpedition}日`],
    [],
    ['職員名', '件数', '金額', '合宿日数', '遠征日数'],
  ]
  const bodyRows = Object.values(userTotals).map((d) => [d.name, d.count, d.amount, d.camp, d.expedition])
  const allRows = [...headerRows, ...bodyRows, ['合計', totalCount, totalAmount, totalCamp, totalExpedition]]
  const ws = XLSX.utils.aoa_to_sheet(allRows)
  ws['!cols'] = [{ wch: 20 }, { wch: 10 }, { wch: 15 }, { wch: 12 }, { wch: 12 }]
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, '年間全体集計')
  XLSX.writeFile(wb, `${year}_年間全体集計.xlsx`)
}
