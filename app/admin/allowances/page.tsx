'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useRequireAdmin } from '@/utils/useRequireAdmin'
import { handleSupabaseError, logSupabaseError } from '@/utils/supabase/errorHandler'
import * as XLSX from 'xlsx'

type Allowance = {
  date: string
  activity_type: string
  amount: number
  destination_type: string
  destination_detail: string
}

/** Supabase allowances 行（select('*') の戻り値で user_email を含む） */
type AllowanceRow = {
  user_email?: string | null
  amount?: number | null
  date?: string
  activity_type?: string
  [key: string]: unknown
}

export default function AllowanceManagementPage() {
  const router = useRouter()
  const { profile, loading: authLoading, authorized, supabase } = useRequireAdmin()

  const [loading, setLoading] = useState(true)
  const [userEmail, setUserEmail] = useState('')
  
  // タブ管理（承認システム廃止のため Excel出力をデフォルト）
  const [activeTab, setActiveTab] = useState<'export' | 'settings'>('export')

  // Excel出力タブ用
  const [users, setUsers] = useState<any[]>([])
  const [selectedUser, setSelectedUser] = useState('')
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1)
  const [exporting, setExporting] = useState(false)

  // 設定タブ用 - 将来的に手当項目の設定が必要な場合
  const [allowanceSettings, setAllowanceSettings] = useState<any[]>([])

  useEffect(() => {
    if (authorized && profile) {
      setUserEmail(profile.email)
      fetchUsers().finally(() => setLoading(false))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authorized, profile])

  const fetchUsers = async () => {
    try {
      const { data, error } = await supabase.from('user_profiles').select('*').order('display_name')
      if (error) {
        logSupabaseError('ユーザー一覧取得', error)
      }
      setUsers(data || [])
    } catch (error) {
      console.error('ユーザー取得エラー:', error)
      setUsers([])
    }
  }

  // Excel出力機能
  const exportIndividualMonthly = async () => {
    if (!selectedUser) {
      alert('職員を選択してください')
      return
    }

    setExporting(true)
    try {
      console.log('Step 1: データ取得開始')
      const yearMonth = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}`
      const lastDay = new Date(selectedYear, selectedMonth, 0).getDate()
      const endDate = `${yearMonth}-${String(lastDay).padStart(2, '0')}`
      
      const { data: allowances, error: fetchError } = await supabase
        .from('allowances')
        .select('*')
        .eq('user_email', selectedUser)
        .gte('date', `${yearMonth}-01`)
        .lte('date', endDate)
        .order('date')

      if (fetchError) {
        throw new Error(`データ取得エラー: ${fetchError.message}`)
      }

      console.log('Step 2: データ取得完了', { count: allowances?.length || 0 })

      const user = users.find(u => u.email === selectedUser)
      
      console.log('Step 3: Excelデータ変換開始')
      const excelData = (allowances || []).map(item => ({
        '日付': item.date || '',
        '業務内容': item.activity_type || '',
        '区分': item.destination_type || '',
        '詳細': item.destination_detail || '',
        '運転': item.is_driving ? '○' : '',
        '宿泊': item.is_accommodation ? '○' : '',
        '金額': item.amount ?? 0
      }))

      const total = (allowances || []).reduce((sum, item) => sum + (item.amount ?? 0), 0)
      excelData.push({
        '日付': '合計',
        '業務内容': '',
        '区分': '',
        '詳細': '',
        '運転': '',
        '宿泊': '',
        '金額': total
      })

      console.log('Step 4: ExcelJSワークブック作成')
      const ws = XLSX.utils.json_to_sheet(excelData)
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, '手当明細')
      
      console.log('Step 5: ファイル書き出し開始')
      const fileName = `手当明細_${user?.display_name || selectedUser || 'unknown'}_${yearMonth}.xlsx`
      XLSX.writeFile(wb, fileName)
      
      // ファイル書き出しは同期的だが、ブラウザの処理を待つため少し待機
      await new Promise(resolve => setTimeout(resolve, 100))
      
      console.log('Step 6: ファイル書き出し完了')
      alert('ダウンロードしました！')
    } catch (error) {
      console.error('Excel生成エラー:', error)
      alert('Excel出力に失敗しました。詳細はコンソールを確認してください。\n\nエラー: ' + (error instanceof Error ? error.message : String(error)))
    } finally {
      console.log('Step 7: 処理完了、ローディング解除')
      setExporting(false)
    }
  }

  const exportIndividualYearly = async () => {
    if (!selectedUser) {
      alert('職員を選択してください')
      return
    }

    setExporting(true)
    try {
      console.log('Step 1: データ取得開始')
      const { data: allowances, error: fetchError } = await supabase
        .from('allowances')
        .select('*')
        .eq('user_email', selectedUser)
        .gte('date', `${selectedYear}-01-01`)
        .lte('date', `${selectedYear}-12-31`)
        .order('date')

      if (fetchError) {
        throw new Error(`データ取得エラー: ${fetchError.message}`)
      }

      console.log('Step 2: データ取得完了', { count: allowances?.length || 0 })

      const user = users.find(u => u.email === selectedUser)
      
      console.log('Step 3: 月次集計計算開始')
      const monthlyTotals: Record<number, number> = {}
      const monthlyCounts: Record<number, number> = {}
      for (const item of allowances || []) {
        const dateStr = item?.date
        if (!dateStr || typeof dateStr !== 'string') continue
        const parts = dateStr.split('-')
        const month = parseInt(parts[1] || '', 10)
        if (Number.isNaN(month) || month < 1 || month > 12) continue
        monthlyTotals[month] = (monthlyTotals[month] || 0) + (item.amount ?? 0)
        monthlyCounts[month] = (monthlyCounts[month] || 0) + 1
      }

      console.log('Step 4: Excelデータ変換開始')
      const excelData: Array<{ '月': string; '件数': number; '金額': number }> = []
      let total = 0
      for (let month = 1; month <= 12; month++) {
        const amount = monthlyTotals[month] || 0
        const count = monthlyCounts[month] || 0
        total += amount
        excelData.push({
          '月': `${month}月`,
          '件数': count,
          '金額': amount
        })
      }

      excelData.push({
        '月': '年間合計',
        '件数': (allowances || []).length,
        '金額': total
      })

      console.log('Step 5: ExcelJSワークブック作成')
      const ws = XLSX.utils.json_to_sheet(excelData)
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, '年間集計')
      
      console.log('Step 6: ファイル書き出し開始')
      const fileName = `手当年間集計_${user?.display_name || selectedUser || 'unknown'}_${selectedYear}.xlsx`
      XLSX.writeFile(wb, fileName)
      
      // ファイル書き出しは同期的だが、ブラウザの処理を待つため少し待機
      await new Promise(resolve => setTimeout(resolve, 100))
      
      console.log('Step 7: ファイル書き出し完了')
      alert('ダウンロードしました！')
    } catch (error) {
      console.error('Excel生成エラー:', error)
      alert('Excel出力に失敗しました。詳細はコンソールを確認してください。\n\nエラー: ' + (error instanceof Error ? error.message : String(error)))
    } finally {
      console.log('Step 8: 処理完了、ローディング解除')
      setExporting(false)
    }
  }

  const exportAllMonthly = async () => {
    setExporting(true)
    try {
      console.log('Step 1: データ取得開始')
      const yearMonth = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}`
      const lastDay = new Date(selectedYear, selectedMonth, 0).getDate()
      const endDate = `${yearMonth}-${String(lastDay).padStart(2, '0')}`
      
      const { data: allowances, error: fetchError } = await supabase
        .from('allowances')
        .select('*')
        .gte('date', `${yearMonth}-01`)
        .lte('date', endDate)
        .order('user_email')

      if (fetchError) {
        throw new Error(`データ取得エラー: ${fetchError.message}`)
      }

      console.log('Step 2: データ取得完了', { count: allowances?.length || 0 })

      console.log('Step 3: ユーザー別集計計算開始')
      const userTotals: Record<string, { name: string, count: number, amount: number }> = {}
      for (const item of allowances || []) {
        const email = item?.user_email
        if (!email || typeof email !== 'string') continue
        if (!userTotals[email]) {
          const user = users.find(u => u.email === email)
          userTotals[email] = {
            name: user?.display_name || email || '',
            count: 0,
            amount: 0
          }
        }
        userTotals[email].count++
        userTotals[email].amount += (item.amount ?? 0)
      }

      console.log('Step 4: Excelデータ変換開始')
      const excelData: Array<{ '職員名': string; 'メールアドレス': string; '件数': number; '金額': number }> = []
      let totalCount = 0
      let totalAmount = 0
      for (const email in userTotals) {
        const data = userTotals[email]
        const count = data?.count || 0
        const amount = data?.amount || 0
        totalCount += count
        totalAmount += amount
        excelData.push({
          '職員名': data?.name || '',
          'メールアドレス': email,
          '件数': count,
          '金額': amount
        })
      }

      excelData.push({
        '職員名': '合計',
        'メールアドレス': '',
        '件数': totalCount,
        '金額': totalAmount
      })

      console.log('Step 5: ExcelJSワークブック作成')
      const ws = XLSX.utils.json_to_sheet(excelData)
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, '全体集計')
      
      console.log('Step 6: ファイル書き出し開始')
      const fileName = `手当全体集計_${yearMonth}.xlsx`
      XLSX.writeFile(wb, fileName)
      
      // ファイル書き出しは同期的だが、ブラウザの処理を待つため少し待機
      await new Promise(resolve => setTimeout(resolve, 100))
      
      console.log('Step 7: ファイル書き出し完了')
      alert('ダウンロードしました！')
    } catch (error) {
      console.error('Excel生成エラー:', error)
      alert('Excel出力に失敗しました。詳細はコンソールを確認してください。\n\nエラー: ' + (error instanceof Error ? error.message : String(error)))
    } finally {
      console.log('Step 8: 処理完了、ローディング解除')
      setExporting(false)
    }
  }

  const exportAllYearly = async () => {
    console.log('=== exportAllYearly 関数が呼び出されました ===')
    console.log('現在の状態:', { exporting, loading, selectedYear })
    setExporting(true)
    console.log('setExporting(true) 実行完了')
    try {
      console.log('Step 1: データ取得開始')
      const { data: allowances, error: fetchError } = await supabase
        .from('allowances')
        .select('*')
        .gte('date', `${selectedYear}-01-01`)
        .lte('date', `${selectedYear}-12-31`)
        .order('user_email')

      if (fetchError) {
        throw new Error(`データ取得エラー: ${fetchError.message}`)
      }

      console.log('Step 2: データ取得完了', { count: allowances?.length || 0 })

      console.log('Step 3: ユーザー別集計計算開始')
      const userTotals: Record<string, { name: string, count: number, amount: number }> = {}
      const rawAllowances: AllowanceRow[] = allowances ?? []
      for (const item of rawAllowances) {
        const email = item?.user_email
        if (!email || typeof email !== 'string') continue
        if (!userTotals[email]) {
          const user = users.find((u: { email?: string }) => u?.email === email)
          userTotals[email] = {
            name: user?.display_name || email || '',
            count: 0,
            amount: 0
          }
        }
        userTotals[email].count++
        userTotals[email].amount += (item?.amount ?? 0)
      }

      console.log('Step 4: Excelデータ変換開始')
      const excelData: Array<{ '職員名': string; 'メールアドレス': string; '件数': number; '金額': number }> = []
      let totalCount = 0
      let totalAmount = 0
      for (const email in userTotals) {
        const data = userTotals[email]
        const count = data?.count ?? 0
        const amount = data?.amount ?? 0
        totalCount += count
        totalAmount += amount
        excelData.push({
          '職員名': data?.name ?? '',
          'メールアドレス': email,
          '件数': count,
          '金額': amount
        })
      }

      excelData.push({
        '職員名': '合計',
        'メールアドレス': '',
        '件数': totalCount,
        '金額': totalAmount
      })

      console.log('Step 5: ExcelJSワークブック作成')
      const ws = XLSX.utils.json_to_sheet(excelData)
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, '年間全体集計')
      
      console.log('Step 6: ファイル書き出し開始')
      const fileName = `手当年間全体集計_${selectedYear}.xlsx`
      XLSX.writeFile(wb, fileName)
      
      // ファイル書き出しは同期的だが、ブラウザの処理を待つため少し待機
      await new Promise(resolve => setTimeout(resolve, 100))
      
      console.log('Step 7: ファイル書き出し完了')
      alert('ダウンロードしました！')
    } catch (error) {
      console.error('Excel生成エラー:', error)
      alert('Excel出力に失敗しました。詳細はコンソールを確認してください。\n\nエラー: ' + (error instanceof Error ? error.message : String(error)))
    } finally {
      console.log('Step 8: 処理完了、ローディング解除')
      setExporting(false)
    }
  }

  if (authLoading || !authorized) return <div className="p-10 text-center">確認中...</div>

  return (
    <div className="min-h-screen bg-slate-50">
      {/* ヘッダー */}
      <div className="bg-blue-600 text-white p-4 shadow-md sticky top-0 z-20">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <h1 className="font-bold text-lg flex items-center gap-2">
            <span className="text-2xl">💰</span> 手当管理（担当：友野・武田事務長）
          </h1>
          <button onClick={() => router.push('/admin')} className="text-xs bg-blue-700 px-4 py-2 rounded hover:bg-blue-800 font-bold border border-blue-500">
            ← ダッシュボードへ
          </button>
        </div>
      </div>

      {/* タブナビゲーション */}
      <div className="bg-white border-b border-slate-200 sticky top-[60px] z-10">
        <div className="max-w-7xl mx-auto flex gap-1 px-6">
          <button 
            onClick={() => setActiveTab('export')}
            className={`px-6 py-3 font-bold text-sm transition ${activeTab === 'export' ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
          >
            Excel出力
          </button>
          <button 
            onClick={() => setActiveTab('settings')}
            className={`px-6 py-3 font-bold text-sm transition ${activeTab === 'settings' ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
          >
            設定
          </button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-6">
        {/* Excel出力タブ */}
        {activeTab === 'export' && (
          <div>
            {/* 出力条件設定 */}
            <div className="bg-white p-6 rounded-2xl shadow-md mb-6">
              <h2 className="text-xl font-bold text-slate-800 mb-4">出力条件</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-bold text-slate-600 mb-2">職員（個人レポート用）</label>
                  <select 
                    value={selectedUser} 
                    onChange={(e) => setSelectedUser(e.target.value)}
                    className="w-full p-3 border rounded-lg font-bold text-sm text-black"
                  >
                    <option value="">選択してください</option>
                    {users.map(user => (
                      <option key={user.email} value={user.email}>
                        {user.display_name || user.email}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-600 mb-2">年</label>
                  <select 
                    value={selectedYear} 
                    onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                    className="w-full p-3 border rounded-lg font-bold text-sm text-black"
                  >
                    {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i).map(year => (
                      <option key={year} value={year}>{year}年</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-600 mb-2">月</label>
                  <select 
                    value={selectedMonth} 
                    onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
                    className="w-full p-3 border rounded-lg font-bold text-sm text-black"
                  >
                    {Array.from({ length: 12 }, (_, i) => i + 1).map(month => (
                      <option key={month} value={month}>{month}月</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* 出力ボタン */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <button 
                onClick={exportIndividualMonthly}
                disabled={exporting || !selectedUser}
                className="bg-white p-8 rounded-2xl shadow-md hover:shadow-xl transition-all text-left group border-2 border-transparent hover:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <div className="text-5xl mb-4">👤</div>
                <h3 className="text-2xl font-bold text-slate-800 mb-2 group-hover:text-blue-600 transition">
                  個人月次レポート
                </h3>
                <p className="text-slate-500 text-sm mb-3">
                  選択した職員の指定月の手当明細を出力
                </p>
                <div className="text-xs text-slate-400">
                  {selectedUser ? users.find(u => u.email === selectedUser)?.display_name : '職員未選択'} / {selectedYear}年{selectedMonth}月
                </div>
              </button>

              <button 
                onClick={exportIndividualYearly}
                disabled={exporting || !selectedUser}
                className="bg-white p-8 rounded-2xl shadow-md hover:shadow-xl transition-all text-left group border-2 border-transparent hover:border-purple-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <div className="text-5xl mb-4">📅</div>
                <h3 className="text-2xl font-bold text-slate-800 mb-2 group-hover:text-purple-600 transition">
                  個人年次レポート
                </h3>
                <p className="text-slate-500 text-sm mb-3">
                  選択した職員の年間手当を月別集計
                </p>
                <div className="text-xs text-slate-400">
                  {selectedUser ? users.find(u => u.email === selectedUser)?.display_name : '職員未選択'} / {selectedYear}年
                </div>
              </button>

              <button 
                onClick={exportAllMonthly}
                disabled={exporting}
                className="bg-white p-8 rounded-2xl shadow-md hover:shadow-xl transition-all text-left group border-2 border-transparent hover:border-green-500"
              >
                <div className="text-5xl mb-4">👥</div>
                <h3 className="text-2xl font-bold text-slate-800 mb-2 group-hover:text-green-600 transition">
                  全体月次レポート
                </h3>
                <p className="text-slate-500 text-sm mb-3">
                  全職員の指定月の手当を集計
                </p>
                <div className="text-xs text-slate-400">
                  全職員 / {selectedYear}年{selectedMonth}月
                </div>
              </button>

              <button 
                onClick={(e) => {
                  console.log('全体年次レポートボタンがクリックされました', e)
                  e.preventDefault()
                  exportAllYearly().catch(err => {
                    console.error('exportAllYearly 実行エラー:', err)
                    setExporting(false)
                    alert('エラーが発生しました: ' + (err instanceof Error ? err.message : String(err)))
                  })
                }}
                disabled={exporting}
                className="bg-gradient-to-br from-blue-500 to-blue-600 p-8 rounded-2xl shadow-md hover:shadow-xl transition-all text-left group"
              >
                <div className="text-5xl mb-4 text-white">📈</div>
                <h3 className="text-2xl font-bold text-white mb-2">
                  全体年次レポート
                </h3>
                <p className="text-blue-50 text-sm mb-3">
                  全職員の年間手当を集計
                </p>
                <div className="text-xs text-blue-100">
                  全職員 / {selectedYear}年
                </div>
              </button>
            </div>
          </div>
        )}

        {/* 設定タブ */}
        {activeTab === 'settings' && (
          <div className="bg-white p-6 rounded-2xl shadow-md">
            <h2 className="text-xl font-bold text-slate-800 mb-4">手当項目・金額設定</h2>
            <div className="text-slate-500 text-sm">
              <p>現在、手当項目と金額は <code className="bg-slate-100 px-2 py-1 rounded">utils/allowanceRules.ts</code> で管理されています。</p>
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

        {/* ローディングオーバーレイ */}
        {(loading || exporting) && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white p-8 rounded-2xl shadow-xl text-center">
              <div className="text-4xl mb-4">⏳</div>
              <div className="text-lg font-bold text-slate-800">処理中...</div>
              <div className="text-xs text-slate-500 mt-2">
                {loading ? '初期化中...' : 'Excel生成中...'}
              </div>
              {/* デバッグ用: 強制解除ボタン（開発時のみ） */}
              {(loading || exporting) && (
                <button
                  onClick={() => {
                    console.warn('⚠️ ローディングを強制解除しました')
                    setLoading(false)
                    setExporting(false)
                  }}
                  className="mt-4 px-4 py-2 bg-red-500 text-white rounded text-xs"
                >
                  強制解除（デバッグ用）
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
