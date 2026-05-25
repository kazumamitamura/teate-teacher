'use client'

import type { UserOption } from '@/utils/adminAllowanceData'

type Props = {
  users: UserOption[]
  selectedYear: number
  selectedMonth: number
  selectedUserId: string
  onYearChange: (y: number) => void
  onMonthChange: (m: number) => void
  onUserChange: (id: string) => void
  viewMode?: 'user' | 'date'
  onViewModeChange?: (mode: 'user' | 'date') => void
  onRefresh?: () => void
  refreshing?: boolean
  summary?: { count: number; userCount: number; total: number }
  showViewMode?: boolean
  userSelectLabel?: string
}

export function AllowanceFilters({
  users,
  selectedYear,
  selectedMonth,
  selectedUserId,
  onYearChange,
  onMonthChange,
  onUserChange,
  viewMode,
  onViewModeChange,
  onRefresh,
  refreshing,
  summary,
  showViewMode = false,
  userSelectLabel = '職員',
}: Props) {
  return (
    <div className="bg-white rounded-2xl shadow-md p-6 mb-6">
      <div className="flex flex-wrap gap-4 items-center">
        <div className="flex gap-2 items-center">
          <label className="font-bold text-slate-800 text-sm">対象月</label>
          <select
            value={selectedYear}
            onChange={(e) => onYearChange(Number(e.target.value))}
            className="px-3 py-2 border rounded-lg font-bold text-sm text-slate-900"
          >
            {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i).map((y) => (
              <option key={y} value={y}>
                {y}年
              </option>
            ))}
          </select>
          <select
            value={selectedMonth}
            onChange={(e) => onMonthChange(Number(e.target.value))}
            className="px-3 py-2 border rounded-lg font-bold text-sm text-slate-900"
          >
            {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
              <option key={m} value={m}>
                {m}月
              </option>
            ))}
          </select>
        </div>

        <div className="flex gap-2 items-center">
          <label className="font-bold text-slate-800 text-sm">{userSelectLabel}</label>
          <select
            value={selectedUserId}
            onChange={(e) => onUserChange(e.target.value)}
            className="px-3 py-2 border rounded-lg font-bold text-sm text-slate-900 min-w-[200px]"
          >
            <option value="">{showViewMode ? '全職員' : '選択してください（個人用）'}</option>
            {users.map((u) => (
              <option key={u.user_id} value={u.user_id}>
                {u.display_name || u.email || '氏名未登録'}
              </option>
            ))}
          </select>
        </div>

        {showViewMode && onViewModeChange && viewMode && (
          <div className="flex gap-2 items-center ml-auto">
            <label className="font-bold text-slate-800 text-sm">表示</label>
            <div className="flex gap-1 bg-slate-100 p-1 rounded-lg">
              <button
                type="button"
                onClick={() => onViewModeChange('user')}
                className={`px-3 py-1.5 rounded-md text-sm font-bold ${
                  viewMode === 'user' ? 'bg-white text-blue-600 shadow' : 'text-slate-600'
                }`}
              >
                ユーザー別
              </button>
              <button
                type="button"
                onClick={() => onViewModeChange('date')}
                className={`px-3 py-1.5 rounded-md text-sm font-bold ${
                  viewMode === 'date' ? 'bg-white text-blue-600 shadow' : 'text-slate-600'
                }`}
              >
                日付別
              </button>
            </div>
          </div>
        )}

        {onRefresh && (
          <button
            type="button"
            onClick={onRefresh}
            disabled={refreshing}
            className="px-4 py-2 bg-blue-600 text-white text-sm font-bold rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {refreshing ? '読込中…' : '更新'}
          </button>
        )}
      </div>

      {summary && (
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="bg-blue-50 rounded-lg p-3 border border-blue-100">
            <p className="text-xs text-blue-700 font-bold">データ件数</p>
            <p className="text-xl font-bold text-blue-900">{summary.count}件</p>
          </div>
          <div className="bg-purple-50 rounded-lg p-3 border border-purple-100">
            <p className="text-xs text-purple-700 font-bold">登録ユーザー数</p>
            <p className="text-xl font-bold text-purple-900">{summary.userCount}人</p>
          </div>
          <div className="bg-green-50 rounded-lg p-3 border border-green-100">
            <p className="text-xs text-green-700 font-bold">合計金額</p>
            <p className="text-xl font-bold text-green-900">¥{summary.total.toLocaleString()}</p>
          </div>
        </div>
      )}
    </div>
  )
}
