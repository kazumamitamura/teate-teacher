'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import { fetchCurrentProfile, isAdminRole, type UserProfile } from '@/utils/userProfile'

/**
 * 管理画面用: DB の role が admin / super_admin か確認する。
 * 未ログイン → /login、権限なし → / へリダイレクト。
 */
export function useRequireAdmin() {
  const router = useRouter()
  const supabase = createClient()
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [authorized, setAuthorized] = useState(false)

  useEffect(() => {
    const check = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }
      const p = await fetchCurrentProfile(supabase)
      if (!p || !isAdminRole(p.role)) {
        alert('管理者権限がありません')
        router.push('/')
        return
      }
      setProfile(p)
      setAuthorized(true)
      setLoading(false)
    }
    check()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return { profile, loading, authorized, supabase }
}
