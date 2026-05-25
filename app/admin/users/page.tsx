'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/utils/supabase/client'
import {
  fetchCurrentProfile,
  isAdminRole,
  isSuperAdminRole,
  ROLE_LABELS,
  type UserProfile,
  type UserRole,
} from '@/utils/userProfile'
import { logout } from '@/app/auth/actions'

type SortKey = 'display_name' | 'email' | 'role' | 'linked'

const ROLE_BADGE: Record<UserRole, string> = {
  user: 'bg-slate-700/60 text-slate-200 border-slate-500/40',
  admin: 'bg-indigo-500/20 text-indigo-200 border-indigo-400/40',
  super_admin: 'bg-fuchsia-500/20 text-fuchsia-200 border-fuchsia-400/40',
}

interface CsvRow {
  lastName: string
  firstName: string
  email: string
}

interface BulkResult {
  inserted: number
  updated: number
  errors: { row: number; email: string; reason: string }[]
}

export default function AdminUsersPage() {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])

  const [authChecking, setAuthChecking] = useState(true)
  const [me, setMe] = useState<UserProfile | null>(null)
  const [users, setUsers] = useState<UserProfile[]>([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('display_name')
  const [sortAsc, setSortAsc] = useState(true)

  // 追加 / 編集モーダル
  const [showFormModal, setShowFormModal] = useState(false)
  const [editing, setEditing] = useState<UserProfile | null>(null)
  const [form, setForm] = useState({ last_name: '', first_name: '', email: '', role: 'user' as UserRole })

  // CSV
  const csvInputRef = useRef<HTMLInputElement | null>(null)
  const [csvFile, setCsvFile] = useState<File | null>(null)
  const [bulkResult, setBulkResult] = useState<BulkResult | null>(null)
  const [bulkRunning, setBulkRunning] = useState(false)

  // --------------- アクセス制御 ---------------
  useEffect(() => {
    const check = async () => {
      const profile = await fetchCurrentProfile(supabase)
      if (!profile) {
        alert('プロフィールが見つかりません。再ログインしてください。')
        await logout()
        return
      }
      if (!isAdminRole(profile.role)) {
        alert('この画面は管理者専用です。')
        router.push('/')
        return
      }
      setMe(profile)
      setAuthChecking(false)
      await fetchUsers()
    }
    check()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // --------------- 一覧取得 ---------------
  const fetchUsers = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('user_profiles')
      .select('*')
      .order('display_name', { ascending: true })
    if (error) {
      console.error(error)
      alert(`一覧取得に失敗しました: ${error.message}`)
    } else {
      setUsers((data as UserProfile[]) ?? [])
    }
    setLoading(false)
  }, [supabase])

  // --------------- フィルタ・ソート ---------------
  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase()
    const arr = q
      ? users.filter(
          (u) =>
            u.display_name.toLowerCase().includes(q) ||
            u.email.toLowerCase().includes(q) ||
            (u.last_name ?? '').toLowerCase().includes(q) ||
            (u.first_name ?? '').toLowerCase().includes(q)
        )
      : [...users]

    arr.sort((a, b) => {
      let av: string | number = ''
      let bv: string | number = ''
      switch (sortKey) {
        case 'display_name':
          av = a.display_name
          bv = b.display_name
          break
        case 'email':
          av = a.email
          bv = b.email
          break
        case 'role':
          av = a.role
          bv = b.role
          break
        case 'linked':
          av = a.user_id ? 1 : 0
          bv = b.user_id ? 1 : 0
          break
      }
      if (av < bv) return sortAsc ? -1 : 1
      if (av > bv) return sortAsc ? 1 : -1
      return 0
    })
    return arr
  }, [users, search, sortKey, sortAsc])

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc((v) => !v)
    else {
      setSortKey(key)
      setSortAsc(true)
    }
  }

  // --------------- 個別追加・編集 ---------------
  const openAddModal = () => {
    setEditing(null)
    setForm({ last_name: '', first_name: '', email: '', role: 'user' })
    setShowFormModal(true)
  }

  const openEditModal = (u: UserProfile) => {
    setEditing(u)
    setForm({
      last_name: u.last_name ?? '',
      first_name: u.first_name ?? '',
      email: u.email,
      role: u.role,
    })
    setShowFormModal(true)
  }

  const closeFormModal = () => {
    setShowFormModal(false)
    setEditing(null)
  }

  const saveForm = async () => {
    const email = form.email.trim().toLowerCase()
    const last = form.last_name.trim()
    const first = form.first_name.trim()
    if (!email || !email.includes('@')) {
      alert('メールアドレスを正しく入力してください')
      return
    }
    if (!last && !first) {
      alert('姓または名のいずれかを入力してください')
      return
    }

    // super_admin は本人以外は変更不可（降格防止 / 昇格は super_admin だけが可）
    if (!isSuperAdminRole(me?.role) && form.role !== 'user') {
      alert('スーパー管理者のみが管理者ロールを付与できます。')
      return
    }

    const displayName = `${last} ${first}`.trim()
    setLoading(true)
    try {
      if (editing) {
        const { error } = await supabase
          .from('user_profiles')
          .update({
            last_name: last || null,
            first_name: first || null,
            display_name: displayName,
            email,
            role: form.role,
          })
          .eq('id', editing.id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('user_profiles').insert({
          last_name: last || null,
          first_name: first || null,
          display_name: displayName,
          email,
          role: form.role,
        })
        if (error) throw error
      }
      await fetchUsers()
      closeFormModal()
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      alert(`保存に失敗しました: ${msg}`)
    } finally {
      setLoading(false)
    }
  }

  // --------------- 削除 ---------------
  const handleDelete = async (u: UserProfile) => {
    if (u.id === me?.id) {
      alert('自分自身は削除できません。')
      return
    }
    if (!confirm(`「${u.display_name || u.email}」を削除します。\n\nこの操作は元に戻せません。よろしいですか？`)) return
    setLoading(true)
    const { error } = await supabase.from('user_profiles').delete().eq('id', u.id)
    setLoading(false)
    if (error) {
      alert(`削除に失敗しました: ${error.message}`)
      return
    }
    await fetchUsers()
  }

  // --------------- ロール切替（インライン） ---------------
  const changeRole = async (u: UserProfile, role: UserRole) => {
    if (!isSuperAdminRole(me?.role)) {
      alert('ロール変更はスーパー管理者のみ可能です。')
      return
    }
    if (u.id === me?.id) {
      alert('自分自身のロールは変更できません。')
      return
    }
    if (u.role === role) return

    const { error } = await supabase.from('user_profiles').update({ role }).eq('id', u.id)
    if (error) {
      alert(`ロール変更に失敗しました: ${error.message}`)
      return
    }
    await fetchUsers()
  }

  // --------------- CSV ---------------
  const decodeCsv = async (file: File): Promise<string> => {
    const buf = await file.arrayBuffer()
    const utf8 = new TextDecoder('utf-8').decode(buf)
    if (!utf8.includes('\uFFFD')) return utf8
    try {
      return new TextDecoder('shift-jis').decode(buf)
    } catch {
      return utf8
    }
  }

  const parseCsv = (text: string): CsvRow[] => {
    const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/).filter((l) => l.trim())
    if (lines.length === 0) return []

    // ヘッダー行を判定: 含む 'email' 又は '姓' '名'
    const headerLike = /姓|名|email|メール|last|first/i.test(lines[0])
    const dataLines = headerLike ? lines.slice(1) : lines

    const splitCsvLine = (line: string): string[] => {
      const parts: string[] = []
      let cur = ''
      let inQ = false
      for (let i = 0; i < line.length; i++) {
        const ch = line[i]
        if (ch === '"') {
          if (inQ && line[i + 1] === '"') {
            cur += '"'
            i++
          } else {
            inQ = !inQ
          }
        } else if (ch === ',' && !inQ) {
          parts.push(cur)
          cur = ''
        } else {
          cur += ch
        }
      }
      parts.push(cur)
      return parts.map((p) => p.trim())
    }

    return dataLines.map((line) => {
      const [last = '', first = '', email = ''] = splitCsvLine(line)
      return { lastName: last, firstName: first, email: email.toLowerCase() }
    })
  }

  const runBulkUpload = async () => {
    if (!csvFile) {
      alert('CSV ファイルを選択してください')
      return
    }
    setBulkRunning(true)
    setBulkResult(null)
    const errors: BulkResult['errors'] = []
    let inserted = 0
    let updated = 0

    try {
      const text = await decodeCsv(csvFile)
      const rows = parseCsv(text)
      if (rows.length === 0) {
        alert('有効なデータが見つかりませんでした。CSV の中身を確認してください。')
        setBulkRunning(false)
        return
      }

      const allowedDomain = (process.env.NEXT_PUBLIC_ALLOWED_EMAIL_DOMAIN ?? '').toLowerCase().trim()

      // 既存メール一覧を取得
      const emailList = rows.map((r) => r.email).filter(Boolean)
      const { data: existingRows } = await supabase
        .from('user_profiles')
        .select('id, email')
        .in('email', emailList)
      const existingMap = new Map<string, number>()
      ;(existingRows as { id: number; email: string }[] | null)?.forEach((r) =>
        existingMap.set(r.email.toLowerCase(), r.id)
      )

      for (let i = 0; i < rows.length; i++) {
        const r = rows[i]
        if (!r.email) {
          errors.push({ row: i + 2, email: '(空)', reason: 'メールが空です' })
          continue
        }
        if (!r.email.includes('@')) {
          errors.push({ row: i + 2, email: r.email, reason: 'メール形式が不正' })
          continue
        }
        if (allowedDomain && !r.email.endsWith(`@${allowedDomain}`)) {
          errors.push({
            row: i + 2,
            email: r.email,
            reason: `許可ドメイン外 (@${allowedDomain} のみ)`,
          })
          continue
        }
        const last = r.lastName.trim()
        const first = r.firstName.trim()
        const displayName = `${last} ${first}`.trim() || r.email.split('@')[0]

        const existsId = existingMap.get(r.email)
        if (existsId) {
          const { error } = await supabase
            .from('user_profiles')
            .update({
              last_name: last || null,
              first_name: first || null,
              display_name: displayName,
            })
            .eq('id', existsId)
          if (error) errors.push({ row: i + 2, email: r.email, reason: error.message })
          else updated++
        } else {
          const { error } = await supabase.from('user_profiles').insert({
            email: r.email,
            last_name: last || null,
            first_name: first || null,
            display_name: displayName,
            role: 'user',
          })
          if (error) errors.push({ row: i + 2, email: r.email, reason: error.message })
          else inserted++
        }
      }

      setBulkResult({ inserted, updated, errors })
      await fetchUsers()
      setCsvFile(null)
      if (csvInputRef.current) csvInputRef.current.value = ''
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      alert(`CSV 取り込みに失敗しました: ${msg}`)
    } finally {
      setBulkRunning(false)
    }
  }

  const downloadTemplate = () => {
    const csv = '\uFEFF姓,名,メール\n三田村,和真,mitamuraka@haguroko.ed.jp\n友野,太郎,tomonoem@haguroko.ed.jp\n'
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'teachers_template.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleLogout = async () => {
    await logout()
  }

  // --------------- レンダリング ---------------
  if (authChecking) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-200 flex items-center justify-center">
        <div className="flex items-center gap-3">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-white/20 border-t-white" />
          <span>確認中...</span>
        </div>
      </div>
    )
  }

  const canManageRoles = isSuperAdminRole(me?.role)

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      {/* ヘッダー */}
      <div className="border-b border-white/10 bg-slate-900/60 backdrop-blur">
        <div className="max-w-7xl mx-auto px-6 py-5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-indigo-500 to-fuchsia-500 flex items-center justify-center text-white font-bold">
              U
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">ユーザー管理</h1>
              <p className="text-xs text-slate-400">教員アカウントの登録・編集・権限管理</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/admin"
              className="px-4 py-2 rounded-lg text-sm font-semibold border border-white/10 hover:bg-white/5 transition"
            >
              ← 管理画面
            </Link>
            <button
              onClick={handleLogout}
              className="px-4 py-2 rounded-lg text-sm font-semibold bg-rose-500/20 text-rose-200 border border-rose-400/30 hover:bg-rose-500/30 transition"
            >
              ログアウト
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8 space-y-8">
        {/* CSV 一括登録 */}
        <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
          <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
            <div>
              <h2 className="text-lg font-bold flex items-center gap-2">
                <span>CSV 一括登録</span>
                <span className="text-xs font-normal text-slate-400">姓 / 名 / メール</span>
              </h2>
              <p className="mt-1 text-sm text-slate-400">
                教員を一括で事前登録します。初めて Google ログインした際にアカウントが自動で紐付きます。
              </p>
            </div>
            <button
              onClick={downloadTemplate}
              className="px-4 py-2 rounded-lg text-sm font-semibold bg-white/5 border border-white/10 hover:bg-white/10 transition"
            >
              テンプレートをDL
            </button>
          </div>

          <div className="rounded-xl bg-slate-900/60 border border-white/5 p-4 mb-4">
            <p className="text-xs text-slate-400 mb-2">CSV フォーマット例（UTF-8 推奨 / Shift-JIS も自動判別）</p>
            <pre className="text-xs text-slate-200 font-mono whitespace-pre overflow-x-auto">
{`姓,名,メール
三田村,和真,mitamuraka@haguroko.ed.jp
友野,太郎,tomonoem@haguroko.ed.jp`}
            </pre>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <input
              ref={csvInputRef}
              type="file"
              accept=".csv,text/csv"
              onChange={(e) => setCsvFile(e.target.files?.[0] ?? null)}
              className="text-sm text-slate-300 file:mr-3 file:px-4 file:py-2 file:rounded-lg file:border-0 file:bg-white file:text-slate-900 file:font-semibold hover:file:bg-slate-200"
            />
            {csvFile && <span className="text-xs text-emerald-300">{csvFile.name}</span>}
            <button
              onClick={runBulkUpload}
              disabled={!csvFile || bulkRunning}
              className="ml-auto px-5 py-2.5 rounded-lg text-sm font-bold bg-gradient-to-r from-indigo-500 to-fuchsia-500 hover:from-indigo-400 hover:to-fuchsia-400 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {bulkRunning ? 'アップロード中...' : 'アップロードして登録'}
            </button>
          </div>

          {bulkResult && (
            <div className="mt-4 rounded-xl border border-white/10 bg-slate-900/50 p-4 text-sm space-y-2">
              <div className="flex flex-wrap gap-4 text-slate-200">
                <span className="px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-200 border border-emerald-400/30">
                  新規 {bulkResult.inserted} 件
                </span>
                <span className="px-3 py-1 rounded-full bg-sky-500/20 text-sky-200 border border-sky-400/30">
                  更新 {bulkResult.updated} 件
                </span>
                <span className="px-3 py-1 rounded-full bg-rose-500/20 text-rose-200 border border-rose-400/30">
                  失敗 {bulkResult.errors.length} 件
                </span>
              </div>
              {bulkResult.errors.length > 0 && (
                <details>
                  <summary className="cursor-pointer text-slate-300 hover:text-white">
                    エラー詳細を表示
                  </summary>
                  <ul className="mt-2 ml-4 list-disc text-xs text-rose-200 space-y-1">
                    {bulkResult.errors.map((e, i) => (
                      <li key={i}>
                        行{e.row} ({e.email}): {e.reason}
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </div>
          )}
        </section>

        {/* 一覧 */}
        <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <h2 className="text-lg font-bold">登録済みアカウント ({users.length})</h2>
            <input
              type="text"
              placeholder="氏名・メールで検索..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="ml-auto w-72 px-4 py-2 rounded-lg bg-slate-900/60 border border-white/10 text-sm text-slate-100 placeholder:text-slate-500 focus:border-indigo-400 focus:outline-none"
            />
            <button
              onClick={openAddModal}
              className="px-4 py-2 rounded-lg text-sm font-semibold bg-emerald-500/20 text-emerald-200 border border-emerald-400/30 hover:bg-emerald-500/30 transition"
            >
              ＋ 個別追加
            </button>
            <button
              onClick={fetchUsers}
              className="px-3 py-2 rounded-lg text-sm font-semibold bg-white/5 border border-white/10 hover:bg-white/10 transition"
              title="再読み込み"
            >
              ↻
            </button>
          </div>

          <div className="overflow-x-auto rounded-xl border border-white/5">
            <table className="w-full text-sm">
              <thead className="bg-slate-900/70 text-slate-300 select-none">
                <tr>
                  <Th onClick={() => handleSort('display_name')} active={sortKey === 'display_name'} asc={sortAsc}>
                    氏名
                  </Th>
                  <Th onClick={() => handleSort('email')} active={sortKey === 'email'} asc={sortAsc}>
                    メールアドレス
                  </Th>
                  <Th onClick={() => handleSort('role')} active={sortKey === 'role'} asc={sortAsc}>
                    権限
                  </Th>
                  <Th onClick={() => handleSort('linked')} active={sortKey === 'linked'} asc={sortAsc}>
                    ログイン
                  </Th>
                  <th className="px-4 py-3 text-right text-xs font-bold uppercase tracking-wider">
                    操作
                  </th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-slate-400">
                      読み込み中...
                    </td>
                  </tr>
                )}
                {!loading && filteredUsers.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                      登録されたアカウントはまだありません。CSV か「＋ 個別追加」から登録してください。
                    </td>
                  </tr>
                )}
                {!loading &&
                  filteredUsers.map((u) => (
                    <tr key={u.id} className="border-t border-white/5 hover:bg-white/[0.02]">
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-100">
                          {u.display_name || '(未設定)'}
                          {u.id === me?.id && (
                            <span className="ml-2 text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-200 border border-amber-400/30 align-middle">
                              YOU
                            </span>
                          )}
                        </div>
                        {(u.last_name || u.first_name) && (
                          <div className="text-xs text-slate-500">
                            {u.last_name ?? ''} / {u.first_name ?? ''}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-300 break-all">{u.email}</td>
                      <td className="px-4 py-3">
                        <RoleSelector
                          value={u.role}
                          disabled={!canManageRoles || u.id === me?.id}
                          onChange={(role) => changeRole(u, role)}
                        />
                      </td>
                      <td className="px-4 py-3">
                        {u.user_id ? (
                          <span className="inline-flex items-center gap-1.5 text-xs text-emerald-300">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> 連携済み
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 text-xs text-slate-500">
                            <span className="h-1.5 w-1.5 rounded-full bg-slate-500" /> 未ログイン
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right space-x-2 whitespace-nowrap">
                        <button
                          onClick={() => openEditModal(u)}
                          className="px-3 py-1.5 rounded-md text-xs font-semibold bg-white/5 border border-white/10 hover:bg-white/10"
                        >
                          編集
                        </button>
                        <button
                          onClick={() => handleDelete(u)}
                          disabled={u.id === me?.id}
                          className="px-3 py-1.5 rounded-md text-xs font-semibold bg-rose-500/20 text-rose-200 border border-rose-400/30 hover:bg-rose-500/30 disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          削除
                        </button>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {/* 追加 / 編集モーダル */}
      {showFormModal && (
        <div
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={closeFormModal}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-slate-900 border border-white/10 shadow-2xl p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-bold mb-1">
              {editing ? 'アカウントを編集' : '新しいアカウントを追加'}
            </h3>
            <p className="text-xs text-slate-400 mb-5">
              {editing
                ? '氏名やメール、ロールを更新します。'
                : '事前登録します。初回 Google ログイン時に紐付きます。'}
            </p>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <FormField label="姓">
                  <input
                    type="text"
                    value={form.last_name}
                    onChange={(e) => setForm({ ...form, last_name: e.target.value })}
                    placeholder="例: 三田村"
                    className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-white/10 text-slate-100 focus:border-indigo-400 focus:outline-none"
                  />
                </FormField>
                <FormField label="名">
                  <input
                    type="text"
                    value={form.first_name}
                    onChange={(e) => setForm({ ...form, first_name: e.target.value })}
                    placeholder="例: 和真"
                    className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-white/10 text-slate-100 focus:border-indigo-400 focus:outline-none"
                  />
                </FormField>
              </div>

              <FormField label="メールアドレス">
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="example@haguroko.ed.jp"
                  className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-white/10 text-slate-100 focus:border-indigo-400 focus:outline-none"
                />
              </FormField>

              <FormField label="権限">
                <select
                  value={form.role}
                  onChange={(e) => setForm({ ...form, role: e.target.value as UserRole })}
                  disabled={!canManageRoles || (editing?.id === me?.id)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-white/10 text-slate-100 focus:border-indigo-400 focus:outline-none disabled:opacity-50"
                >
                  <option value="user">入力者 (user)</option>
                  <option value="admin">管理者 (admin)</option>
                  {isSuperAdminRole(me?.role) && (
                    <option value="super_admin">スーパー管理者 (super_admin)</option>
                  )}
                </select>
                {!canManageRoles && (
                  <p className="text-[11px] text-slate-500 mt-1">
                    ※ ロール変更はスーパー管理者のみ可能
                  </p>
                )}
              </FormField>
            </div>

            <div className="mt-6 flex gap-2 justify-end">
              <button
                onClick={closeFormModal}
                className="px-4 py-2 rounded-lg text-sm font-semibold bg-white/5 border border-white/10 hover:bg-white/10"
              >
                キャンセル
              </button>
              <button
                onClick={saveForm}
                disabled={loading}
                className="px-5 py-2 rounded-lg text-sm font-bold bg-gradient-to-r from-indigo-500 to-fuchsia-500 hover:from-indigo-400 hover:to-fuchsia-400 transition disabled:opacity-50"
              >
                {editing ? '更新' : '追加'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ----------------- 小コンポーネント -----------------

function Th({
  children,
  onClick,
  active,
  asc,
}: {
  children: React.ReactNode
  onClick: () => void
  active: boolean
  asc: boolean
}) {
  return (
    <th
      onClick={onClick}
      className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider cursor-pointer hover:text-white"
    >
      <span className="inline-flex items-center gap-1">
        {children}
        {active && <span className="text-indigo-300">{asc ? '▲' : '▼'}</span>}
      </span>
    </th>
  )
}

function RoleSelector({
  value,
  disabled,
  onChange,
}: {
  value: UserRole
  disabled: boolean
  onChange: (role: UserRole) => void
}) {
  if (disabled) {
    return (
      <span
        className={`inline-block px-2.5 py-1 rounded-full text-xs font-semibold border ${ROLE_BADGE[value]}`}
      >
        {ROLE_LABELS[value]}
      </span>
    )
  }
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as UserRole)}
      className={`px-2.5 py-1 rounded-full text-xs font-semibold border bg-slate-900 ${ROLE_BADGE[value]} focus:outline-none focus:ring-2 focus:ring-indigo-400 cursor-pointer`}
    >
      <option value="user">入力者</option>
      <option value="admin">管理者</option>
      <option value="super_admin">スーパー管理者</option>
    </select>
  )
}

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs font-semibold text-slate-400 mb-1.5">{label}</span>
      {children}
    </label>
  )
}
