'use client'

import { useCallback, useEffect, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  fetchAllowancesForPeriod,
  type AllowanceRecord,
  type UserOption,
} from '@/utils/adminAllowanceData'
import { formatAllowanceForAdmin } from '@/utils/adminAllowanceDisplay'
import {
  AllowanceAccommodationCell,
  AllowanceActivityCell,
  AllowanceDrivingCell,
  AllowanceRegionCell,
} from '@/components/admin/AllowanceAdminCells'
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

function formatRow(allowance: AllowanceRecord) {
  return formatAllowanceForAdmin(allowance)
}

export function AllowancePreviewPanel({
  supabase,
  users,
  selectedYear,
  selectedMonth,
  selectedUserId,
  onYearChange,
  onMonthChange,
  onUserChange,
}: Props) {
  const [loading, setLoading] = useState(true)
  const [allowances, setAllowances] = useState<AllowanceRecord[]>([])
  const [viewMode, setViewMode] = useState<'user' | 'date'>('user')

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const data = await fetchAllowancesForPeriod(supabase, {
        year: selectedYear,
        month: selectedMonth,
        userId: selectedUserId || undefined,
      })
      setAllowances(data)
    } catch (e) {
      alert('データの取得に失敗しました: ' + (e instanceof Error ? e.message : String(e)))
      setAllowances([])
    } finally {
      setLoading(false)
    }
  }, [supabase, selectedYear, selectedMonth, selectedUserId])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const summary = {
    count: allowances.length,
    userCount: new Set(allowances.map((a) => a.user_id)).size,
    total: allowances.reduce((sum, a) => sum + a.amount, 0),
  }

  const renderByUser = () => {
    const userMap = new Map<string, { profile: UserOption | null; allowances: AllowanceRecord[] }>()

    if (selectedUserId) {
      const user = users.find((u) => u.user_id === selectedUserId)
      if (user) userMap.set(user.user_id, { profile: user, allowances: [] })
    } else {
      users.forEach((user) => userMap.set(user.user_id, { profile: user, allowances: [] }))
    }

    allowances.forEach((allowance) => {
      if (!userMap.has(allowance.user_id)) {
        const matchingUser = users.find((u) => u.user_id === allowance.user_id)
        userMap.set(allowance.user_id, { profile: matchingUser || null, allowances: [] })
      }
      userMap.get(allowance.user_id)!.allowances.push(allowance)
    })

    return (
      <div className="space-y-6">
        {Array.from(userMap.entries()).map(([userId, { profile, allowances: userAllowances }]) => {
          const total = userAllowances.reduce((sum, a) => sum + a.amount, 0)
          const joined = userAllowances[0]?.user_profiles
          const fallbackEmail = userAllowances[0]?.user_email ?? ''
          const displayName =
            joined?.display_name ??
            profile?.display_name ??
            profile?.email ??
            (fallbackEmail ? `氏名未登録（${fallbackEmail}）` : 'ユーザー名未登録')
          const displayEmail = profile?.email ?? fallbackEmail ?? ''

          return (
            <div key={userId} className="bg-white rounded-2xl shadow-lg overflow-hidden">
              <div className="bg-gradient-to-r from-blue-600 to-purple-600 p-4 text-white">
                <div className="flex justify-between items-center">
                  <div>
                    <h3 className="text-xl font-bold">{displayName}</h3>
                    {displayEmail && <p className="text-sm opacity-90">{displayEmail}</p>}
                    {!(joined?.display_name ?? profile?.display_name) && (
                      <p className="text-xs opacity-75 mt-1 bg-yellow-500/30 px-2 py-1 rounded inline-block">
                        ⚠️ {fallbackEmail ? `氏名未登録（${fallbackEmail}）` : '氏名未登録'}
                      </p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="text-sm opacity-90">合計金額</p>
                    <p className="text-2xl font-bold">¥{total.toLocaleString()}</p>
                    <p className="text-xs opacity-75">{userAllowances.length}件</p>
                  </div>
                </div>
              </div>

              {userAllowances.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-100">
                      <tr>
                        <th className="px-4 py-3 text-left text-sm font-bold text-gray-700">日付</th>
                        <th className="px-4 py-3 text-left text-sm font-bold text-gray-700">曜日</th>
                        <th className="px-4 py-3 text-left text-sm font-bold text-gray-700">手当区分</th>
                        <th className="px-4 py-3 text-left text-sm font-bold text-gray-700">行き先</th>
                        <th className="px-4 py-3 text-left text-sm font-bold text-gray-700">宿泊</th>
                        <th className="px-4 py-3 text-center text-sm font-bold text-gray-700">運転</th>
                        <th className="px-4 py-3 text-right text-sm font-bold text-gray-700">金額</th>
                      </tr>
                    </thead>
                    <tbody>
                      {userAllowances.map((allowance, index) => {
                        const date = new Date(allowance.date)
                        const dayOfWeek = ['日', '月', '火', '水', '木', '金', '土'][date.getDay()]
                        const view = formatRow(allowance)
                        return (
                          <tr key={allowance.id} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                            <td className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap">{allowance.date}</td>
                            <td className="px-4 py-3 text-sm text-gray-600">{dayOfWeek}</td>
                            <td className="px-4 py-3">
                              <AllowanceActivityCell view={view} />
                            </td>
                            <td className="px-4 py-3">
                              <AllowanceRegionCell label={view.regionLabel} />
                            </td>
                            <td className="px-4 py-3">
                              <AllowanceAccommodationCell label={view.accommodationLabel} />
                            </td>
                            <td className="px-4 py-3 text-center">
                              <AllowanceDrivingCell hasDriving={view.hasDriving} />
                            </td>
                            <td className="px-4 py-3 text-right text-sm font-bold text-gray-900 whitespace-nowrap">
                              ¥{allowance.amount.toLocaleString()}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="bg-blue-50 font-bold">
                        <td colSpan={6} className="px-4 py-3 text-right text-gray-900">
                          合計
                        </td>
                        <td className="px-4 py-3 text-right text-blue-900 text-lg">¥{total.toLocaleString()}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              ) : (
                <div className="p-8 text-center text-gray-500">この期間にデータがありません</div>
              )}
            </div>
          )
        })}
      </div>
    )
  }

  const renderByDate = () => {
    const dateMap = new Map<string, AllowanceRecord[]>()
    allowances.forEach((allowance) => {
      if (!dateMap.has(allowance.date)) dateMap.set(allowance.date, [])
      dateMap.get(allowance.date)!.push(allowance)
    })
    const sortedDates = Array.from(dateMap.keys()).sort()

    return (
      <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gradient-to-r from-blue-600 to-purple-600 text-white">
              <tr>
                <th className="px-4 py-3 text-left font-bold">日付</th>
                <th className="px-4 py-3 text-left font-bold">曜日</th>
                <th className="px-4 py-3 text-left font-bold">氏名</th>
                <th className="px-4 py-3 text-left font-bold">手当区分</th>
                <th className="px-4 py-3 text-left font-bold">行き先</th>
                <th className="px-4 py-3 text-left font-bold">宿泊</th>
                <th className="px-4 py-3 text-center font-bold">運転</th>
                <th className="px-4 py-3 text-right font-bold">金額</th>
              </tr>
            </thead>
            <tbody>
              {sortedDates.map((date) => {
                const dateAllowances = dateMap.get(date)!
                const dateObj = new Date(date)
                const dayOfWeek = ['日', '月', '火', '水', '木', '金', '土'][dateObj.getDay()]

                return dateAllowances.map((allowance, index) => {
                  const user = users.find((u) => u.user_id === allowance.user_id)
                  const joined = allowance.user_profiles
                  const displayName =
                    joined?.display_name ??
                    user?.display_name ??
                    user?.email ??
                    (allowance.user_email ? `氏名未登録（${allowance.user_email}）` : 'ユーザー名未登録')
                  const view = formatRow(allowance)

                  return (
                    <tr key={allowance.id} className="border-b border-gray-200 hover:bg-gray-50">
                      {index === 0 && (
                        <>
                          <td
                            rowSpan={dateAllowances.length}
                            className="px-4 py-3 text-sm font-bold text-gray-900 border-r border-gray-200 whitespace-nowrap"
                          >
                            {date}
                          </td>
                          <td
                            rowSpan={dateAllowances.length}
                            className="px-4 py-3 text-sm text-gray-600 border-r border-gray-200"
                          >
                            {dayOfWeek}
                          </td>
                        </>
                      )}
                      <td className="px-4 py-3 text-sm text-gray-900 font-medium whitespace-nowrap">{displayName}</td>
                      <td className="px-4 py-3">
                        <AllowanceActivityCell view={view} />
                      </td>
                      <td className="px-4 py-3">
                        <AllowanceRegionCell label={view.regionLabel} />
                      </td>
                      <td className="px-4 py-3">
                        <AllowanceAccommodationCell label={view.accommodationLabel} />
                      </td>
                      <td className="px-4 py-3 text-center">
                        <AllowanceDrivingCell hasDriving={view.hasDriving} />
                      </td>
                      <td className="px-4 py-3 text-right text-sm font-bold text-gray-900 whitespace-nowrap">
                        ¥{allowance.amount.toLocaleString()}
                      </td>
                    </tr>
                  )
                })
              })}
            </tbody>
            <tfoot>
              <tr className="bg-blue-50 font-bold">
                <td colSpan={7} className="px-4 py-3 text-right text-gray-900">
                  合計
                </td>
                <td className="px-4 py-3 text-right text-blue-900 text-lg">
                  ¥{summary.total.toLocaleString()}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    )
  }

  return (
    <div>
      <AllowanceFilters
        users={users}
        selectedYear={selectedYear}
        selectedMonth={selectedMonth}
        selectedUserId={selectedUserId}
        onYearChange={onYearChange}
        onMonthChange={onMonthChange}
        onUserChange={onUserChange}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        showViewMode
        onRefresh={fetchData}
        refreshing={loading}
        summary={summary}
      />

      {loading ? (
        <div className="flex justify-center items-center py-12 text-slate-600">読み込み中…</div>
      ) : allowances.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-lg p-12 text-center">
          <p className="text-gray-500 text-lg">この期間にデータがありません</p>
        </div>
      ) : viewMode === 'user' ? (
        renderByUser()
      ) : (
        renderByDate()
      )}
    </div>
  )
}
