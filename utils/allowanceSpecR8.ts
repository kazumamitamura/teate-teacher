/**
 * 令和8年度 教員特殊勤務手当 — 入力仕様（スプレッドシート準拠）
 */

export const REGION_OPTIONS = [
  { id: 'under120_shonai_mogami', label: '庄内・最上' },
  { id: 'under120_murayama_oki', label: '120㎞未満（村山・置賜含む）' },
  { id: 'km120_500', label: '120㎞～500㎞未満' },
  { id: 'over500', label: '500㎞以上' },
  { id: 'overseas', label: '海外' },
] as const

export const BUSINESS_TYPES = [
  {
    id: 'TRAINING',
    label: '研修旅行等引率手当',
    shortLabel: '研修旅行等引率',
    description: '日当は8時間程度（就寝は含みません）',
    icon: '🎒',
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

/** 研修旅行等引率手当のサブ区分 */
export const TRAINING_SUB_OPTIONS = [
  {
    id: 'domestic',
    label: '🇯🇵 国内引率',
    description: '国内の修学旅行・研修旅行',
    amount: 3400,
  },
  {
    id: 'overseas',
    label: '🌏 海外引率',
    description: '海外への修学旅行・研修旅行',
    amount: 4700,
  },
] as const

export type TrainingSubType = '' | 'domestic' | 'overseas'

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
  /** 研修旅行等引率手当のサブ区分 */
  trainingSubType: TrainingSubType
  subOptionId: string
  disasterNote: string
  accommodationEnabled: boolean
  accommodationType: '' | (typeof ACCOMMODATION_TYPES)[number]['id']
  /**
   * 複数日入力時の宿泊泊数。
   * 0 or 1 の場合は全日付に同じ宿泊判定。
   * 2以上の場合は日付を昇順ソートして先頭 N 日に宿泊手当を付ける（最終日は除く）。
   */
  accommodationNights: number
}

export const EMPTY_ALLOWANCE_INPUT: AllowanceInputState = {
  regionId: '',
  businessType: '',
  trainingSubType: '',
  subOptionId: '',
  disasterNote: '',
  accommodationEnabled: false,
  accommodationType: '',
  accommodationNights: 0,
}

const R8_META_PREFIX = '__r8__:'

export function isWorkDayFromDayType(dayType: string): boolean {
  if (!dayType?.trim() || dayType === '---') return false
  // 休日を最優先で判定（「休日(仮)」も含む）
  if (dayType.includes('休日')) return false
  // 「勤務日」「勤務日(仮)」「授業日」はすべて勤務日扱い
  return dayType.includes('勤務日') || dayType.includes('授業')
}

export function getRegionLabel(regionId: string): string {
  return REGION_OPTIONS.find((r) => r.id === regionId)?.label ?? ''
}

/** 保存済みデータの行き先ラベル → regionId（旧ラベルも読み込み可能） */
const REGION_LABEL_ALIASES: Record<string, string> = {
  '120km未満（庄内・最上）': 'under120_shonai_mogami',
  '庄内・最上': 'under120_shonai_mogami',
  '村山・置賜': 'under120_murayama_oki',
  '他県': 'km120_500',
  '東北': 'km120_500',
  '北海道地方': 'over500',
  '近畿地方': 'over500',
  '中国地方': 'over500',
  '四国地方': 'over500',
  '九州・沖縄地方': 'over500',
  '海外': 'overseas',
}

export function getRegionIdFromLabel(label: string): string {
  if (REGION_LABEL_ALIASES[label]) return REGION_LABEL_ALIASES[label]
  return REGION_OPTIONS.find((r) => r.label === label)?.id ?? ''
}

function getSubOption(businessType: BusinessTypeId, subOptionId: string) {
  if (businessType === 'SPORTS') return SPORTS_SUB_OPTIONS.find((o) => o.id === subOptionId)
  if (businessType === 'CLUB') return CLUB_SUB_OPTIONS.find((o) => o.id === subOptionId)
  return undefined
}

export function calculateMainAmount(state: AllowanceInputState, isWorkDay: boolean): number {
  if (!state.businessType) return 0

  if (state.businessType === 'TRAINING') {
    const sub = TRAINING_SUB_OPTIONS.find((o) => o.id === state.trainingSubType)
    return sub?.amount ?? 3400
  }

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
    const sub = TRAINING_SUB_OPTIONS.find((o) => o.id === state.trainingSubType)
    const label = sub
      ? `研修旅行等引率手当（${sub.label}）`
      : '研修旅行等引率手当（国内/海外を選択してください）'
    lines.push({ label, amount: main })
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
    // コロン区切りで内側の括弧が二重にならないようにする
    lines.push({ label: sub ? `${biz?.shortLabel}：${sub.label}` : biz?.label ?? '', amount: main })
  }

  if (state.accommodationEnabled && state.accommodationType) {
    const acc = ACCOMMODATION_TYPES.find((a) => a.id === state.accommodationType)
    if (acc) lines.push({ label: `宿泊業務手当（${acc.label}）`, amount: acc.amount })
  }

  return lines
}

/** DB保存用の表示ラベル */
export function buildActivityTypeLabel(state: AllowanceInputState): string {
  if (!state.businessType) {
    if (state.accommodationEnabled && state.accommodationType) {
      const acc = ACCOMMODATION_TYPES.find((a) => a.id === state.accommodationType)
      return acc ? `宿泊業務手当（${acc.label}）` : '宿泊業務手当'
    }
    return ''
  }
  const biz = BUSINESS_TYPES.find((b) => b.id === state.businessType)
  if (!biz) return ''

  if (state.businessType === 'TRAINING') {
    const sub = TRAINING_SUB_OPTIONS.find((o) => o.id === state.trainingSubType)
    return sub ? `${biz.label}（${sub.label}）` : biz.label
  }

  if (state.businessType === 'SPORTS' || state.businessType === 'CLUB') {
    const sub = getSubOption(state.businessType, state.subOptionId)
    // コロン区切りで内側の括弧が二重にならないようにする
    return sub ? `${biz.label}：${sub.label}` : biz.label
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
    v: 2,
    businessType: state.businessType,
    trainingSubType: state.trainingSubType,
    subOptionId: state.subOptionId,
    disasterNote: state.disasterNote,
    accommodationEnabled: state.accommodationEnabled,
    accommodationType: state.accommodationType,
    accommodationNights: state.accommodationNights,
  }
  const metaStr = R8_META_PREFIX + JSON.stringify(meta)
  if (parts.length === 0) return metaStr
  return parts.join(' / ') + ' ' + metaStr
}

/**
 * 日付1件ぶんのシリアライズ。
 * multiDateIndex: 複数日のうち何番目か（0始まり）。宿泊泊数との比較に使用。
 */
export function serializeForSave(
  state: AllowanceInputState,
  dayType: string,
  multiDateIndex = 0,
) {
  const isWorkDay = isWorkDayFromDayType(dayType)
  const sub = getSubOption(state.businessType, state.subOptionId)

  // 宿泊判定: 泊数が設定されていれば日付インデックスで判定、なければ enabled フラグ通り
  const nights = state.accommodationNights
  const hasAccommodationThisDay =
    state.accommodationEnabled &&
    !!state.accommodationType &&
    (nights <= 0 ? true : multiDateIndex < nights)

  const stateForCalc: AllowanceInputState = {
    ...state,
    accommodationEnabled: hasAccommodationThisDay,
  }
  const amount = calculateR8Total(stateForCalc, dayType)

  return {
    activity_type: buildActivityTypeLabel(state),
    destination_type: getRegionLabel(state.regionId),
    destination_detail: buildDestinationDetail(state),
    amount,
    is_driving: sub?.isDriving ?? false,
    is_accommodation: hasAccommodationThisDay,
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
      const region = getRegionIdFromLabel(allowance.destination_type ?? '')
      return {
        regionId: region,
        businessType: (meta.businessType as BusinessTypeId) ?? '',
        trainingSubType: (meta.trainingSubType as TrainingSubType) ?? '',
        subOptionId: meta.subOptionId ?? '',
        disasterNote: meta.disasterNote ?? '',
        accommodationEnabled: !!meta.accommodationEnabled,
        accommodationType: (meta.accommodationType as AllowanceInputState['accommodationType']) ?? '',
        accommodationNights: meta.accommodationNights ?? 0,
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
    getRegionIdFromLabel(destLabel) ||
    (destLabel.includes('500') && destLabel.includes('以上')
      ? 'over500'
      : destLabel.includes('120') && destLabel.includes('500')
        ? 'km120_500'
        : destLabel.includes('村山') || destLabel.includes('置賜') || destLabel.includes('県内')
          ? 'under120_murayama_oki'
          : destLabel.includes('庄内') || destLabel.includes('最上')
            ? 'under120_shonai_mogami'
            : destLabel.includes('海外')
              ? 'overseas'
              : destLabel.includes('県外')
              ? 'km120_500'
              : 'under120_shonai_mogami')

  let businessType: BusinessTypeId = ''
  let trainingSubType: TrainingSubType = ''
  let subOptionId = ''
  let disasterNote = allowance.destination_detail ?? ''
  let accommodationEnabled = !!allowance.is_accommodation
  let accommodationType: AllowanceInputState['accommodationType'] = accommodationEnabled
    ? 'WITH_STUDENTS'
    : ''

  if (act.includes('研修') || act.includes('G:')) {
    businessType = 'TRAINING'
    trainingSubType = act.includes('海外') ? 'overseas' : 'domestic'
  } else if (act.includes('出張')) {
    businessType = 'TRIP'
  } else if (act.includes('災害')) {
    businessType = 'DISASTER'
    disasterNote = (allowance.destination_detail ?? '').replace(/__r8__:.*/, '').trim()
  } else if (act.includes('指定') || act.includes('C:') || act.includes('対外')) {
    businessType = 'SPORTS'
    if (act.includes('半日')) subOptionId = 'sports_half'
    else if (allowance.is_driving && (allowance.amount ?? 0) >= 10000) subOptionId = 'sports_drive_out'
    else if (allowance.is_driving) subOptionId = 'sports_drive_mid'
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
    trainingSubType,
    subOptionId,
    disasterNote,
    accommodationEnabled,
    accommodationType,
    accommodationNights: 0,
  }
}

/** 業務の種類なしで郷友寮宿泊業務（宿直）のみ選択されている */
export function isDormOnlySelection(state: AllowanceInputState): boolean {
  return (
    !state.businessType &&
    state.accommodationEnabled &&
    state.accommodationType === 'DORM'
  )
}

/**
 * 複数日入力の保存用に、個別設定日の入力を共通設定の宿泊泊数とマージする。
 * 中間日だけ業務内容を変えても、連泊の宿泊手当は選択日数全体で判定する。
 */
export function buildInputForMultiDateSave(
  common: AllowanceInputState,
  dateInput: AllowanceInputState,
  isOverride: boolean,
): AllowanceInputState {
  if (!isOverride) return dateInput
  return {
    ...dateInput,
    accommodationNights: common.accommodationNights,
    accommodationEnabled: dateInput.accommodationEnabled || common.accommodationEnabled,
    accommodationType: dateInput.accommodationType || common.accommodationType,
  }
}

/** 行き先（地域）の選択が必須かどうか */
export function isRegionRequired(state: AllowanceInputState): boolean {
  if (isDormOnlySelection(state)) return false
  const hasMain = !!state.businessType
  const hasAcc = state.accommodationEnabled && !!state.accommodationType
  return hasMain || hasAcc
}

export function validateAllowanceInput(
  state: AllowanceInputState,
  dayType: string,
  totalDates = 1,
): { ok: boolean; message?: string } {
  const hasMain = !!state.businessType
  const hasAcc = state.accommodationEnabled && !!state.accommodationType

  if (!hasMain && !hasAcc) {
    if (state.accommodationEnabled) {
      return { ok: false, message: '宿泊業務手当の種類を選んでください。' }
    }
    if (state.regionId || state.subOptionId || state.disasterNote.trim()) {
      return {
        ok: false,
        message: '入力が途中です。業務の種類または宿泊業務手当を選んでください。',
      }
    }
    return { ok: true }
  }

  if (isRegionRequired(state) && !state.regionId) {
    return { ok: false, message: '行き先（地域）を選んでください。' }
  }

  if (state.businessType === 'TRAINING' && !state.trainingSubType) {
    return { ok: false, message: '国内引率・海外引率のどちらかを選んでください。' }
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
      message: '出張手当は勤務日には支給されません。別の業務の種類を選んでください。',
    }
  }

  if (state.accommodationEnabled && !state.accommodationType) {
    return { ok: false, message: '宿泊業務手当の種類を選んでください。' }
  }

  if (state.accommodationEnabled && state.accommodationNights > 0) {
    if (state.accommodationNights >= totalDates) {
      return {
        ok: false,
        message: `宿泊泊数（${state.accommodationNights}泊）は選択日数（${totalDates}日）より少なくしてください。最終日には宿泊手当が付かないため。`,
      }
    }
  }

  return { ok: true }
}
