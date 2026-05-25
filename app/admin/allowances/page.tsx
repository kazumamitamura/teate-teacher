'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useRequireAdmin } from '@/utils/useRequireAdmin'
import { fetchUserOptions, type UserOption } from '@/utils/adminAllowanceData'
import { AllowancePreviewPanel } from './AllowancePreviewPanel'
import { AllowanceExcelPanel } from './AllowanceExcelPanel'

type TabId = 'preview' | 'excel' | 'settings'

function AllowanceManagementContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { loading: authLoading, authorized, supabase } = useRequireAdmin()

  const tabParam = searchParams.get('tab')
  const activeTab: TabId =
    tabParam === 'excel' || tabParam === 'settings' ? tabParam : 'preview'

  const [initLoading, setInitLoading] = useState(true)
  const [users, setUsers] = useState<UserOption[]>([])
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1)
  const [selectedUserId, setSelectedUserId] = useState('')

  const setTab = (tab: TabId) => {
    router.replace(`/admin/allowances?tab=${tab}`)
  }

  useEffect(() => {
    if (!authorized) return
    fetchUserOptions(supabase)
      .then(setUsers)
      .finally(() => setInitLoading(false))
  }, [authorized, supabase])

  if (authLoading || !authorized) {
    return <div className="p-10 text-center">確認中…</div>
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="bg-blue-600 text-white p-4 shadow-md sticky top-0 z-20">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <h1 className="font-bold text-lg flex items-center gap-2">
            <span className="text-2xl">💰</span> 手当管理
          </h1>
          <button
            type="button"
            onClick={() => router.push('/admin')}
            className="text-xs bg-blue-700 px-4 py-2 rounded hover:bg-blue-800 font-bold border border-blue-500"
          >
            ← ダッシュボードへ
          </button>
        </div>
      </div>

      <div className="bg-white border-b border-slate-200 sticky top-[60px] z-10">
        <div className="max-w-7xl mx-auto flex gap-1 px-6">
          <button
            type="button"
            onClick={() => setTab('preview')}
            className={`px-6 py-3 font-bold text-sm transition ${
              activeTab === 'preview' ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            データプレビュー
          </button>
          <button
            type="button"
            onClick={() => setTab('excel')}
            className={`px-6 py-3 font-bold text-sm transition ${
              activeTab === 'excel' ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Excel出力
          </button>
          <button
            type="button"
            onClick={() => setTab('settings')}
            className={`px-6 py-3 font-bold text-sm transition ${
              activeTab === 'settings' ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            設定
          </button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-6">
        {initLoading ? (
          <div className="text-center py-12 text-slate-600">読み込み中…</div>
        ) : (
          <>
            {activeTab === 'preview' && (
              <AllowancePreviewPanel
                supabase={supabase}
                users={users}
                selectedYear={selectedYear}
                selectedMonth={selectedMonth}
                selectedUserId={selectedUserId}
                onYearChange={setSelectedYear}
                onMonthChange={setSelectedMonth}
                onUserChange={setSelectedUserId}
              />
            )}

            {activeTab === 'excel' && (
              <AllowanceExcelPanel
                supabase={supabase}
                users={users}
                selectedYear={selectedYear}
                selectedMonth={selectedMonth}
                selectedUserId={selectedUserId}
                onYearChange={setSelectedYear}
                onMonthChange={setSelectedMonth}
                onUserChange={setSelectedUserId}
              />
            )}

            {activeTab === 'settings' && (
              <div className="bg-white p-6 rounded-2xl shadow-md">
                <h2 className="text-xl font-bold text-slate-800 mb-4">手当項目・金額設定</h2>
                <div className="text-slate-500 text-sm">
                  <p>
                    現在、手当項目と金額は{' '}
                    <code className="bg-slate-100 px-2 py-1 rounded">utils/allowanceRules.ts</code>{' '}
                    で管理されています。
                  </p>
                  <p className="mt-2">将来的には、この画面からGUIで編集できるようにする予定です。</p>
                </div>
                <div className="mt-4 bg-slate-50 p-4 rounded-lg border border-slate-200">
                  <h3 className="font-bold text-slate-700 mb-2">現在の手当設定</h3>
                  <ul className="text-sm text-slate-600 space-y-1">
                    <li>• A:休日部活(1日) → 3,400円</li>
                    <li>• B:休日部活(半日) → 1,700円</li>
                    <li>• C:指定大会 → 3,400円</li>
                    <li>• D:指定外大会 → 2,400円</li>
                    <li>• E:遠征 → 3,000円</li>
                    <li>• F:合宿 → 5,000円</li>
                    <li>• G:引率 → 2,400円</li>
                    <li>• H:宿泊指導 → 6,000円</li>
                    <li>• 県外マイクロバス運転 → 15,000円</li>
                    <li>• 県内長距離運転 → 7,500円</li>
                  </ul>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

export default function AllowanceManagementPage() {
  return (
    <Suspense fallback={<div className="p-10 text-center">読み込み中…</div>}>
      <AllowanceManagementContent />
    </Suspense>
  )
}
