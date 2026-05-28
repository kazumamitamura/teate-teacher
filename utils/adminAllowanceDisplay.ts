import { ACCOMMODATION_TYPES, parseStoredAllowance } from './allowanceSpecR8'

export type AdminAllowanceView = {
  activityLabel: string
  regionLabel: string
  supplement: string | null
  accommodationLabel: string | null
  hasDriving: boolean
}

/** DB保存用メタデータ（__r8__:...）を除去して表示用テキストだけ残す */
export function stripR8Meta(text: string | null | undefined): string {
  if (!text) return ''
  return text.replace(/\s*__r8__:\{.+}$/, '').trim()
}

export function formatAllowanceForAdmin(allowance: {
  activity_type?: string
  destination_type?: string | null
  destination_detail?: string | null
  is_driving?: boolean
  is_accommodation?: boolean
}): AdminAllowanceView {
  const parsed = parseStoredAllowance(allowance)
  const stripped = stripR8Meta(allowance.destination_detail)

  let accommodationLabel: string | null = null
  if (allowance.is_accommodation) {
    if (parsed.accommodationType) {
      accommodationLabel =
        ACCOMMODATION_TYPES.find((a) => a.id === parsed.accommodationType)?.label ?? null
    }
    if (!accommodationLabel && stripped) {
      const match = stripped.match(/宿泊:\s*(.+?)(?:\s*\/\s*|$)/)
      accommodationLabel = match?.[1]?.trim() ?? 'あり'
    }
  }

  let supplement: string | null = null
  if (parsed.businessType === 'DISASTER' && parsed.disasterNote.trim()) {
    supplement = parsed.disasterNote.trim()
  } else if (stripped) {
    const parts = stripped
      .split(' / ')
      .map((p) => p.trim())
      .filter((p) => p && !p.startsWith('宿泊:'))
    supplement = parts.length > 0 ? parts.join(' / ') : null
  }

  return {
    activityLabel: allowance.activity_type?.trim() || '（未設定）',
    regionLabel: allowance.destination_type?.trim() || '-',
    supplement,
    accommodationLabel,
    hasDriving: !!allowance.is_driving,
  }
}

/** Excel出力などプレーンテキスト向けの1行要約 */
export function formatAllowanceSummaryText(view: AdminAllowanceView): string {
  const parts = [view.activityLabel]
  if (view.supplement) parts.push(view.supplement)
  if (view.accommodationLabel) parts.push(`宿泊: ${view.accommodationLabel}`)
  if (view.hasDriving) parts.push('運転あり')
  return parts.join(' / ')
}
