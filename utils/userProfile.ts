import type { SupabaseClient } from '@supabase/supabase-js'

export type UserRole = 'user' | 'admin' | 'super_admin'

export interface UserProfile {
  id: number
  user_id: string | null
  email: string
  display_name: string
  last_name: string | null
  first_name: string | null
  role: UserRole
  created_at: string
  updated_at: string
}

export const ROLE_LABELS: Record<UserRole, string> = {
  user: '入力者',
  admin: '管理者',
  super_admin: 'スーパー管理者',
}

export const isAdminRole = (role?: UserRole | string | null): boolean =>
  role === 'admin' || role === 'super_admin'

export const isSuperAdminRole = (role?: UserRole | string | null): boolean =>
  role === 'super_admin'

/**
 * 現在ログイン中ユーザーのプロフィール（role 含む）を取得。
 * 未登録 / 未ログインなら null を返す。
 */
export async function fetchCurrentProfile(
  supabase: SupabaseClient
): Promise<UserProfile | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const { data, error } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle()

  if (error) {
    console.error('fetchCurrentProfile error:', error)
    return null
  }
  return (data as UserProfile | null) ?? null
}
