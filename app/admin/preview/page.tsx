'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function PreviewRedirectPage() {
  const router = useRouter()

  useEffect(() => {
    router.replace('/admin/allowances?tab=preview')
  }, [router])

  return <div className="p-10 text-center">手当管理へ移動しています…</div>
}
