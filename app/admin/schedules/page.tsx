'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRequireAdmin } from '@/utils/useRequireAdmin'
import {
  WORK_TYPE_OPTIONS,
  fetchAllAnnualSchedules,
  formatFiscalYearLabel,
  formatMonthLabel,
  formatScheduleDate,
  getDateRangeLabel,
  getFiscalYear,
  getMonthKey,
  getScheduleRowClass,
  getWorkTypeBadgeClass,
  isInFiscalYear,
  type AnnualScheduleRow,
} from '@/utils/annualSchedule'

export default function AdminSchedulesPage() {
  const { loading: authLoading, authorized, supabase } = useRequireAdmin()
  const [rows, setRows] = useState<AnnualScheduleRow[]>([])
  const [draft, setDraft] = useState<AnnualScheduleRow[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [monthFilter, setMonthFilter] = useState('all')
  const [fiscalYearFilter, setFiscalYearFilter] = useState('all')
  const [dbTotalCount, setDbTotalCount] = useState<number | null>(null)

  const fetchSchedules = useCallback(async () => {
    setLoading(true)
    const { data, totalCount, error } = await fetchAllAnnualSchedules(supabase)

    if (error) {
      console.error('勤務表取得エラー:', error)
      alert('勤務表データの取得に失敗しました: ' + error)
      setRows([])
      setDbTotalCount(null)
    } else {
      setRows(data)
      setDbTotalCount(totalCount)
    }
    setLoading(false)
  }, [supabase])

  useEffect(() => {
    if (authorized) fetchSchedules()
  }, [authorized, fetchSchedules])

  const fiscalYearOptions = useMemo(() => {
    const years = [...new Set(rows.map((r) => getFiscalYear(r.date)))]
    return years.sort((a, b) => b - a)
  }, [rows])

  const monthOptions = useMemo(() => {
    const source =
      fiscalYearFilter === 'all'
        ? rows
        : rows.filter((r) => isInFiscalYear(r.date, Number(fiscalYearFilter)))
    const keys = [...new Set(source.map((r) => getMonthKey(r.date)))]
    return keys.sort()
  }, [rows, fiscalYearFilter])

  const workTypeOptions = useMemo(() => {
    const extras = rows
      .map((r) => r.work_type.trim())
      .filter((wt) => wt && !WORK_TYPE_OPTIONS.includes(wt as (typeof WORK_TYPE_OPTIONS)[number]))
    return [...WORK_TYPE_OPTIONS, ...[...new Set(extras)].sort()]
  }, [rows])

  const displayedRows = useMemo(() => {
    let source = editing ? draft : rows
    if (fiscalYearFilter !== 'all') {
      const fy = Number(fiscalYearFilter)
      source = source.filter((r) => isInFiscalYear(r.date, fy))
    }
    if (monthFilter !== 'all') {
      source = source.filter((r) => getMonthKey(r.date) === monthFilter)
    }
    return source
  }, [editing, draft, rows, monthFilter, fiscalYearFilter])

  const fetchIncomplete = dbTotalCount != null && rows.length < dbTotalCount

  const changedCount = useMemo(() => {
    if (!editing) return 0
    return draft.filter((d) => {
      const orig = rows.find((r) => r.date === d.date)
      if (!orig) return true
      return orig.work_type !== d.work_type || orig.event_name !== d.event_name
    }).length
  }, [editing, draft, rows])

  const startEditing = () => {
    setDraft(rows.map((r) => ({ ...r })))
    setEditing(true)
  }

  const cancelEditing = () => {
    setDraft([])
    setEditing(false)
  }

  const updateDraft = (date: string, patch: Partial<Pick<AnnualScheduleRow, 'work_type' | 'event_name'>>) => {
    setDraft((prev) =>
      prev.map((r) => (r.date === date ? { ...r, ...patch } : r)),
    )
  }

  const handleSave = async () => {
    const changed = draft.filter((d) => {
      const orig = rows.find((r) => r.date === d.date)
      if (!orig) return true
      return orig.work_type !== d.work_type || orig.event_name !== d.event_name
    })

    if (changed.length === 0) {
      alert('変更がありません。')
      setEditing(false)
      return
    }

    const invalid = changed.find((r) => !r.work_type.trim())
    if (invalid) {
      alert(`${formatScheduleDate(invalid.date).label} の勤務区分が空です。`)
      return
    }

    if (!confirm(`${changed.length}件の勤務区分を保存しますか？`)) return

    setSaving(true)
    try {
      const payload = changed.map(({ date, work_type, event_name }) => ({
        date,
        work_type: work_type.trim(),
        event_name: (event_name ?? '').trim(),
      }))

      const { error } = await supabase
        .from('annual_schedules')
        .upsert(payload, { onConflict: 'date' })

      if (error) {
        alert('保存に失敗しました: ' + error.message)
      } else {
        alert(`✅ ${changed.length}件を保存しました。`)
        setEditing(false)
        await fetchSchedules()
      }
    } catch (err) {
      alert('保存中にエラーが発生しました。')
      console.error(err)
    }
    setSaving(false)
  }

  if (authLoading || !authorized) {
    return <div className="p-10 text-center">確認中...</div>
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="bg-slate-800 text-white p-6 shadow-lg">
        <div className="max-w-6xl mx-auto flex flex-wrap justify-between items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold">年間勤務表の編集</h1>
            <p className="text-slate-300 text-sm mt-1">CSV登録データの確認・微調整（代休など）</p>
          </div>
          <Link
            href="/admin"
            className="bg-slate-700 hover:bg-slate-600 px-4 py-2 rounded-lg font-bold text-sm transition"
          >
            ← 管理者画面へ
          </Link>
        </div>
      </div>

      <div className="max-w-6xl mx-auto p-6 sm:p-8">
        <div className="bg-white rounded-2xl shadow-md p-5 sm:p-6 mb-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-sm text-gray-600">
                登録件数: <span className="font-bold text-gray-900">{rows.length}件</span>
                {dbTotalCount != null && dbTotalCount !== rows.length && (
                  <span className="ml-2 text-red-600 font-bold">（DB全件: {dbTotalCount}件）</span>
                )}
                <span className="ml-2 text-gray-500">期間: {getDateRangeLabel(rows)}</span>
                {editing && changedCount > 0 && (
                  <span className="ml-3 text-amber-700 font-bold">（未保存の変更: {changedCount}件）</span>
                )}
              </p>
              {fetchIncomplete && (
                <p className="mt-1 text-xs text-red-600 font-bold">
                  ⚠️ データの一部しか取得できていません。ページを再読み込みしてください。
                </p>
              )}
              <div className="flex flex-wrap gap-3 mt-2 text-xs">
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-4 h-4 rounded border border-slate-200 bg-white" />
                  勤務日（A/B/C）
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-4 h-4 rounded border border-red-200 bg-red-50" />
                  休日（休/祝）
                </span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <label className="text-sm font-bold text-gray-700">
                年度:
                <select
                  value={fiscalYearFilter}
                  onChange={(e) => {
                    setFiscalYearFilter(e.target.value)
                    setMonthFilter('all')
                  }}
                  className="ml-2 rounded-lg border border-gray-300 px-3 py-2 text-sm font-bold text-gray-900 bg-white"
                >
                  <option value="all">すべて</option>
                  {fiscalYearOptions.map((fy) => (
                    <option key={fy} value={String(fy)}>
                      {formatFiscalYearLabel(fy)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm font-bold text-gray-700">
                表示月:
                <select
                  value={monthFilter}
                  onChange={(e) => setMonthFilter(e.target.value)}
                  className="ml-2 rounded-lg border border-gray-300 px-3 py-2 text-sm font-bold text-gray-900 bg-white"
                >
                  <option value="all">すべて</option>
                  {monthOptions.map((m) => (
                    <option key={m} value={m}>
                      {formatMonthLabel(m)}
                    </option>
                  ))}
                </select>
              </label>

              {!editing ? (
                <button
                  type="button"
                  onClick={startEditing}
                  disabled={rows.length === 0 || loading}
                  className="px-5 py-2.5 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition"
                >
                  ✏️ 編集
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={cancelEditing}
                    disabled={saving}
                    className="px-4 py-2.5 bg-slate-100 text-slate-700 font-bold rounded-lg hover:bg-slate-200 border border-slate-300 transition"
                  >
                    キャンセル
                  </button>
                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={saving || changedCount === 0}
                    className="px-5 py-2.5 bg-emerald-600 text-white font-bold rounded-lg hover:bg-emerald-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition"
                  >
                    {saving ? '保存中...' : '💾 保存'}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-md overflow-hidden">
          {loading ? (
            <p className="p-8 text-center text-gray-500">読み込み中...</p>
          ) : rows.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-gray-600 mb-2">登録されている勤務表データがありません。</p>
              <Link href="/admin" className="text-blue-600 font-bold hover:underline">
                管理者画面でCSVを登録する
              </Link>
            </div>
          ) : displayedRows.length === 0 ? (
            <p className="p-8 text-center text-gray-500">この月のデータはありません。</p>
          ) : (
            <div className="overflow-x-auto max-h-[70vh] overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 z-10 bg-slate-100 border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3 text-left font-bold text-gray-800 w-36">日付</th>
                    <th className="px-4 py-3 text-center font-bold text-gray-800 w-16">曜日</th>
                    <th className="px-4 py-3 text-left font-bold text-gray-800 w-28">勤務区分</th>
                    <th className="px-4 py-3 text-left font-bold text-gray-800">行事名</th>
                  </tr>
                </thead>
                <tbody>
                  {displayedRows.map((row) => {
                    const { label, weekday } = formatScheduleDate(row.date)
                    const orig = rows.find((r) => r.date === row.date)
                    const isChanged =
                      editing &&
                      orig &&
                      (orig.work_type !== row.work_type || orig.event_name !== row.event_name)
                    const isWeekend = weekday === '土' || weekday === '日'

                    return (
                      <tr
                        key={row.date}
                        className={`border-b border-slate-100 ${getScheduleRowClass(row.work_type)} ${
                          isChanged ? 'ring-2 ring-inset ring-amber-300' : ''
                        }`}
                      >
                        <td className="px-4 py-2.5 font-mono font-bold text-gray-900">{label}</td>
                        <td
                          className={`px-4 py-2.5 text-center font-bold ${
                            isWeekend ? 'text-red-500' : 'text-gray-600'
                          }`}
                        >
                          {weekday}
                        </td>
                        <td className="px-4 py-2.5">
                          {editing ? (
                            <select
                              value={row.work_type}
                              onChange={(e) => updateDraft(row.date, { work_type: e.target.value })}
                              className="w-full rounded-lg border border-gray-300 px-2 py-1.5 font-bold text-gray-900 bg-white"
                            >
                              {workTypeOptions.map((opt) => (
                                <option key={opt} value={opt}>
                                  {opt}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <span
                              className={`inline-block px-2.5 py-1 rounded-md text-xs font-bold border ${getWorkTypeBadgeClass(row.work_type)}`}
                            >
                              {row.work_type}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-gray-800">
                          {editing ? (
                            <input
                              type="text"
                              value={row.event_name}
                              onChange={(e) => updateDraft(row.date, { event_name: e.target.value })}
                              placeholder="（空欄可）"
                              className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-gray-900 bg-white"
                            />
                          ) : (
                            row.event_name || <span className="text-gray-400">—</span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {editing && (
          <p className="mt-4 text-xs text-gray-500 text-center">
            勤務区分を変更すると行の色が変わります。代休などで「休」→「A」に変更する場合もここで編集できます。
          </p>
        )}
      </div>
    </div>
  )
}
