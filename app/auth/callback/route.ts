import { createClient } from '@/utils/supabase/server'
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

/**
 * Google OAuth コールバック。
 * - 認可コードをセッションに交換
 * - 許可ドメイン (`NEXT_PUBLIC_ALLOWED_EMAIL_DOMAIN`) 外のメールは拒否してサインアウト
 * - 初回ログイン時は `user_profiles` に基本情報を upsert
 */
export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const next = requestUrl.searchParams.get('next') || '/'
  const errorParam = requestUrl.searchParams.get('error_description') || requestUrl.searchParams.get('error')

  if (errorParam) {
    const url = new URL('/login', request.url)
    url.searchParams.set('error', errorParam)
    return NextResponse.redirect(url)
  }

  if (!code) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)

  const { data: exchangeData, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)

  if (exchangeError || !exchangeData?.user) {
    const url = new URL('/login', request.url)
    url.searchParams.set('error', exchangeError?.message ?? 'ログインに失敗しました')
    return NextResponse.redirect(url)
  }

  const user = exchangeData.user
  const email = user.email?.toLowerCase() ?? ''
  const allowedDomain = (process.env.NEXT_PUBLIC_ALLOWED_EMAIL_DOMAIN ?? '').toLowerCase().trim()

  if (allowedDomain && !email.endsWith(`@${allowedDomain}`)) {
    await supabase.auth.signOut()
    const url = new URL('/login', request.url)
    url.searchParams.set('error', `「@${allowedDomain}」のメールアドレスのみログインできます。`)
    return NextResponse.redirect(url)
  }

  // 初回ログイン時に user_profiles を整備（存在しない場合のみ）
  try {
    const meta = (user.user_metadata ?? {}) as Record<string, unknown>
    const displayName =
      (typeof meta.full_name === 'string' && meta.full_name) ||
      (typeof meta.name === 'string' && meta.name) ||
      email.split('@')[0]

    await supabase
      .from('user_profiles')
      .upsert(
        {
          user_id: user.id,
          email,
          display_name: displayName,
        },
        { onConflict: 'user_id' }
      )
  } catch (err) {
    console.warn('user_profiles upsert skipped:', err)
  }

  return NextResponse.redirect(new URL(next, request.url))
}
