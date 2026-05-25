'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { logout } from '@/app/auth/actions'
import { useRequireAdmin } from '@/utils/useRequireAdmin'

type AllowanceType = {
  id: number
  code: string
  display_name: string
  base_amount: number
  requires_holiday: boolean
  created_at: string
  updated_at: string
}

export default function AllowanceSettingsPage() {
  const router = useRouter()
  const { loading: authLoading, authorized, supabase } = useRequireAdmin()

  const [loading, setLoading] = useState(true)
  const [allowanceTypes, setAllowanceTypes] = useState<AllowanceType[]>([])  // 空配列で初期化
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editForm, setEditForm] = useState({ display_name: '', base_amount: 0 })
  const [showAddModal, setShowAddModal] = useState(false)
  const [newType, setNewType] = useState({
    code: '',
    display_name: '',
    base_amount: 0,
    requires_holiday: false
  })

  useEffect(() => {
    if (authorized) fetchAllowanceTypes()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authorized])

  if (authLoading || !authorized) {
    return <div className="p-10 text-center">確認中...</div>
  }

  const fetchAllowanceTypes = async () => {
    setLoading(true)
    try {
      console.log('手当設定データ取得開始')
      const { data, error } = await supabase
        .from('allowance_types')
        .select('*')
        .order('code', { ascending: true })
      
      console.log('取得結果:', { data, error })
      
      if (error) {
        console.error('手当設定取得エラー:', error)
        // エラーメッセージを表示せず、空配列を設定
        setAllowanceTypes([])
      } else {
        setAllowanceTypes(data || [])
        if (!data || data.length === 0) {
          console.warn('手当設定データが0件です')
        } else {
          console.log(`手当設定データ ${data.length} 件を取得しました`)
        }
      }
    } catch (err) {
      console.error('予期しないエラー:', err)
      // エラーメッセージを表示せず、空配列を設定
      setAllowanceTypes([])
    } finally {
      setLoading(false)
    }
  }

  const startEdit = (type: AllowanceType) => {
    setEditingId(type.id)
    setEditForm({ display_name: type.display_name, base_amount: type.base_amount })
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditForm({ display_name: '', base_amount: 0 })
  }

  const saveEdit = async (id: number) => {
    if (!editForm.display_name || editForm.base_amount < 0) {
      alert('⚠️ 表示名と金額を正しく入力してください')
      return
    }

    setLoading(true)
    try {
      console.log('更新データ:', { id, editForm })
      const { error } = await supabase
        .from('allowance_types')
        .update({
          display_name: editForm.display_name,
          base_amount: editForm.base_amount,
          updated_at: new Date().toISOString()
        })
        .eq('id', id)

      if (error) {
        console.error('更新エラー:', error)
        alert(`⚠️ 更新に失敗しました\n\nエラー: ${error.message}`)
      } else {
        console.log('更新成功')
        alert('✅ 更新しました')
        await fetchAllowanceTypes()
        cancelEdit()
      }
    } catch (err) {
      console.error('予期しないエラー:', err)
      alert('⚠️ 更新中に予期しないエラーが発生しました')
    } finally {
      setLoading(false)
    }
  }

  const handleAddNew = async () => {
    if (!newType.code || !newType.display_name || newType.base_amount < 0) {
      alert('⚠️ すべての項目を正しく入力してください')
      return
    }

    // コードの重複チェック
    if (allowanceTypes.some(t => t.code === newType.code.toUpperCase())) {
      alert('⚠️ このコードは既に使用されています')
      return
    }

    setLoading(true)
    try {
      console.log('追加データ:', newType)
      const { error } = await supabase
        .from('allowance_types')
        .insert({
          code: newType.code.toUpperCase(),
          display_name: newType.display_name,
          base_amount: newType.base_amount,
          requires_holiday: newType.requires_holiday
        })

      if (error) {
        console.error('追加エラー:', error)
        alert(`⚠️ 追加に失敗しました\n\nエラー: ${error.message}`)
      } else {
        console.log('追加成功')
        alert('✅ 新しい手当種別を追加しました')
        setShowAddModal(false)
        setNewType({ code: '', display_name: '', base_amount: 0, requires_holiday: false })
        await fetchAllowanceTypes()
      }
    } catch (err) {
      console.error('予期しないエラー:', err)
      alert('⚠️ 追加中に予期しないエラーが発生しました')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id: number, code: string, displayName: string) => {
    if (!confirm(`本当に削除しますか？\n\nコード: ${code}\n名前: ${displayName}\n\n※この操作は取り消せません。`)) {
      return
    }

    setLoading(true)
    try {
      console.log('削除データ:', { id, code, displayName })
      const { error } = await supabase
        .from('allowance_types')
        .delete()
        .eq('id', id)

      if (error) {
        console.error('削除エラー:', error)
        alert(`⚠️ 削除に失敗しました\n\nエラー: ${error.message}`)
      } else {
        console.log('削除成功')
        alert('✅ 削除しました')
        await fetchAllowanceTypes()
      }
    } catch (err) {
      console.error('予期しないエラー:', err)
      alert('⚠️ 削除中に予期しないエラーが発生しました')
    } finally {
      setLoading(false)
    }
  }

  const handleLogout = async () => {
    await logout()
    router.push('/login')
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-100 p-4">
      <div className="max-w-6xl mx-auto">
        {/* ヘッダー */}
        <header className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold text-blue-800">⚙️ 手当設定管理</h1>
          <div className="flex items-center gap-4">
            <Link href="/admin" className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 transition font-bold">
              ← 管理画面に戻る
            </Link>
            <button onClick={handleLogout} className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition font-bold">
              ログアウト
            </button>
          </div>
        </header>

        {/* 説明 */}
        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-6 rounded-md">
          <p className="text-sm text-yellow-800">
            <strong>⚠️ 注意:</strong> ここで設定した金額は、ユーザーの手当入力時に自動計算に使用されます。<br />
            変更後、既存の入力データには影響しませんが、新規入力時から反映されます。
          </p>
        </div>

        {/* 新規追加ボタン */}
        {!loading && (
          <div className="mb-6 flex justify-end">
            <button
              onClick={() => setShowAddModal(true)}
              className="bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 transition font-bold shadow-lg flex items-center gap-2"
            >
              <span className="text-xl">➕</span>
              新しい手当種別を追加
            </button>
          </div>
        )}

        {/* ローディング中の表示 */}
        {loading && (
          <div className="bg-white rounded-2xl shadow-lg p-12 text-center">
            <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600 font-bold text-lg">読み込み中...</p>
            <p className="text-gray-400 text-sm mt-2">手当設定データを取得しています</p>
          </div>
        )}

        {/* 設定一覧テーブル（ローディング完了後のみ表示） */}
        {!loading && (
          <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-blue-600 text-white">
                  <tr>
                    <th className="px-6 py-4 font-bold">コード</th>
                    <th className="px-6 py-4 font-bold">表示名</th>
                    <th className="px-6 py-4 font-bold text-right">基本金額 (円)</th>
                    <th className="px-6 py-4 font-bold text-center">休日限定</th>
                    <th className="px-6 py-4 font-bold text-center" colSpan={2}>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {(!allowanceTypes || allowanceTypes.length === 0) && (
                    <tr>
                      <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                        手当設定がありません。<br />
                        <span className="text-xs">Supabaseで allowance_types テーブルにデータを追加してください。</span>
                      </td>
                    </tr>
                  )}
                  {allowanceTypes && allowanceTypes.length > 0 && allowanceTypes.map((type) => (
                  <tr key={type.id} className="border-b border-gray-200 hover:bg-gray-50 transition">
                    <td className="px-6 py-4 font-mono font-bold text-blue-700">{type.code}</td>
                    <td className="px-6 py-4">
                      {editingId === type.id ? (
                        <input
                          type="text"
                          value={editForm.display_name}
                          onChange={(e) => setEditForm({ ...editForm, display_name: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                        />
                      ) : (
                        <span className="text-gray-900">{type.display_name}</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      {editingId === type.id ? (
                        <input
                          type="number"
                          min="0"
                          step="100"
                          value={editForm.base_amount}
                          onChange={(e) => setEditForm({ ...editForm, base_amount: parseInt(e.target.value) || 0 })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 text-gray-900 text-right"
                        />
                      ) : (
                        <span className="text-gray-900 font-bold">¥{type.base_amount.toLocaleString()}</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-center">
                      {type.requires_holiday ? (
                        <span className="inline-block px-3 py-1 bg-orange-100 text-orange-700 rounded-full text-xs font-bold">
                          休日のみ
                        </span>
                      ) : (
                        <span className="inline-block px-3 py-1 bg-gray-100 text-gray-600 rounded-full text-xs font-bold">
                          随時可
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-4 text-center">
                      {editingId === type.id ? (
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => saveEdit(type.id)}
                            disabled={loading}
                            className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition font-bold disabled:opacity-50"
                          >
                            保存
                          </button>
                          <button
                            onClick={cancelEdit}
                            disabled={loading}
                            className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 transition font-bold disabled:opacity-50"
                          >
                            キャンセル
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => startEdit(type)}
                          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition font-bold"
                        >
                          編集
                        </button>
                      )}
                    </td>
                    <td className="px-3 py-4 text-center">
                      {editingId !== type.id && (
                        <button
                          onClick={() => handleDelete(type.id, type.code, type.display_name)}
                          className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition font-bold"
                        >
                          削除
                        </button>
                      )}
                    </td>
                  </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* フッター情報 */}
        <div className="mt-6 text-center text-sm text-gray-600">
          最終更新: {new Date().toLocaleString('ja-JP')}
        </div>
      </div>

      {/* 新規追加モーダル */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowAddModal(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl p-8" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-2xl font-bold text-gray-900 mb-6">➕ 新しい手当種別を追加</h2>
            
            <div className="space-y-4">
              {/* コード */}
              <div>
                <label className="block text-sm font-bold text-gray-900 mb-2">
                  コード <span className="text-red-600">*</span>
                </label>
                <input
                  type="text"
                  value={newType.code}
                  onChange={(e) => setNewType({ ...newType, code: e.target.value.toUpperCase() })}
                  placeholder="例: I"
                  maxLength={1}
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 text-gray-900 font-mono text-lg"
                />
                <p className="text-xs text-gray-600 mt-1">1文字の英字（A-Z）を入力してください</p>
              </div>

              {/* 表示名 */}
              <div>
                <label className="block text-sm font-bold text-gray-900 mb-2">
                  表示名 <span className="text-red-600">*</span>
                </label>
                <input
                  type="text"
                  value={newType.display_name}
                  onChange={(e) => setNewType({ ...newType, display_name: e.target.value })}
                  placeholder="例: I.研修旅行引率"
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                />
              </div>

              {/* 基本金額 */}
              <div>
                <label className="block text-sm font-bold text-gray-900 mb-2">
                  基本金額（円） <span className="text-red-600">*</span>
                </label>
                <input
                  type="number"
                  value={newType.base_amount}
                  onChange={(e) => setNewType({ ...newType, base_amount: parseInt(e.target.value) || 0 })}
                  min="0"
                  step="100"
                  placeholder="例: 2400"
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 text-gray-900 text-right"
                />
              </div>

              {/* 休日限定 */}
              <div>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newType.requires_holiday}
                    onChange={(e) => setNewType({ ...newType, requires_holiday: e.target.checked })}
                    className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <span className="text-sm font-bold text-gray-900">
                    休日のみ選択可能にする
                  </span>
                </label>
                <p className="text-xs text-gray-600 mt-1 ml-8">
                  チェックすると、勤務日には選択できなくなります
                </p>
              </div>
            </div>

            {/* ボタン */}
            <div className="flex gap-3 mt-8">
              <button
                onClick={handleAddNew}
                disabled={loading}
                className="flex-1 bg-green-600 text-white py-3 rounded-lg hover:bg-green-700 transition font-bold disabled:opacity-50"
              >
                追加
              </button>
              <button
                onClick={() => {
                  setShowAddModal(false)
                  setNewType({ code: '', display_name: '', base_amount: 0, requires_holiday: false })
                }}
                disabled={loading}
                className="flex-1 bg-gray-600 text-white py-3 rounded-lg hover:bg-gray-700 transition font-bold disabled:opacity-50"
              >
                キャンセル
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
