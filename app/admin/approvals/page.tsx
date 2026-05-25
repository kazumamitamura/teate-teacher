'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { logout } from '../../auth/actions'
import { useRequireAdmin } from '@/utils/useRequireAdmin'

type MonthlyStatus = 'DRAFT' | 'SUBMITTED' | 'APPROVED'

type UserRow = {
  user_id: string
  user_email: string
  display_name: string | null
  status: MonthlyStatus
  total_amount: number
  count: number
}

export default function ApprovalsPage() {
  const router = useRouter()
  const { loading: authLoading, authorized, supabase } = useRequireAdmin()

  const [loading, setLoading] = useState(true)
  const [users, setUsers] = useState<UserRow[]>([])
  const [targetYear, setTargetYear] = useState(new Date().getFullYear())
  const [targetMonth, setTargetMonth] = useState(new Date().getMonth() + 1)
  const [processing, setProcessing] = useState<string | null>(null)
  const [bulkProcessing, setBulkProcessing] = useState(false)

  useEffect(() => {
    if (authorized) fetchData()
  }, [authorized, targetYear, targetMonth])

  const targetMonthStr = `${targetYear}-${String(targetMonth).padStart(2, '0')}`

  const fetchData = async () => {
    setLoading(true)
    try {
      const monthStart = `${targetMonthStr}-01`
      const monthEnd = `${targetMonthStr}-31`

      // 対象月の全手当データを取得
      const { data: allowances, error: allowErr } = await supabase
        .from('allowances')
        .select('user_id, user_email, amount')
        .gte('date', monthStart)
        .lte('date', monthEnd)

      if (allowErr) {
        console.error('手当データ取得エラー:', allowErr)
        setUsers([])
        setLoading(false)
        return
      }

      // ユーザーごとに集計
      const userMap: Record<string, { user_email: string; total: number; count: number }> = {}
      for (const row of allowances || []) {
        if (!userMap[row.user_id]) {
          userMap[row.user_id] = { user_email: row.user_email || '', total: 0, count: 0 }
        }
        userMap[row.user_id].total += (row.amount ?? 0)
        userMap[row.user_id].count += 1
      }

      const userIds = Object.keys(userMap)
      if (userIds.length === 0) {
        setUsers([])
        setLoading(false)
        return
      }

      // プロフィール取得
      const { data: profiles } = await supabase
        .from('user_profiles')
        .select('user_id, display_name')
        .in('user_id', userIds)

      const profileMap: Record<string, string> = {}
      for (const p of profiles || []) {
        if (p.display_name) profileMap[p.user_id] = p.display_name
      }

      // 月次ステータス取得
      const { data: statuses } = await supabase
        .from('allowance_monthly_statuses')
        .select('user_id, status')
        .eq('target_month', targetMonthStr)
        .in('user_id', userIds)

      const statusMap: Record<string, MonthlyStatus> = {}
      for (const s of statuses || []) {
        statusMap[s.user_id] = s.status as MonthlyStatus
      }

      // 行データ組み立て
      const rows: UserRow[] = userIds.map(uid => ({
        user_id: uid,
        user_email: userMap[uid].user_email,
        display_name: profileMap[uid] || null,
        status: statusMap[uid] || 'DRAFT',
        total_amount: userMap[uid].total,
        count: userMap[uid].count,
      }))

      // 申請中を先頭、次に承認済、最後に下書きの順にソート
      const statusOrder: Record<string, number> = { SUBMITTED: 0, APPROVED: 1, DRAFT: 2 }
      rows.sort((a, b) => (statusOrder[a.status] ?? 9) - (statusOrder[b.status] ?? 9))

      setUsers(rows)
    } catch (err) {
      console.error('データ取得エラー:', err)
    }
    setLoading(false)
  }

  const handleChangeStatus = async (userId: string, newStatus: MonthlyStatus) => {
    setProcessing(userId)
    try {
      const { error } = await supabase
        .from('allowance_monthly_statuses')
        .upsert({
          user_id: userId,
          target_month: targetMonthStr,
          status: newStatus,
        }, { onConflict: 'user_id,target_month' })

      if (error) {
        console.error('ステータス変更エラー:', error)
        alert('ステータス変更に失敗しました: ' + error.message)
      } else {
        await fetchData()
      }
    } catch (err) {
      console.error(err)
      alert('処理中にエラーが発生しました。')
    }
    setProcessing(null)
  }

  const handleBulkApprove = async () => {
    const submittedUsers = users.filter(u => u.status === 'SUBMITTED')
    if (submittedUsers.length === 0) {
      alert('申請中のユーザーがいません。')
      return
    }
    if (!confirm(`申請中の${submittedUsers.length}名を一括承認しますか？`)) return

    setBulkProcessing(true)
    try {
      const upsertData = submittedUsers.map(u => ({
        user_id: u.user_id,
        target_month: targetMonthStr,
        status: 'APPROVED' as const,
      }))

      const { error } = await supabase
        .from('allowance_monthly_statuses')
        .upsert(upsertData, { onConflict: 'user_id,target_month' })

      if (error) {
        console.error('一括承認エラー:', error)
        alert('一括承認に失敗しました: ' + error.message)
      } else {
        alert(`${submittedUsers.length}名を承認しました。`)
        await fetchData()
      }
    } catch (err) {
      console.error(err)
      alert('処理中にエラーが発生しました。')
    }
    setBulkProcessing(false)
  }

  const handleLogout = async () => {
    await logout()
  }

  const handlePrevMonth = () => {
    if (targetMonth === 1) {
      setTargetYear(targetYear - 1)
      setTargetMonth(12)
    } else {
      setTargetMonth(targetMonth - 1)
    }
  }

  const handleNextMonth = () => {
    if (targetMonth === 12) {
      setTargetYear(targetYear + 1)
      setTargetMonth(1)
    } else {
      setTargetMonth(targetMonth + 1)
    }
  }

  const getStatusBadge = (status: MonthlyStatus) => {
    switch (status) {
      case 'SUBMITTED':
        return <span className="text-xs px-2.5 py-1 rounded-full font-bold bg-yellow-100 text-yellow-700 border border-yellow-300">申請中</span>
      case 'APPROVED':
        return <span className="text-xs px-2.5 py-1 rounded-full font-bold bg-green-100 text-green-700 border border-green-300">承認済</span>
      default:
        return <span className="text-xs px-2.5 py-1 rounded-full font-bold bg-gray-100 text-gray-600 border border-gray-300">未申請</span>
    }
  }

  if (authLoading || !authorized) return <div className="p-10 text-center">確認中...</div>

  const submittedCount = users.filter(u => u.status === 'SUBMITTED').length

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* ヘッダー */}
      <div className="bg-slate-800 text-white p-6 shadow-lg">
        <div className="max-w-6xl mx-auto flex justify-between items-center">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold mb-1">承認・返却管理</h1>
            <p className="text-slate-300 text-sm">月次手当の申請承認</p>
          </div>
          <div className="flex gap-3">
            <button onClick={() => router.push('/admin')} className="bg-slate-700 hover:bg-slate-600 px-4 py-2 rounded-lg font-bold text-sm transition">
              管理者ダッシュボード
            </button>
            <button onClick={() => router.push('/')} className="bg-slate-700 hover:bg-slate-600 px-4 py-2 rounded-lg font-bold text-sm transition">
              一般画面へ
            </button>
            <button onClick={handleLogout} className="bg-slate-700 hover:bg-slate-600 px-4 py-2 rounded-lg font-bold text-sm transition">
              ログアウト
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto p-4 sm:p-8">
        {/* 月選択 + 一括承認 */}
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <button onClick={handlePrevMonth} className="text-slate-400 hover:text-slate-600 text-2xl font-bold transition">‹</button>
              <h2 className="text-xl sm:text-2xl font-bold text-gray-900 whitespace-nowrap">
                {targetYear}年 {targetMonth}月
              </h2>
              <button onClick={handleNextMonth} className="text-slate-400 hover:text-slate-600 text-2xl font-bold transition">›</button>
            </div>
            <div className="flex items-center gap-3">
              {submittedCount > 0 && (
                <span className="text-sm text-yellow-700 font-bold bg-yellow-50 px-3 py-1 rounded-lg border border-yellow-200">
                  申請中: {submittedCount}名
                </span>
              )}
              <button
                onClick={handleBulkApprove}
                disabled={submittedCount === 0 || bulkProcessing}
                className="bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white font-bold px-5 py-2.5 rounded-lg shadow-md transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {bulkProcessing ? '処理中...' : `一括承認（${submittedCount}名）`}
              </button>
            </div>
          </div>
        </div>

        {/* ユーザーリスト */}
        {loading ? (
          <div className="text-center py-16 text-slate-500 font-bold">読み込み中...</div>
        ) : users.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-lg p-12 text-center">
            <div className="text-5xl mb-4">📋</div>
            <p className="text-lg font-bold text-slate-600">この月の手当データはありません</p>
          </div>
        ) : (
          <div className="space-y-3">
            {users.map((user) => (
              <div key={user.user_id} className="bg-white rounded-xl shadow-md p-4 sm:p-5 border border-slate-100 hover:border-slate-300 transition">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  {/* 左: ユーザー情報 */}
                  <div className="flex items-center gap-4 min-w-0">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white font-bold text-sm shrink-0">
                      {(user.display_name || user.user_email || '?')[0]}
                    </div>
                    <div className="min-w-0">
                      <div className="font-bold text-gray-900 text-sm sm:text-base truncate">
                        {user.display_name || `氏名未登録（${user.user_email}）`}
                      </div>
                      {user.display_name && (
                        <div className="text-xs text-slate-500 truncate">{user.user_email}</div>
                      )}
                    </div>
                  </div>

                  {/* 中央: ステータス + 金額 */}
                  <div className="flex items-center gap-4 shrink-0">
                    {getStatusBadge(user.status)}
                    <div className="text-right">
                      <div className="text-lg font-extrabold text-gray-900">¥{user.total_amount.toLocaleString()}</div>
                      <div className="text-xs text-slate-500">{user.count}件</div>
                    </div>
                  </div>

                  {/* 右: アクションボタン */}
                  <div className="flex items-center gap-2 shrink-0">
                    {user.status !== 'APPROVED' && (
                      <button
                        onClick={() => handleChangeStatus(user.user_id, 'APPROVED')}
                        disabled={processing === user.user_id}
                        className="bg-green-500 hover:bg-green-600 text-white font-bold text-xs sm:text-sm px-4 py-2 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {processing === user.user_id ? '...' : '承認'}
                      </button>
                    )}
                    {user.status !== 'DRAFT' && (
                      <button
                        onClick={() => handleChangeStatus(user.user_id, 'DRAFT')}
                        disabled={processing === user.user_id}
                        className="bg-orange-500 hover:bg-orange-600 text-white font-bold text-xs sm:text-sm px-4 py-2 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {processing === user.user_id ? '...' : '返却'}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* 合計サマリー */}
        {!loading && users.length > 0 && (
          <div className="mt-6 bg-gradient-to-r from-slate-800 to-slate-900 text-white rounded-2xl shadow-xl p-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              <div>
                <div className="text-sm text-slate-300 mb-1">全ユーザー合計</div>
                <div className="text-3xl font-extrabold">
                  ¥{users.reduce((sum, u) => sum + u.total_amount, 0).toLocaleString()}
                </div>
              </div>
              <div className="flex gap-4 text-sm">
                <div className="bg-slate-700 px-4 py-2 rounded-lg">
                  <span className="text-slate-400">対象者: </span>
                  <span className="font-bold">{users.length}名</span>
                </div>
                <div className="bg-slate-700 px-4 py-2 rounded-lg">
                  <span className="text-slate-400">承認済: </span>
                  <span className="font-bold text-green-400">{users.filter(u => u.status === 'APPROVED').length}名</span>
                </div>
                <div className="bg-slate-700 px-4 py-2 rounded-lg">
                  <span className="text-slate-400">申請中: </span>
                  <span className="font-bold text-yellow-400">{submittedCount}名</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
