'use client'

import { useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  exportAllMonthly,
  exportAllYearly,
  exportIndividualMonthly,
  exportIndividualYearly,
} from '@/utils/adminAllowanceExport'
import type { UserOption } from '@/utils/adminAllowanceData'
import { AllowanceFilters } from './AllowanceFilters'

type Props = {
  supabase: SupabaseClient
  users: UserOption[]
  selectedYear: number
  selectedMonth: number
  selectedUserId: string
  onYearChange: (y: number) => void
  onMonthChange: (m: number) => void
  onUserChange: (id: string) => void
}

export function AllowanceExcelPanel({
  supabase,
  users,
  selectedYear,
  selectedMonth,
  selectedUserId,
  onYearChange,
  onMonthChange,
  onUserChange,
}: Props) {
  const [busy, setBusy] = useState(false)

  const run = async (fn: () => Promise<void>) => {
    setBusy(true)
    try {
      await fn()
      alert('Excelファイルをダウンロードしました。')
    } catch (e) {
      alert('出力に失敗しました: ' + (e instanceof Error ? e.message : String(e)))
    } finally {
      setBusy(false)
    }
  }

  const selectedName = selectedUserId
    ? users.find((u) => u.user_id === selectedUserId)?.display_name || '職員'
    : '職員未選択'

  return (
    <div>
      <div className="bg-blue-50 border-l-4 border-blue-500 p-4 mb-6 rounded-r-lg text-sm text-blue-900">
        <strong>帳票形式で出力</strong> — 氏名・合計金額・合宿/遠征日数がヘッダーに入ります。印刷・経理確認にそのまま使えます。
      </div>

      <AllowanceFilters
        users={users}
        selectedYear={selectedYear}
        selectedMonth={selectedMonth}
        selectedUserId={selectedUserId}
        onYearChange={onYearChange}
        onMonthChange={onMonthChange}
        onUserChange={onUserChange}
        userSelectLabel="職員（個人レポート用）"
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <button
          type="button"
          disabled={busy || !selectedUserId}
          onClick={() =>
            run(() => exportIndividualMonthly(supabase, users, selectedUserId, selectedYear, selectedMonth))
          }
          className="bg-white p-6 rounded-2xl shadow-md hover:shadow-lg border-2 border-transparent hover:border-blue-400 text-left disabled:opacity-50"
        >
          <div className="text-4xl mb-2">👤</div>
          <h3 className="text-lg font-bold text-slate-800">個人月次レポート</h3>
          <p className="text-sm text-slate-500 mt-1">指定月の明細（帳票形式）</p>
          <p className="text-xs text-slate-400 mt-2">
            {selectedName} / {selectedYear}年{selectedMonth}月
          </p>
        </button>

        <button
          type="button"
          disabled={busy || !selectedUserId}
          onClick={() => run(() => exportIndividualYearly(supabase, users, selectedUserId, selectedYear))}
          className="bg-white p-6 rounded-2xl shadow-md hover:shadow-lg border-2 border-transparent hover:border-purple-400 text-left disabled:opacity-50"
        >
          <div className="text-4xl mb-2">📅</div>
          <h3 className="text-lg font-bold text-slate-800">個人年次レポート</h3>
          <p className="text-sm text-slate-500 mt-1">年間を月別集計</p>
          <p className="text-xs text-slate-400 mt-2">
            {selectedName} / {selectedYear}年
          </p>
        </button>

        <button
          type="button"
          disabled={busy}
          onClick={() => run(() => exportAllMonthly(supabase, users, selectedYear, selectedMonth))}
          className="bg-white p-6 rounded-2xl shadow-md hover:shadow-lg border-2 border-transparent hover:border-green-400 text-left disabled:opacity-50"
        >
          <div className="text-4xl mb-2">👥</div>
          <h3 className="text-lg font-bold text-slate-800">全体月次レポート</h3>
          <p className="text-sm text-slate-500 mt-1">全職員の月次集計</p>
          <p className="text-xs text-slate-400 mt-2">
            全職員 / {selectedYear}年{selectedMonth}月
          </p>
        </button>

        <button
          type="button"
          disabled={busy}
          onClick={() => run(() => exportAllYearly(supabase, users, selectedYear))}
          className="bg-gradient-to-br from-emerald-500 to-emerald-600 p-6 rounded-2xl shadow-md hover:shadow-lg text-left disabled:opacity-50"
        >
          <div className="text-4xl mb-2">📈</div>
          <h3 className="text-lg font-bold text-white">全体年次レポート</h3>
          <p className="text-sm text-emerald-50 mt-1">全職員の年間集計</p>
          <p className="text-xs text-emerald-100 mt-2">全職員 / {selectedYear}年</p>
        </button>
      </div>

      {busy && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white px-8 py-6 rounded-xl shadow-xl font-bold text-slate-800">
            Excel生成中…
          </div>
        </div>
      )}
    </div>
  )
}
