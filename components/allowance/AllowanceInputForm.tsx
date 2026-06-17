'use client'

import {
  ACCOMMODATION_TYPES,
  BUSINESS_TYPES,
  CLUB_SUB_OPTIONS,
  REGION_OPTIONS,
  SPORTS_SUB_OPTIONS,
  TRAINING_SUB_OPTIONS,
  type AllowanceInputState,
  type AmountLine,
  getAmountBreakdown,
  isDormOnlySelection,
  isRegionRequired,
  isWorkDayFromDayType,
} from '@/utils/allowanceSpecR8'

type Props = {
  value: AllowanceInputState
  onChange: (next: AllowanceInputState) => void
  dayType: string
  isLocked: boolean
  totalAmount: number
  /** 複数日選択時の合計日数（宿泊泊数の上限チェックに使用） */
  totalDates?: number
}

// ─── セクションコンポーネント ───────────────────────────────────────────────

type SectionProps = {
  step: number
  title: string
  hint?: string
  color: 'blue' | 'purple' | 'indigo' | 'amber' | 'slate'
  children: React.ReactNode
}

const SECTION_STYLES: Record<SectionProps['color'], { border: string; badge: string; title: string; bg: string }> = {
  blue:   { border: 'border-l-blue-500',   badge: 'bg-blue-600',   title: 'text-blue-900',   bg: 'bg-blue-50/60' },
  purple: { border: 'border-l-purple-500', badge: 'bg-purple-600', title: 'text-purple-900', bg: 'bg-purple-50/60' },
  indigo: { border: 'border-l-indigo-500', badge: 'bg-indigo-600', title: 'text-indigo-900', bg: 'bg-indigo-50/60' },
  amber:  { border: 'border-l-amber-500',  badge: 'bg-amber-600',  title: 'text-amber-900',  bg: 'bg-amber-50/60' },
  slate:  { border: 'border-l-slate-400',  badge: 'bg-slate-600',  title: 'text-slate-900',  bg: 'bg-slate-50/60' },
}

function Section({ step, title, hint, color, children }: SectionProps) {
  const s = SECTION_STYLES[color]
  return (
    <section className={`rounded-2xl border border-slate-200 border-l-4 ${s.border} ${s.bg} p-4 sm:p-5`}>
      <div className="mb-3 flex items-start gap-3">
        <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${s.badge} text-sm font-bold text-white shadow`}>
          {step}
        </span>
        <div>
          <h3 className={`text-base font-bold ${s.title}`}>{title}</h3>
          {hint && <p className="mt-0.5 text-xs leading-relaxed text-slate-500">{hint}</p>}
        </div>
      </div>
      {children}
    </section>
  )
}

// ─── カード選択ボタン ──────────────────────────────────────────────────────

function ChoiceCard({
  selected,
  disabled,
  onClick,
  title,
  description,
  amount,
  icon,
  accentColor = 'blue',
}: {
  selected: boolean
  disabled?: boolean
  onClick: () => void
  title: string
  description?: string
  amount?: number
  icon?: string
  accentColor?: 'blue' | 'purple' | 'indigo' | 'amber'
}) {
  const accent: Record<string, string> = {
    blue:   'border-blue-500 bg-blue-50 ring-2 ring-blue-200',
    purple: 'border-purple-500 bg-purple-50 ring-2 ring-purple-200',
    indigo: 'border-indigo-500 bg-indigo-50 ring-2 ring-indigo-200',
    amber:  'border-amber-500 bg-amber-50 ring-2 ring-amber-200',
  }
  const amountBadge: Record<string, string> = {
    blue:   'bg-blue-100 text-blue-800',
    purple: 'bg-purple-100 text-purple-800',
    indigo: 'bg-indigo-100 text-indigo-800',
    amber:  'bg-amber-100 text-amber-800',
  }
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`w-full rounded-xl border-2 p-4 text-left transition-all touch-manipulation ${
        selected
          ? accent[accentColor]
          : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
      } ${disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex gap-3 items-start">
          {icon && <span className="text-2xl leading-none mt-0.5">{icon}</span>}
          <div>
            <p className="font-bold text-slate-900 text-sm sm:text-base leading-snug">{title}</p>
            {description && <p className="mt-1 text-xs text-slate-500 leading-snug">{description}</p>}
          </div>
        </div>
        {amount != null && (
          <span className={`shrink-0 rounded-lg px-2 py-1 text-sm font-bold ${amountBadge[accentColor]}`}>
            ¥{amount.toLocaleString()}
          </span>
        )}
      </div>
    </button>
  )
}

// ─── 支給内訳パネル ────────────────────────────────────────────────────────

function BreakdownPanel({ lines, total }: { lines: AmountLine[]; total: number }) {
  if (lines.length === 0 && total === 0) return null
  return (
    <div className="rounded-2xl border-2 border-emerald-200 bg-gradient-to-br from-emerald-50 to-teal-50 p-4">
      <p className="mb-2 text-sm font-bold text-emerald-900">💰 この日の支給内訳</p>
      <ul className="space-y-2">
        {lines.map((line, i) => (
          <li key={i} className="flex justify-between rounded-lg bg-white px-3 py-2 text-sm shadow-sm">
            <span className="text-slate-700 pr-2">{line.label}</span>
            <span className="font-bold text-slate-900 shrink-0">¥{line.amount.toLocaleString()}</span>
          </li>
        ))}
      </ul>
      <div className="mt-3 flex items-center justify-between border-t border-emerald-200 pt-3">
        <span className="font-bold text-slate-700">合計</span>
        <span className="text-2xl font-extrabold text-emerald-700">¥{total.toLocaleString()}</span>
      </div>
    </div>
  )
}

// ─── メインコンポーネント ──────────────────────────────────────────────────

export function AllowanceInputForm({ value, onChange, dayType, isLocked, totalAmount, totalDates = 1 }: Props) {
  const isWorkDay = isWorkDayFromDayType(dayType)
  const breakdown = getAmountBreakdown(value, dayType)
  const isMultiDate = totalDates > 1

  const patch = (partial: Partial<AllowanceInputState>) => onChange({ ...value, ...partial })

  const selectBusiness = (id: AllowanceInputState['businessType']) => {
    onChange({
      ...value,
      businessType: id,
      trainingSubType: id === 'TRAINING' ? value.trainingSubType : '',
      subOptionId: '',
      disasterNote: id === 'DISASTER' ? value.disasterNote : '',
    })
  }

  type SubOpt = { id: string; label: string; amount: number; workDayAmount?: number; isDriving: boolean }
  const subOptions: SubOpt[] =
    value.businessType === 'SPORTS'
      ? [...SPORTS_SUB_OPTIONS]
      : value.businessType === 'CLUB'
        ? [...CLUB_SUB_OPTIONS]
        : []

  let stepIndex = 1

  return (
    <div className="flex flex-col gap-4 sm:gap-5">

      {/* ① 行き先（地域） — 郷友寮宿泊業務（宿直）のみの場合は不要 */}
      {!isDormOnlySelection(value) && (
        <Section
          step={stepIndex++}
          title="行き先（地域）"
          hint="必須：走行距離に応じた区分を1つ選んでください。"
          color="blue"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {REGION_OPTIONS.map((r) => {
              const isOverseas = r.id === 'overseas'
              return (
                <button
                  key={r.id}
                  type="button"
                  disabled={isLocked}
                  onClick={() => {
                    patch({ regionId: r.id })
                    if (isOverseas && value.businessType === 'TRAINING' && !value.trainingSubType) {
                      patch({ regionId: r.id, trainingSubType: 'overseas' })
                    }
                  }}
                  className={`rounded-xl px-3 py-3 text-xs sm:text-sm font-bold transition touch-manipulation border-2 text-left ${
                    value.regionId === r.id
                      ? isOverseas
                        ? 'bg-violet-600 text-white border-violet-600 shadow-md'
                        : 'bg-blue-600 text-white border-blue-600 shadow-md'
                      : isOverseas
                        ? 'bg-white border-violet-300 text-violet-700 hover:bg-violet-50'
                        : 'bg-white border-slate-200 text-slate-700 hover:border-blue-300'
                  }`}
                >
                  {isOverseas ? `🌏 ${r.label}` : r.label}
                </button>
              )
            })}
          </div>
          {!value.regionId && isRegionRequired(value) && (
            <p className="mt-2 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-xs font-bold text-red-700">
              ⚠️ 行き先を選んでください（必須）
            </p>
          )}
        </Section>
      )}

      {/* ② 業務の種類 */}
      <Section
        step={stepIndex++}
        title="業務の種類"
        hint="当てはまる業務を1つ選んでください"
        color="purple"
      >
        <div className="flex flex-col gap-2">
          {BUSINESS_TYPES.map((b) => {
            let preview: number | undefined =
              'fixedAmount' in b ? (b as { id: string; fixedAmount: number }).fixedAmount : undefined
            if (b.id === 'TRIP' && isWorkDay) preview = 0
            if (b.id === 'TRAINING') preview = undefined // サブ選択で確定
            return (
              <ChoiceCard
                key={b.id}
                selected={value.businessType === b.id}
                disabled={isLocked}
                onClick={() => selectBusiness(b.id)}
                title={b.label}
                description={b.description}
                amount={preview}
                icon={b.icon}
                accentColor="purple"
              />
            )
          })}
        </div>
        {value.businessType === 'TRIP' && isWorkDay && (
          <p className="mt-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-xs font-bold text-amber-800">
            ⚠️ この日は勤務日のため、出張手当は支給されません。
          </p>
        )}
      </Section>

      {/* ③-A 研修旅行等引率手当：国内 / 海外サブ選択 */}
      {value.businessType === 'TRAINING' && (
        <Section
          step={stepIndex++}
          title="引率区分"
          hint="国内・海外・半日で支給額が異なります。1つ選んでください（必須）"
          color="indigo"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {value.regionId === 'overseas' && value.trainingSubType === 'overseas' && (
              <div className="sm:col-span-2 mb-1 rounded-lg bg-violet-50 border border-violet-200 px-3 py-2 text-xs font-bold text-violet-800">
                🌏 行き先「海外」に合わせて「海外引率」を自動選択しました（変更可能）
              </div>
            )}
            {TRAINING_SUB_OPTIONS.map((opt) => (
              <ChoiceCard
                key={opt.id}
                selected={value.trainingSubType === opt.id}
                disabled={isLocked}
                onClick={() => patch({ trainingSubType: opt.id })}
                title={opt.label}
                description={opt.description}
                amount={opt.amount}
                accentColor="indigo"
              />
            ))}
          </div>
          {!value.trainingSubType && (
            <p className="mt-2 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-xs font-bold text-red-700">
              ⚠️ 国内引率・海外引率・半日のいずれかを選んでください（必須）
            </p>
          )}
        </Section>
      )}

      {/* ③-B 対外運動競技等 / 部活動指導：業務内容詳細 */}
      {(value.businessType === 'SPORTS' || value.businessType === 'CLUB') && (
        <Section
          step={stepIndex++}
          title="業務内容（詳細）"
          hint="1日・半日・運転など、1つ選んでください（必須）"
          color="indigo"
        >
          <div className="flex flex-col gap-2">
            {subOptions.map((opt) => {
              const amt =
                value.businessType === 'CLUB' && isWorkDay && opt.workDayAmount != null
                  ? opt.workDayAmount
                  : opt.amount
              return (
                <ChoiceCard
                  key={opt.id}
                  selected={value.subOptionId === opt.id}
                  disabled={isLocked}
                  onClick={() => patch({ subOptionId: opt.id })}
                  title={opt.label}
                  amount={amt}
                  accentColor="indigo"
                />
              )
            })}
          </div>
          {value.businessType === 'CLUB' && isWorkDay && (
            <p className="mt-2 text-xs text-slate-500">
              ※ 勤務日の場合、運転手当は勤務日額（¥5,100 / ¥7,600）が適用されます。
            </p>
          )}
        </Section>
      )}

      {/* ③-C 災害時等：内容記入 */}
      {value.businessType === 'DISASTER' && (
        <Section
          step={stepIndex++}
          title="災害時等の内容"
          hint="500文字以内で具体的に記入してください（必須）"
          color="indigo"
        >
          <textarea
            disabled={isLocked}
            value={value.disasterNote}
            onChange={(e) => patch({ disasterNote: e.target.value })}
            maxLength={500}
            rows={4}
            placeholder="例: 研修旅行中にトラブルがあり、深夜0:15～8:15まで対応した"
            className="w-full rounded-xl border-2 border-indigo-200 bg-white p-3 text-sm text-slate-900 focus:border-indigo-400 focus:outline-none"
          />
          <p className="mt-1 text-right text-xs text-slate-500">{value.disasterNote.length}/500文字</p>
        </Section>
      )}

      {/* ④ 宿泊業務手当（追加） */}
      <Section
        step={stepIndex++}
        title="宿泊業務手当（追加・任意）"
        hint="日当とは別に支給されます。業務の種類がなくても宿泊業務手当だけ登録できます"
        color="amber"
      >
        <label className="mb-3 flex cursor-pointer items-center gap-3 rounded-xl border-2 border-amber-200 bg-white p-4 hover:bg-amber-50">
          <input
            type="checkbox"
            disabled={isLocked}
            checked={value.accommodationEnabled}
            onChange={(e) =>
              patch({
                accommodationEnabled: e.target.checked,
                accommodationType: e.target.checked ? value.accommodationType : '',
                accommodationNights: e.target.checked ? value.accommodationNights : 0,
              })
            }
            className="h-5 w-5 rounded border-slate-300 text-amber-600 accent-amber-600"
          />
          <span className="font-bold text-slate-800">宿泊業務手当を追加する</span>
        </label>

        {value.accommodationEnabled && (
          <>
            <div className="flex flex-col gap-2 mb-4">
              {ACCOMMODATION_TYPES.map((acc) => (
                <ChoiceCard
                  key={acc.id}
                  selected={value.accommodationType === acc.id}
                  disabled={isLocked}
                  onClick={() => patch({ accommodationType: acc.id })}
                  title={acc.label}
                  description={acc.description}
                  amount={acc.amount}
                  icon="🏨"
                  accentColor="amber"
                />
              ))}
            </div>

            {/* 複数日の場合：泊数入力 */}
            {isMultiDate && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                <p className="text-sm font-bold text-amber-900 mb-2">
                  🌙 宿泊泊数を指定する（複数日入力）
                </p>
                <p className="text-xs text-amber-700 mb-3 leading-relaxed">
                  選択した {totalDates} 日のうち、最初の何日に宿泊手当を付けるか指定します。<br />
                  例: 2泊3日なら「2」→ 先頭2日に宿泊手当、最終日は除外されます。<br />
                  0のままにすると全日付に宿泊手当が付きます。
                </p>
                <div className="flex items-center gap-3">
                  <label className="text-sm font-bold text-amber-900 shrink-0">宿泊泊数:</label>
                  <input
                    type="number"
                    min={0}
                    max={totalDates - 1}
                    disabled={isLocked}
                    value={value.accommodationNights || ''}
                    onChange={(e) => {
                      const v = parseInt(e.target.value, 10)
                      patch({ accommodationNights: isNaN(v) ? 0 : Math.min(v, totalDates - 1) })
                    }}
                    placeholder="例: 2"
                    className="w-24 rounded-lg border-2 border-amber-200 bg-white px-3 py-2 text-sm font-bold text-slate-900 focus:border-amber-400 focus:outline-none"
                  />
                  <span className="text-sm text-amber-800 font-bold">泊</span>
                </div>
                {value.accommodationNights > 0 && (
                  <p className="mt-2 text-xs text-amber-700 font-bold">
                    ✅ 先頭 {value.accommodationNights} 日に宿泊手当を付けます（最後の {totalDates - value.accommodationNights} 日は除外）
                  </p>
                )}
              </div>
            )}
          </>
        )}
      </Section>

      {/* 支給内訳 */}
      <BreakdownPanel lines={breakdown} total={totalAmount} />

      {isMultiDate && value.businessType && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-3 text-xs text-blue-800 leading-relaxed">
          <span className="font-bold">📅 複数日モード:</span>{' '}
          勤務日・休日が混在する場合、それぞれの日付の勤務区分に応じた金額が個別に計算されます。
          {value.businessType === 'CLUB' && ' 部活動指導手当の運転区分は勤務日のみ割引が適用されます。'}
        </div>
      )}
    </div>
  )
}
