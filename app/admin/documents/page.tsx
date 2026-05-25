'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useRequireAdmin } from '@/utils/useRequireAdmin'
import { uploadDocument } from './actions'

type Document = {
  id: number
  title: string
  file_path: string
  file_name: string
  file_size: number
  uploaded_by: string
  created_at: string
}

export default function DocumentsAdminPage() {
  const router = useRouter()
  const { profile, loading: authLoading, authorized, supabase } = useRequireAdmin()
  const [loading, setLoading] = useState(true)
  const [documents, setDocuments] = useState<Document[]>([])
  const [uploading, setUploading] = useState(false)
  const [title, setTitle] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [userEmail, setUserEmail] = useState('')

  useEffect(() => {
    if (authorized && profile) {
      setUserEmail(profile.email)
      fetchDocuments()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authorized, profile])

  const fetchDocuments = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('documents')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) {
        console.error('文書取得エラー（詳細）:', {
          message: error.message,
          code: error.code,
          details: error.details,
          hint: error.hint,
          fullError: error
        })
        
        const errorMessage = error.message || ''
        const errorCode = error.code || ''
        const errorDetails = error.details || ''
        const errorHint = error.hint || ''
        
        // スキーマキャッシュのエラー（PGRST205）の特別処理
        const isSchemaCacheError = (
          errorCode === 'PGRST205' ||
          (errorMessage.includes('schema cache') && errorMessage.includes('Could not find'))
        )
        
        // テーブルが存在しない場合のエラー
        const isTableNotFound = (
          errorMessage.includes('does not exist') || 
          errorMessage.includes('relation') ||
          errorMessage.includes('table') ||
          errorCode === '42P01' ||
          errorCode === 'PGRST116'
        )
        
        if (isSchemaCacheError) {
          alert(
            '資料テーブルの取得に失敗しました: スキーマキャッシュが更新されていません。\n\n' +
            '【解決方法】\n' +
            '1. Supabase Dashboard → Settings → API を開く\n' +
            '2. "Reload schema cache" ボタンをクリック\n' +
            '3. 数秒待ってから再度お試しください\n\n' +
            'または、SQL Editor で以下を実行してください：\n' +
            'NOTIFY pgrst, \'reload schema\';\n\n' +
            'エラー詳細:\n' +
            'コード: ' + errorCode + '\n' +
            'メッセージ: ' + errorMessage
          )
        } else if (isTableNotFound) {
          alert(
            '資料テーブルが作成されていません。\n\n' +
            '【解決方法】\n' +
            '1. Supabase Dashboard の SQL Editor を開く\n' +
            '2. SETUP_INQUIRIES_AND_DOCUMENTS.sql の内容をコピー\n' +
            '3. SQL Editor に貼り付けて実行\n\n' +
            'エラー詳細:\n' +
            'コード: ' + errorCode + '\n' +
            'メッセージ: ' + errorMessage
          )
        } else {
          alert(
            '文書の取得に失敗しました。\n\n' +
            'エラー詳細:\n' +
            'コード: ' + (errorCode || 'なし') + '\n' +
            'メッセージ: ' + errorMessage + '\n' +
            (errorDetails ? '詳細: ' + errorDetails + '\n' : '') +
            (errorHint ? 'ヒント: ' + errorHint : '')
          )
        }
        setDocuments([])
      } else {
        setDocuments(data || [])
      }
    } catch (err) {
      console.error('文書取得中の予期しないエラー:', err)
      setDocuments([])
    }
    setLoading(false)
  }

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!title.trim() || !file) {
      alert('タイトルとファイルを入力してください')
      return
    }

    if (file.type !== 'application/pdf') {
      alert('PDFファイルのみアップロードできます')
      return
    }

    if (file.size > 10 * 1024 * 1024) {
      alert('ファイルサイズは10MB以下にしてください')
      return
    }

    setUploading(true)
    try {
      const result = await uploadDocument({
        title: title.trim(),
        file,
        userEmail
      })

      if (result?.error) {
        // エラーメッセージをそのまま表示（サーバー側で詳細なメッセージを生成済み）
        alert('アップロードに失敗しました\n\n' + result.error)
      } else {
        // 成功メッセージをより分かりやすく表示
        alert('✅ アップロードが完了しました！\n\n資料が正常にアップロードされました。')
        setTitle('')
        setFile(null)
        // ファイル入力をリセット
        const fileInput = document.getElementById('file-input') as HTMLInputElement
        if (fileInput) fileInput.value = ''
        fetchDocuments()
      }
    } catch (err) {
      alert('予期しないエラーが発生しました')
      console.error(err)
    }
    setUploading(false)
  }

  const handleDelete = async (id: number, filePath: string) => {
    if (!confirm('この資料を削除しますか？')) return

    try {
      // Storageからファイルを削除
      const { error: storageError } = await supabase.storage
        .from('documents')
        .remove([filePath])

      if (storageError) {
        console.error('Storage削除エラー:', storageError)
      }

      // データベースからレコードを削除
      const { error: dbError } = await supabase
        .from('documents')
        .delete()
        .eq('id', id)

      if (dbError) {
        alert('削除に失敗しました: ' + dbError.message)
      } else {
        alert('削除が完了しました')
        fetchDocuments()
      }
    } catch (err) {
      alert('予期しないエラーが発生しました')
      console.error(err)
    }
  }

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  if (authLoading || !authorized) return <div className="p-10 text-center">確認中...</div>

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* ヘッダー */}
      <div className="bg-slate-800 text-white p-6 shadow-lg">
        <div className="max-w-6xl mx-auto flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold mb-1">📄 資料管理</h1>
            <p className="text-slate-300 text-sm">規約・資料のアップロード・管理</p>
          </div>
          <div className="flex gap-3">
            <Link href="/admin" className="bg-slate-700 hover:bg-slate-600 px-4 py-2 rounded-lg font-bold text-sm transition">
              管理者ダッシュボード
            </Link>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto p-8">
        {/* アップロードフォーム */}
        <div className="bg-white p-6 rounded-xl shadow-md mb-8">
          <h2 className="text-xl font-bold text-gray-900 mb-4">新しい資料をアップロード</h2>
          <form onSubmit={handleUpload} className="space-y-4">
            <div>
              <label className="block text-sm font-bold text-gray-900 mb-2">
                タイトル <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="例: 特殊勤務手当の種類・支給額・内容一覧（令和7年度）"
                required
                disabled={uploading}
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none transition font-bold text-gray-900"
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-900 mb-2">
                PDFファイル <span className="text-red-500">*</span>
              </label>
              <input
                id="file-input"
                type="file"
                accept=".pdf"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                required
                disabled={uploading}
                className="w-full p-3 border-2 border-gray-300 rounded-lg font-bold text-gray-900 bg-white file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-blue-50 file:text-blue-700 file:font-bold hover:file:bg-blue-100"
              />
              {file && (
                <p className="text-xs text-green-600 mt-2">
                  ✓ {file.name} ({formatFileSize(file.size)}) を選択中
                </p>
              )}
              <p className="text-xs text-gray-500 mt-1">
                PDFファイルのみ、最大10MBまでアップロード可能です
              </p>
            </div>

            <button
              type="submit"
              disabled={uploading || !title.trim() || !file}
              className="w-full py-3.5 bg-gradient-to-r from-blue-600 to-blue-700 text-white font-bold rounded-lg hover:from-blue-700 hover:to-blue-800 disabled:from-gray-300 disabled:to-gray-400 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 shadow-md hover:shadow-lg transform hover:scale-[1.02] disabled:transform-none"
            >
              {uploading ? (
                <>
                  <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span>アップロード中...</span>
                </>
              ) : (
                <>
                  <span className="text-lg">📤</span>
                  <span>アップロード</span>
                </>
              )}
            </button>
          </form>
        </div>

        {/* 資料一覧 */}
        <div className="bg-white p-6 rounded-xl shadow-md">
          <h2 className="text-xl font-bold text-gray-900 mb-4">アップロード済み資料</h2>

          {loading ? (
            <div className="text-center py-10">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <p className="mt-2 text-gray-600">読み込み中...</p>
            </div>
          ) : documents.length === 0 ? (
            <div className="text-center py-10">
              <p className="text-gray-600">アップロードされた資料はありません</p>
            </div>
          ) : (
            <div className="space-y-4">
              {documents.map((doc) => (
                <div
                  key={doc.id}
                  className="bg-gray-50 p-4 rounded-xl border border-gray-200"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="font-bold text-gray-900 mb-1">{doc.title}</h3>
                      <div className="flex items-center gap-4 text-xs text-gray-600 mt-2">
                        <span>📄 {doc.file_name}</span>
                        <span>📊 {formatFileSize(doc.file_size)}</span>
                        <span>📅 {formatDate(doc.created_at)}</span>
                        <span>👤 {doc.uploaded_by}</span>
                      </div>
                    </div>
                    <button
                      onClick={() => handleDelete(doc.id, doc.file_path)}
                      className="ml-4 px-4 py-2 bg-red-600 text-white font-bold rounded-lg hover:bg-red-700 transition"
                    >
                      🗑 削除
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
