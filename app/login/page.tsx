'use client'

import { Suspense, useState, useTransition } from 'react'
import { useSearchParams } from 'next/navigation'
import { signInWithGoogle } from '../auth/actions'

function LoginContent() {
  const searchParams = useSearchParams()
  const initialError = searchParams.get('error') ?? ''
  const [error, setError] = useState<string>(initialError)
  const [isPending, startTransition] = useTransition()

  const allowedDomain = process.env.NEXT_PUBLIC_ALLOWED_EMAIL_DOMAIN

  const handleGoogleSignIn = () => {
    setError('')
    startTransition(async () => {
      const result = await signInWithGoogle()
      if (result?.error) {
        setError(result.error)
      }
    })
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-950 text-slate-100 flex items-center justify-center p-6">
      {/* 背景グラデーション・装飾 */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-32 -left-32 h-96 w-96 rounded-full bg-indigo-500/30 blur-3xl" />
        <div className="absolute -bottom-32 -right-32 h-[28rem] w-[28rem] rounded-full bg-fuchsia-500/20 blur-3xl" />
        <div className="absolute top-1/2 left-1/2 h-[36rem] w-[36rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-cyan-500/10 blur-3xl" />
      </div>

      <div className="relative w-full max-w-md">
        {/* ヘッダー */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center h-16 w-16 rounded-2xl bg-gradient-to-br from-indigo-500 via-purple-500 to-fuchsia-500 shadow-lg shadow-indigo-500/40 mb-5">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-8 w-8 text-white"
            >
              <path d="M12 2 4 6v6c0 5 3.5 9.5 8 10 4.5-.5 8-5 8-10V6l-8-4z" />
              <path d="m9 12 2 2 4-4" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-white via-indigo-200 to-fuchsia-200 bg-clip-text text-transparent">
            手当管理システム
          </h1>
          <p className="mt-3 text-sm text-slate-400">
            特殊勤務手当の入力・申請・集計をシンプルに
          </p>
        </div>

        {/* メインカード */}
        <div className="relative rounded-3xl bg-white/5 backdrop-blur-xl border border-white/10 shadow-2xl shadow-black/50 p-8">
          <div className="absolute inset-x-8 -top-px h-px bg-gradient-to-r from-transparent via-white/40 to-transparent" />

          <h2 className="text-xl font-semibold text-white mb-2">ログイン</h2>
          <p className="text-sm text-slate-400 mb-6">
            学校発行のGoogleアカウントでログインしてください。
          </p>

          {/* エラーメッセージ */}
          {error && (
            <div className="mb-6 rounded-xl border border-red-500/40 bg-red-500/10 p-4">
              <p className="text-sm text-red-200 leading-relaxed whitespace-pre-line">
                {error}
              </p>
            </div>
          )}

          {/* Googleログインボタン */}
          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={isPending}
            className="group relative w-full overflow-hidden rounded-xl bg-white px-6 py-4 text-slate-900 font-semibold shadow-lg transition-all duration-200 hover:shadow-xl hover:shadow-indigo-500/30 hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-3"
          >
            <span className="absolute inset-0 bg-gradient-to-r from-indigo-50 via-white to-purple-50 opacity-0 transition-opacity group-hover:opacity-100" />
            {isPending ? (
              <>
                <svg
                  className="relative animate-spin h-5 w-5 text-slate-700"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                <span className="relative">Googleへ移動中…</span>
              </>
            ) : (
              <>
                <svg className="relative h-5 w-5" viewBox="0 0 48 48" aria-hidden="true">
                  <path
                    fill="#FFC107"
                    d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"
                  />
                  <path
                    fill="#FF3D00"
                    d="m6.306 14.691 6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z"
                  />
                  <path
                    fill="#4CAF50"
                    d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238C29.211 35.091 26.715 36 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"
                  />
                  <path
                    fill="#1976D2"
                    d="M43.611 20.083H42V20H24v8h11.303a12.04 12.04 0 0 1-4.087 5.571l.003-.002 6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z"
                  />
                </svg>
                <span className="relative">Googleでログイン</span>
              </>
            )}
          </button>

          {/* 区切り線 */}
          <div className="my-6 flex items-center gap-3">
            <div className="h-px flex-1 bg-white/10" />
            <span className="text-[11px] uppercase tracking-widest text-slate-500">
              Secured by Google
            </span>
            <div className="h-px flex-1 bg-white/10" />
          </div>

          {/* 注意書き */}
          <div className="rounded-xl bg-slate-900/40 border border-white/5 p-4">
            <p className="text-xs text-slate-400 leading-relaxed">
              {allowedDomain ? (
                <>
                  <span className="font-semibold text-slate-200">
                    @{allowedDomain}
                  </span>{' '}
                  のメールアドレスを持つアカウントのみログインできます。
                  <br />
                  個人のGoogleアカウントではログインできません。
                </>
              ) : (
                <>
                  学校発行のGoogleアカウントでログインしてください。
                </>
              )}
            </p>
          </div>
        </div>

        {/* フッター */}
        <div className="mt-8 text-center">
          <p className="text-xs text-slate-500">
            © 2026 手当管理システム
          </p>
        </div>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-950 flex items-center justify-center">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-white/20 border-t-white" />
        </div>
      }
    >
      <LoginContent />
    </Suspense>
  )
}
