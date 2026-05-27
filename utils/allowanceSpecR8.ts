/**
 * 令和8年度 教員特殊勤務手当 — 入力仕様（スプレッドシート準拠）
 */

export const REGION_OPTIONS = [
  { id: 'shonai_mogami', label: '庄内・最上' },
  { id: 'murayama_oki', label: '村山・置賜' },
  { id: 'other_pref', label: '他県' },
  { id: 'hokkaido', label: '北海道地方' },
  { id: 'kinki', label: '近畿地方' },
  { id: 'chugoku', label: '中国地方' },
  { id: 'shikoku', label: '四国地方' },
  { id: 'kyushu_okinawa', label: '九州・沖縄地方' },
] as const

export const BUSINESS_TYPES = [
  {
    id: 'TRAINING',
    label: '研修旅行等引率手当',
    shortLabel: '研修旅行等引率',
    description: '日当は8時間程度（就寝は含みません）',
    icon: '🎒',
    fixedAmount: 3400,
  },
  {
    id: 'TRIP',
    label: '出張手当',
    shortLabel: '出張（勤務日以外）',
    description: '勤務日の出張には支給しません',
    icon: '✈️',
    fixedAmount: 3400,
  },
  {
    id: 'SPORTS',
    label: '対外運動競技等引率手当',
    shortLabel: '対外運動競技等引率',
    description: '指定大会に限ります',
    icon: '🏆',
  },
  {
    id: 'CLUB',
    label: '部活動指導手当',
    shortLabel: '部活動指導',
    description: '部活動の指導・運転など',
    icon: '⚽',
  },
  {
    id: 'DISASTER',
    label: '災害時等',
    shortLabel: '災害時等',
    description: '内容を記入（500文字以内）',
    icon: '🆘',
    fixedAmount: 6000,
  },
] as const

export type BusinessTypeId = (typeof BUSINESS_TYPES)[number]['id'] | ''

export const SPORTS_SUB_OPTIONS = [
  { id: 'sports_full', label: '1日（庄内・新庄・最上の運転を含む）', amount: 3400, isDriving: false },
  { id: 'sports_half', label: '半日（庄内・新庄・最上の運転を含む）', amount: 1700, isDriving: false },
  { id: 'sports_drive_mid', label: 'マイクロ・大型の運転（庄内・新庄・最上以遠）', amount: 7500, isDriving: true },
  { id: 'sports_drive_out', label: 'マイクロ・大型の運転（県外・500km上限）', amount: 10000, isDriving: true },
] as const

export const CLUB_SUB_OPTIONS = [
  { id: 'club_full', label: '1日（庄内・新庄・最上の運転を含む）', amount: 2400, isDriving: false },
  { id: 'club_half', label: '半日（庄内・新庄・最上の運転を含む）', amount: 1700, isDriving: false },
  { id: 'club_drive_mid', label: 'マイクロ・大型の運転（庄内・新庄・最上以遠）', amount: 7500, workDayAmount: 5100, isDriving: true },
  { id: 'club_drive_out', label: 'マイクロ・大型の運転（県外・500km上限）', amount: 10000, workDayAmount: 7600, isDriving: true },
] as const

export const ACCOMMODATION_TYPES = [
  {
    id: 'OFFICIAL',
    label: '校務出張の宿泊（生徒引率なし）',
    amount: 3400,
    description: '校務出張における宿泊を伴う業務',
  },
  {
    id: 'WITH_STUDENTS',
    label: '大会・遠征・合宿の宿泊（生徒引率あり）',
    amount: 2400,
    description: '宿泊日に対して支給',
  },
  {
    id: 'DORM',
    label: '郷友寮宿泊業務（宿直）',
    amount: 4700,
    description: '宿泊に対して支給',
  },
] as const

export type AllowanceInputState = {
  regionId: string
  businessType: BusinessTypeId
  subOptionId: string
  disasterNote: string
  accommodationEnabled: boolean
  accommodationType: '' | (typeof ACCOMMODATION_TYPES)[number]['id']
}

export const EMPTY_ALLOWANCE_INPUT: AllowanceInputState = {
  regionId: '',
  businessType: '',
  subOptionId: '',
  disasterNote: '',
  accommodationEnabled: false,
  accommodationType: '',
}

const R8_META_PREFIX = '__r8__:'

export function isWorkDayFromDayType(dayType: string): boolean {
  if (!dayType?.trim() || dayType === '---') return false
  if (dayType.includes('(仮)')) return false
  return !dayType.includes('休日') && (dayType.includes('勤務日') || dayType.includes('授業'))
}

export function getRegionLabel(regionId: string): string {
  return REGION_OPTIONS.find((r) => r.id === regionId)?.label ?? ''
}

function getSubOption(businessType: BusinessTypeId, subOptionId: string) {
  if (businessType === 'SPORTS') return SPORTS_SUB_OPTIONS.find((o) => o.id === subOptionId)
  if (businessType === 'CLUB') return CLUB_SUB_OPTIONS.find((o) => o.id === subOptionId)
  return undefined
}

export function calculateMainAmount(state: AllowanceInputState, isWorkDay: boolean): number {
  if (!state.businessType) return 0

  if (state.businessType === 'TRAINING') return 3400

  if (state.businessType === 'TRIP') {
    return isWorkDay ? 0 : 3400
  }

  if (state.businessType === 'DISASTER') return 6000

  const sub = getSubOption(state.businessType, state.subOptionId)
  if (!sub) return 0

  if (state.businessType === 'CLUB' && isWorkDay && 'workDayAmount' in sub && sub.workDayAmount != null) {
    return sub.workDayAmount
  }
  return sub.amount
}

export function getAccommodationAmount(state: AllowanceInputState): number {
  if (!state.accommodationEnabled || !state.accommodationType) return 0
  return ACCOMMODATION_TYPES.find((a) => a.id === state.accommodationType)?.amount ?? 0
}

export function calculateR8Total(state: AllowanceInputState, dayType: string): number {
  const isWorkDay = isWorkDayFromDayType(dayType)
  return calculateMainAmount(state, isWorkDay) + getAccommodationAmount(state)
}

export type AmountLine = { label: string; amount: number }

export function getAmountBreakdown(state: AllowanceInputState, dayType: string): AmountLine[] {
  const lines: AmountLine[] = []
  if (!state.businessType && !state.accommodationEnabled) return lines

  const isWorkDay = isWorkDayFromDayType(dayType)
  const main = calculateMainAmount(state, isWorkDay)

  if (state.businessType === 'TRAINING') {
    lines.push({ label: '研修旅行等引率手当', amount: main })
  } else if (state.businessType === 'TRIP') {
    if (isWorkDay) {
      lines.push({ label: '出張手当（勤務日のため支給なし）', amount: 0 })
    } else {
      lines.push({ label: '出張手当', amount: main })
    }
  } else if (state.businessType === 'DISASTER') {
    lines.push({ label: '災害時等', amount: main })
  } else if (state.businessType === 'SPORTS' || state.businessType === 'CLUB') {
    const sub = getSubOption(state.businessType, state.subOptionId)
    const biz = BUSINESS_TYPES.find((b) => b.id === state.businessType)
    lines.push({ label: sub ? `${biz?.shortLabel}（${sub.label}）` : biz?.label ?? '', amount: main })
  }

  if (state.accommodationEnabled && state.accommodationType) {
    const acc = ACCOMMODATION_TYPES.find((a) => a.id === state.accommodationType)
    if (acc) lines.push({ label: `宿泊業務手当（${acc.label}）`, amount: acc.amount })
  }

  return lines
}

/** DB保存用の表示ラベル */
export function buildActivityTypeLabel(state: AllowanceInputState): string {
  if (!state.businessType) return ''
  const biz = BUSINESS_TYPES.find((b) => b.id === state.businessType)
  if (!biz) return ''

  if (state.businessType === 'SPORTS' || state.businessType === 'CLUB') {
    const sub = getSubOption(state.businessType, state.subOptionId)
    return sub ? `${biz.label}（${sub.label}）` : biz.label
  }
  return biz.label
}

export function buildDestinationDetail(state: AllowanceInputState): string {
  const parts: string[] = []
  if (state.businessType === 'DISASTER' && state.disasterNote.trim()) {
    parts.push(state.disasterNote.trim())
  }
  if (state.accommodationEnabled && state.accommodationType) {
    const acc = ACCOMMODATION_TYPES.find((a) => a.id === state.accommodationType)
    if (acc) parts.push(`宿泊: ${acc.label}`)
  }
  const meta = {
    v: 1,
    businessType: state.businessType,
    subOptionId: state.subOptionId,
    disasterNote: state.disasterNote,
    accommodationEnabled: state.accommodationEnabled,
    accommodationType: state.accommodationType,
  }
  const metaStr = R8_META_PREFIX + JSON.stringify(meta)
  if (parts.length === 0) return metaStr
  return parts.join(' / ') + ' ' + metaStr
}

export function serializeForSave(state: AllowanceInputState, dayType: string) {
  const isWorkDay = isWorkDayFromDayType(dayType)
  const sub = getSubOption(state.businessType, state.subOptionId)
  const amount = calculateR8Total(state, dayType)

  return {
    activity_type: buildActivityTypeLabel(state),
    destination_type: getRegionLabel(state.regionId),
    destination_detail: buildDestinationDetail(state),
    amount,
    is_driving: sub?.isDriving ?? false,
    is_accommodation: state.accommodationEnabled && !!state.accommodationType,
  }
}

export function parseStoredAllowance(allowance: {
  activity_type?: string
  destination_type?: string | null
  destination_detail?: string | null
  amount?: number
  is_driving?: boolean
  is_accommodation?: boolean
}): AllowanceInputState {
  const detail = allowance.destination_detail ?? ''
  const metaMatch = detail.match(/__r8__:({.+})$/)
  if (metaMatch) {
    try {
      const meta = JSON.parse(metaMatch[1]) as Partial<AllowanceInputState> & { v?: number }
      const region =
        REGION_OPTIONS.find((r) => r.label === (allowance.destination_type ?? ''))?.id ?? ''
      return {
        regionId: region,
        businessType: (meta.businessType as BusinessTypeId) ?? '',
        subOptionId: meta.subOptionId ?? '',
        disasterNote: meta.disasterNote ?? '',
        accommodationEnabled: !!meta.accommodationEnabled,
        accommodationType: (meta.accommodationType as AllowanceInputState['accommodationType']) ?? '',
      }
    } catch {
      /* fall through */
    }
  }

  return parseLegacyAllowance(allowance)
}

function parseLegacyAllowance(allowance: {
  activity_type?: string
  destination_type?: string | null
  destination_detail?: string | null
  amount?: number
  is_driving?: boolean
  is_accommodation?: boolean
}): AllowanceInputState {
  const act = allowance.activity_type ?? ''
  const destLabel = allowance.destination_type ?? ''
  const region =
    REGION_OPTIONS.find((r) => r.label === destLabel)?.id ??
    (destLabel.includes('県外')
      ? 'other_pref'
      : destLabel.includes('120') || destLabel.includes('県内')
        ? 'murayama_oki'
        : 'shonai_mogami')

  let businessType: BusinessTypeId = ''
  let subOptionId = ''
  let disasterNote = allowance.destination_detail ?? ''
  let accommodationEnabled = !!allowance.is_accommodation
  let accommodationType: AllowanceInputState['accommodationType'] = accommodationEnabled
    ? 'WITH_STUDENTS'
    : ''

  if (act.includes('研修') || act.includes('G:')) businessType = 'TRAINING'
  else if (act.includes('出張')) businessType = 'TRIP'
  else if (act.includes('災害')) {
    businessType = 'DISASTER'
    disasterNote = (allowance.destination_detail ?? '').replace(/__r8__:.*/, '').trim()
  } else if (act.includes('指定') || act.includes('C:') || act.includes('対外')) {
    businessType = 'SPORTS'
    if (act.includes('半日')) subOptionId = 'sports_half'
    else if (allowance.is_driving && (allowance.amount ?? 0) >= 10000) subOptionId = 'sports_drive_out'
    else if (allowance.is_driving) subOptionId = 'sports_drive_mid'
    else if (act.includes('半日')) subOptionId = 'sports_half'
    else subOptionId = 'sports_full'
  } else if (
    act.includes('部活') ||
    act.includes('遠征') ||
    act.includes('合宿') ||
    /^[ABEF]:/.test(act)
  ) {
    businessType = 'CLUB'
    if (act.includes('半日') || act.includes('B:')) subOptionId = 'club_half'
    else if (allowance.is_driving && (allowance.amount ?? 0) >= 10000) subOptionId = 'club_drive_out'
    else if (allowance.is_driving) subOptionId = 'club_drive_mid'
    else subOptionId = 'club_full'
  }

  return {
    regionId: region,
    businessType,
    subOptionId,
    disasterNote,
    accommodationEnabled,
    accommodationType,
  }
}

export function validateAllowanceInput(
  state: AllowanceInputState,
  dayType: string
): { ok: boolean; message?: string } {
  const hasMain = !!state.businessType
  const hasAcc = state.accommodationEnabled && !!state.accommodationType

  if (!hasMain && !hasAcc) {
    if (state.regionId || state.subOptionId || state.disasterNote.trim()) {
      return { ok: false, message: '入力が途中です。業務の種類を選ぶか、「手当なし」を選んでください。' }
    }
    return { ok: true }
  }

  if (!state.regionId) {
    return { ok: false, message: '行き先（地域）を選んでください。' }
  }

  if (!hasMain) {
    return { ok: false, message: '宿泊のみの登録はできません。先に業務の種類を選んでください。' }
  }

  if (state.businessType === 'SPORTS' || state.businessType === 'CLUB') {
    if (!state.subOptionId) {
      return { ok: false, message: '業務内容（1日・半日・運転など）を選んでください。' }
    }
  }

  if (state.businessType === 'DISASTER') {
    if (!state.disasterNote.trim()) {
      return { ok: false, message: '災害時等の内容を記入してください。' }
    }
    if (state.disasterNote.length > 500) {
      return { ok: false, message: '災害時等の内容は500文字以内で入力してください。' }
    }
  }

  if (state.businessType === 'TRIP' && isWorkDayFromDayType(dayType)) {
    return {
      ok: false,
      message: '出張手当は勤務日には支給されません。別の業務の種類を選ぶか、勤務日でない日を選んでください。',
    }
  }

  if (state.accommodationEnabled && !state.accommodationType) {
    return { ok: false, message: '宿泊業務手当の種類を選んでください。' }
  }

  if (calculateR8Total(state, dayType) <= 0 && hasMain) {
    return { ok: false, message: '支給額が0円です。選択内容を見直してください。' }
  }

  return { ok: true }
}
