'use server'

import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import { cookies, headers } from 'next/headers'

/**
 * 動的にサイトのオリジン(URL)を解決する。
 * - 優先1: `NEXT_PUBLIC_SITE_URL` 環境変数
 * - 優先2: リクエストヘッダの origin / host
 * - フォールバック: http://localhost:3000
 */
async function resolveSiteOrigin(): Promise<string> {
  if (process.env.NEXT_PUBLIC_SITE_URL) {
    return process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, '')
  }
  try {
    const h = await headers()
    const origin = h.get('origin')
    if (origin) return origin
    const host = h.get('host')
    const proto = h.get('x-forwarded-proto') ?? 'https'
    if (host) return `${proto}://${host}`
  } catch {
    // ヘッダ取得失敗時はフォールバック
  }
  return 'http://localhost:3000'
}

/**
 * Googleアカウントでサインイン。
 * Supabase の OAuth フローを開始し、認可URLにリダイレクトする。
 */
export async function signInWithGoogle() {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)

  const origin = await resolveSiteOrigin()

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${origin}/auth/callback`,
      queryParams: {
        access_type: 'offline',
        prompt: 'select_account',
      },
    },
  })

  if (error || !data?.url) {
    console.error('Google OAuth開始エラー:', error?.message)
    return { error: `Googleログインの開始に失敗しました: ${error?.message ?? 'unknown error'}` }
  }

  redirect(data.url)
}

/**
 * ログアウト。
 */
export async function logout() {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)
  await supabase.auth.signOut()
  redirect('/login')
}
