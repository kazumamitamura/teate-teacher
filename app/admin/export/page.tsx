'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import * as XLSX from 'xlsx'
import { useRequireAdmin } from '@/utils/useRequireAdmin'

export default function ExportPage() {
  const router = useRouter()
  const { loading: authLoading, authorized, supabase } = useRequireAdmin()

  const [loading, setLoading] = useState(false)
  const [users, setUsers] = useState<any[]>([])
  const [selectedUser, setSelectedUser] = useState('')
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1)

  useEffect(() => {
    if (authorized) fetchUsers()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authorized])

  const fetchUsers = async () => {
    console.log('ユーザープロフィール取得中...')
    const { data, error } = await supabase
      .from('user_profiles')
      .select('*')
      .order('display_name', { ascending: true, nullsFirst: false })
    
    if (error) {
      console.error('ユーザープロフィール取得エラー:', error)
    } else {
      console.log('ユーザープロフィール取得成功:', data)
    }
    // display_nameが空のユーザーには警告を付ける
    const usersWithWarning = (data || []).map(user => ({
      ...user,
      displayLabel: user.display_name || `${user.email} (⚠️氏名未登録)`
    }))
    setUsers(usersWithWarning)
  }

  // 個人月次レポート（帳票形式 - aoa_to_sheet使用）
  const exportIndividualMonthly = async () => {
    if (!selectedUser) {
      alert('職員を選択してください')
      return
    }

    setLoading(true)
    try {
      console.log('Step 1: データ取得開始')
      const yearMonth = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}`
      const lastDay = new Date(selectedYear, selectedMonth, 0).getDate()
      const endDate = `${yearMonth}-${String(lastDay).padStart(2, '0')}`
      
      // データ取得
      const { data: allowances, error: fetchError } = await supabase
        .from('allowances')
        .select('*')
        .eq('user_id', selectedUser)
        .gte('date', `${yearMonth}-01`)
        .lte('date', endDate)
        .order('date', { ascending: true })

      if (fetchError) {
        throw new Error(`データ取得エラー: ${fetchError.message}`)
      }

      console.log('Step 2: データ取得完了', { count: allowances?.length || 0 })

      const user = users.find(u => u.email === selectedUser || u.user_id === selectedUser)
      const userName = user?.display_name || selectedUser || 'unknown'
      
      console.log('Step 3: 合計計算開始')
      // 合計計算
      const total = (allowances || []).reduce((sum, item) => sum + (item.amount ?? 0), 0)
      const campCount = (allowances || []).filter(a => a.activity_type?.includes('合宿')).length || 0
      const expeditionCount = (allowances || []).filter(a => a.activity_type?.includes('遠征')).length || 0
      
      // 曜日を取得するヘルパー関数
      const getDayOfWeek = (dateStr: string) => {
        if (!dateStr) return ''
        const days = ['日', '月', '火', '水', '木', '金', '土']
        const date = new Date(dateStr)
        if (isNaN(date.getTime())) return ''
        return days[date.getDay()] || ''
      }
      
      console.log('Step 4: Excelデータ変換開始')
      // 【aoa_to_sheet を使用した帳票レイアウト】
      
      // 1行目: サマリー1（氏名と支給合計額）
      const headerRows = [
        ['氏名', `${userName} 様`, '支給合計額', total],  // B列に氏名、D列に金額（数値型）
        ['対象月', `${selectedYear}年${selectedMonth}月`, '活動内訳', `合宿:${campCount}日 / 遠征:${expeditionCount}日`],  // 2行目
        [],  // 3行目: 空行（見やすくするため）
        ['日付', '曜日', '手当区分', '業務内容', '宿泊', '運転', '金額']  // 4行目: テーブルヘッダー
      ]
      
      // 5行目以降: 明細データ（ボディ部分）
      const bodyRows = (allowances || []).map(record => [
        record.date || '',                        // A列: 日付
        getDayOfWeek(record.date || ''),          // B列: 曜日
        record.activity_type || '',               // C列: 手当区分
        record.destination_detail || '-',         // D列: 業務内容
        record.is_accommodation ? '○' : '',       // E列: 宿泊
        record.is_driving ? '○' : '',             // F列: 運転
        record.amount ?? 0                        // G列: 金額（数値型で出力）
      ])
      
      // 合計行
      const totalRow = ['合計', '', '', '', '', '', total]  // G列に合計金額
      
      console.log('Step 5: ExcelJSワークブック作成')
      // 結合してシート化
      const allRows = [...headerRows, ...bodyRows, totalRow]
      const ws = XLSX.utils.aoa_to_sheet(allRows)
      
      // 列幅の調整（見切れ防止）
      ws['!cols'] = [
        { wch: 12 },  // A: 日付
        { wch: 5 },   // B: 曜日
        { wch: 25 },  // C: 手当区分
        { wch: 30 },  // D: 業務内容
        { wch: 5 },   // E: 宿泊
        { wch: 5 },   // F: 運転
        { wch: 10 }   // G: 金額
      ]
      
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, '手当申請書')
      
      console.log('Step 6: ファイル書き出し開始')
      // ファイル名: YYYY-MM_手当申請書_[氏名].xlsx
      const fileName = `${yearMonth}_手当申請書_${userName}.xlsx`
      XLSX.writeFile(wb, fileName)
      
      console.log('Step 7: ファイル書き出し完了')
      alert('✅ ダウンロードしました！\n\n帳票形式（氏名・サマリー付き）で出力されています。')
    } catch (error) {
      console.error('Excel生成エラー:', error)
      alert('Excel出力に失敗しました。詳細はコンソールを確認してください。')
    } finally {
      setLoading(false)
    }
  }

  // 個人年次レポート（帳票形式 - aoa_to_sheet使用）
  const exportIndividualYearly = async () => {
    if (!selectedUser) {
      alert('職員を選択してください')
      return
    }

    setLoading(true)
    try {
      console.log('Step 1: データ取得開始')
      // データ取得
      const { data: allowances, error: fetchError } = await supabase
        .from('allowances')
        .select('*')
        .eq('user_id', selectedUser)
        .gte('date', `${selectedYear}-01-01`)
        .lte('date', `${selectedYear}-12-31`)
        .order('date', { ascending: true })

      if (fetchError) {
        throw new Error(`データ取得エラー: ${fetchError.message}`)
      }

      console.log('Step 2: データ取得完了', { count: allowances?.length || 0 })

      const user = users.find(u => u.email === selectedUser || u.user_id === selectedUser)
      const userName = user?.display_name || selectedUser || 'unknown'
      
      console.log('Step 3: 月別集計計算開始')
      // 月別集計
      const monthlyTotals: Record<number, number> = {}
      (allowances || []).forEach(item => {
        if (!item.date) return
        const month = parseInt(item.date.split('-')[1])
        if (!isNaN(month) && month >= 1 && month <= 12) {
          monthlyTotals[month] = (monthlyTotals[month] || 0) + (item.amount ?? 0)
        }
      })

      // 合計計算
      const total = Object.values(monthlyTotals).reduce((sum, val) => sum + val, 0)
      const campCount = (allowances || []).filter(a => a.activity_type?.includes('合宿')).length || 0
      const expeditionCount = (allowances || []).filter(a => a.activity_type?.includes('遠征')).length || 0

      console.log('Step 4: Excelデータ変換開始')
      // 【aoa_to_sheet を使用した帳票レイアウト】
      
      // 1行目: サマリー1（氏名と支給合計額）
      const headerRows = [
        ['氏名', `${userName} 様`, '年間支給合計額', total],  // B列に氏名、D列に金額（数値型）
        ['対象年', `${selectedYear}年`, '活動内訳', `合宿:${campCount}日 / 遠征:${expeditionCount}日`],  // 2行目
        [],  // 3行目: 空行
        ['月', '件数', '金額']  // 4行目: テーブルヘッダー
      ]
      
      // 5行目以降: 月別データ
      const bodyRows = Array.from({ length: 12 }, (_, i) => {
        const month = i + 1
        const count = (allowances || []).filter(a => a.date && parseInt(a.date.split('-')[1]) === month).length || 0
        return [
          `${month}月`,                // A列: 月
          count,                       // B列: 件数（数値型）
          monthlyTotals[month] || 0    // C列: 金額（数値型）
        ]
      })
      
      // 合計行
      const totalRow = ['年間合計', allowances?.length || 0, total]  // 件数と金額は数値型
      
      console.log('Step 5: ExcelJSワークブック作成')
      // 結合してシート化
      const allRows = [...headerRows, ...bodyRows, totalRow]
      const ws = XLSX.utils.aoa_to_sheet(allRows)
      
      // 列幅設定
      ws['!cols'] = [
        { wch: 15 },  // A: 月
        { wch: 12 },  // B: 件数
        { wch: 15 }   // C: 金額
      ]
      
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, '年間集計')
      
      console.log('Step 6: ファイル書き出し開始')
      // ファイル名: YYYY_手当年間集計_[氏名].xlsx
      const fileName = `${selectedYear}_手当年間集計_${userName}.xlsx`
      XLSX.writeFile(wb, fileName)
      
      console.log('Step 7: ファイル書き出し完了')
      alert('✅ ダウンロードしました！\n\n帳票形式（氏名・サマリー付き）で出力されています。')
    } catch (error) {
      console.error('Excel生成エラー:', error)
      alert('Excel出力に失敗しました。詳細はコンソールを確認してください。')
    } finally {
      setLoading(false)
    }
  }

  // 全体月次レポート（帳票形式 - aoa_to_sheet使用）
  const exportAllMonthly = async () => {
    setLoading(true)
    try {
      console.log('Step 1: データ取得開始')
      const yearMonth = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}`
      const lastDay = new Date(selectedYear, selectedMonth, 0).getDate()
      const endDate = `${yearMonth}-${String(lastDay).padStart(2, '0')}`
      
      // データ取得
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
      // ユーザー別集計
      const userTotals: Record<string, { name: string, count: number, amount: number, camp: number, expedition: number }> = {}
      (allowances || []).forEach(item => {
        if (!item.user_email) return
        if (!userTotals[item.user_email]) {
          const user = users.find(u => u.email === item.user_email)
          userTotals[item.user_email] = {
            name: user?.display_name || item.user_email || '',
            count: 0,
            amount: 0,
            camp: 0,
            expedition: 0
          }
        }
        userTotals[item.user_email].count++
        userTotals[item.user_email].amount += (item.amount ?? 0)
        if (item.activity_type?.includes('合宿')) userTotals[item.user_email].camp++
        if (item.activity_type?.includes('遠征')) userTotals[item.user_email].expedition++
      })

      // 合計計算
      const totalCount = Object.values(userTotals).reduce((sum, data) => sum + (data.count || 0), 0)
      const totalAmount = Object.values(userTotals).reduce((sum, data) => sum + (data.amount || 0), 0)
      const totalCamp = Object.values(userTotals).reduce((sum, data) => sum + (data.camp || 0), 0)
      const totalExpedition = Object.values(userTotals).reduce((sum, data) => sum + (data.expedition || 0), 0)

      console.log('Step 4: Excelデータ変換開始')
      // 【aoa_to_sheet を使用した帳票レイアウト】
      
      // 1行目: サマリー1（タイトルと支給合計額）
      const headerRows = [
        ['手当全体集計（月次）', '', '支給合計額', totalAmount],  // D列に金額（数値型）
        ['対象月', `${selectedYear}年${selectedMonth}月`, '活動内訳', `合宿:${totalCamp}日 / 遠征:${totalExpedition}日`],  // 2行目
        [],  // 3行目: 空行
        ['職員名', '件数', '金額', '合宿日数', '遠征日数']  // 4行目: テーブルヘッダー
      ]
      
      // 5行目以降: 職員別データ
      const bodyRows = Object.entries(userTotals).map(([email, data]) => [
        data.name || '',       // A列: 職員名
        data.count || 0,       // B列: 件数（数値型）
        data.amount || 0,       // C列: 金額（数値型）
        data.camp || 0,         // D列: 合宿日数（数値型）
        data.expedition || 0    // E列: 遠征日数（数値型）
      ])
      
      // 合計行
      const totalRow = ['合計', totalCount, totalAmount, totalCamp, totalExpedition]  // すべて数値型
      
      console.log('Step 5: ExcelJSワークブック作成')
      // 結合してシート化
      const allRows = [...headerRows, ...bodyRows, totalRow]
      const ws = XLSX.utils.aoa_to_sheet(allRows)
      
      // 列幅設定
      ws['!cols'] = [
        { wch: 20 },  // A: 職員名
        { wch: 10 },  // B: 件数
        { wch: 15 },  // C: 金額
        { wch: 12 },  // D: 合宿日数
        { wch: 12 }   // E: 遠征日数
      ]
      
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, '全体集計')
      
      console.log('Step 6: ファイル書き出し開始')
      // ファイル名: YYYY-MM_全体集計.xlsx
      XLSX.writeFile(wb, `${yearMonth}_全体集計.xlsx`)
      
      console.log('Step 7: ファイル書き出し完了')
      alert('✅ ダウンロードしました！\n\n帳票形式（サマリー付き）で出力されています。')
    } catch (error) {
      console.error('Excel生成エラー:', error)
      alert('Excel出力に失敗しました。詳細はコンソールを確認してください。')
    } finally {
      setLoading(false)
    }
  }

  // 全体年次レポート（帳票形式 - aoa_to_sheet使用）
  const exportAllYearly = async () => {
    setLoading(true)
    try {
      console.log('Step 1: データ取得開始')
      // データ取得
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
      // ユーザー別集計
      const userTotals: Record<string, { name: string, count: number, amount: number, camp: number, expedition: number }> = {}
      (allowances || []).forEach(item => {
        if (!item.user_email) return
        if (!userTotals[item.user_email]) {
          const user = users.find(u => u.email === item.user_email)
          userTotals[item.user_email] = {
            name: user?.display_name || item.user_email || '',
            count: 0,
            amount: 0,
            camp: 0,
            expedition: 0
          }
        }
        userTotals[item.user_email].count++
        userTotals[item.user_email].amount += (item.amount ?? 0)
        if (item.activity_type?.includes('合宿')) userTotals[item.user_email].camp++
        if (item.activity_type?.includes('遠征')) userTotals[item.user_email].expedition++
      })

      // 合計計算
      const totalCount = Object.values(userTotals).reduce((sum, data) => sum + (data.count || 0), 0)
      const totalAmount = Object.values(userTotals).reduce((sum, data) => sum + (data.amount || 0), 0)
      const totalCamp = Object.values(userTotals).reduce((sum, data) => sum + (data.camp || 0), 0)
      const totalExpedition = Object.values(userTotals).reduce((sum, data) => sum + (data.expedition || 0), 0)

      console.log('Step 4: Excelデータ変換開始')
      // 【aoa_to_sheet を使用した帳票レイアウト】
      
      // 1行目: サマリー1（タイトルと支給合計額）
      const headerRows = [
        ['手当年間全体集計', '', '年間支給合計額', totalAmount],  // D列に金額（数値型）
        ['対象年', `${selectedYear}年`, '活動内訳', `合宿:${totalCamp}日 / 遠征:${totalExpedition}日`],  // 2行目
        [],  // 3行目: 空行
        ['職員名', '件数', '金額', '合宿日数', '遠征日数']  // 4行目: テーブルヘッダー
      ]
      
      // 5行目以降: 職員別データ
      const bodyRows = Object.entries(userTotals).map(([email, data]) => [
        data.name || '',       // A列: 職員名
        data.count || 0,       // B列: 件数（数値型）
        data.amount || 0,       // C列: 金額（数値型）
        data.camp || 0,         // D列: 合宿日数（数値型）
        data.expedition || 0    // E列: 遠征日数（数値型）
      ])
      
      // 合計行
      const totalRow = ['合計', totalCount, totalAmount, totalCamp, totalExpedition]  // すべて数値型
      
      console.log('Step 5: ExcelJSワークブック作成')
      // 結合してシート化
      const allRows = [...headerRows, ...bodyRows, totalRow]
      const ws = XLSX.utils.aoa_to_sheet(allRows)
      
      // 列幅設定
      ws['!cols'] = [
        { wch: 20 },  // A: 職員名
        { wch: 10 },  // B: 件数
        { wch: 15 },  // C: 金額
        { wch: 12 },  // D: 合宿日数
        { wch: 12 }   // E: 遠征日数
      ]
      
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, '年間全体集計')
      
      console.log('Step 6: ファイル書き出し開始')
      // ファイル名: YYYY_年間全体集計.xlsx
      XLSX.writeFile(wb, `${selectedYear}_年間全体集計.xlsx`)
      
      console.log('Step 7: ファイル書き出し完了')
      alert('✅ ダウンロードしました！\n\n帳票形式（サマリー付き）で出力されています。')
    } catch (error) {
      console.error('Excel生成エラー:', error)
      alert('Excel出力に失敗しました。詳細はコンソールを確認してください。')
    } finally {
      setLoading(false)
    }
  }

  if (authLoading || !authorized) return <div className="p-10 text-center">確認中...</div>

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-green-100">
      {/* ヘッダー */}
      <div className="bg-green-600 text-white p-4 shadow-md sticky top-0 z-20 flex justify-between items-center">
        <h1 className="font-bold text-lg flex items-center gap-2">
            <span className="text-2xl">📊</span> Excel出力センター
        </h1>
        <button onClick={() => router.push('/admin')} className="text-xs bg-green-700 px-4 py-2 rounded hover:bg-green-800 font-bold border border-green-500">
            ← ダッシュボードへ
        </button>
      </div>

      <div className="max-w-6xl mx-auto p-6">
        
        {/* 重要なお知らせ */}
        <div className="bg-blue-50 border-l-4 border-blue-500 p-4 mb-6 rounded-md">
          <p className="text-sm text-blue-800">
            <strong>📊 帳票形式で出力されます</strong><br />
            ※出力されるExcelには、氏名・合計金額・合宿/遠征日数がヘッダーに自動で記載されます。<br />
            ※経理担当者がそのまま確認・決済に使用できる帳票レイアウトです。
          </p>
        </div>

        {/* 出力条件設定 */}
        <div className="bg-white p-6 rounded-2xl shadow-md mb-6">
          <h2 className="text-xl font-bold text-slate-800 mb-4">出力条件</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-bold text-slate-600 mb-2">職員（個人レポート用）</label>
              <select 
                value={selectedUser} 
                onChange={(e) => setSelectedUser(e.target.value)}
                className="w-full p-3 border rounded-lg font-bold text-sm"
              >
                <option value="">選択してください</option>
                {users.map(user => (
                  <option key={user.user_id} value={user.user_id}>
                    {user.display_name || `${user.email} (⚠️氏名未登録)`}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-600 mb-2">年</label>
              <select 
                value={selectedYear} 
                onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                className="w-full p-3 border rounded-lg font-bold text-sm"
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
                className="w-full p-3 border rounded-lg font-bold text-sm"
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
          
          {/* 個人月次 */}
          <button 
            onClick={exportIndividualMonthly}
            disabled={loading || !selectedUser}
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
              {selectedUser ? (users.find(u => u.user_id === selectedUser || u.email === selectedUser)?.display_name || '氏名未登録') : '職員未選択'} / {selectedYear}年{selectedMonth}月
            </div>
          </button>

          {/* 個人年次 */}
          <button 
            onClick={exportIndividualYearly}
            disabled={loading || !selectedUser}
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
              {selectedUser ? (users.find(u => u.user_id === selectedUser || u.email === selectedUser)?.display_name || '氏名未登録') : '職員未選択'} / {selectedYear}年
            </div>
          </button>

          {/* 全体月次 */}
          <button 
            onClick={exportAllMonthly}
            disabled={loading}
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

          {/* 全体年次 */}
          <button 
            onClick={exportAllYearly}
            disabled={loading}
            className="bg-gradient-to-br from-green-500 to-green-600 p-8 rounded-2xl shadow-md hover:shadow-xl transition-all text-left group"
          >
            <div className="text-5xl mb-4 text-white">📈</div>
            <h3 className="text-2xl font-bold text-white mb-2">
              全体年次レポート
            </h3>
            <p className="text-green-50 text-sm mb-3">
              全職員の年間手当を集計
            </p>
            <div className="text-xs text-green-100">
              全職員 / {selectedYear}年
            </div>
          </button>

        </div>

        {loading && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white p-8 rounded-2xl shadow-xl text-center">
              <div className="text-4xl mb-4">⏳</div>
              <div className="text-lg font-bold text-slate-800">処理中...</div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
