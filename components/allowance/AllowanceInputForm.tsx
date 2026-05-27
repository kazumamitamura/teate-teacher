'use client'

import {
  ACCOMMODATION_TYPES,
  BUSINESS_TYPES,
  CLUB_SUB_OPTIONS,
  REGION_OPTIONS,
  SPORTS_SUB_OPTIONS,
  type AllowanceInputState,
  type AmountLine,
  getAmountBreakdown,
  isWorkDayFromDayType,
} from '@/utils/allowanceSpecR8'

type Props = {
  value: AllowanceInputState
  onChange: (next: AllowanceInputState) => void
  dayType: string
  isLocked: boolean
  totalAmount: number
}

function Section({
  step,
  title,
  hint,
  children,
}: {
  step: number
  title: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4 sm:p-5">
      <div className="mb-3 flex items-start gap-3">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-600 text-sm font-bold text-white">
          {step}
        </span>
        <div>
          <h3 className="text-base font-bold text-slate-900">{title}</h3>
          {hint && <p className="mt-0.5 text-xs leading-relaxed text-slate-600">{hint}</p>}
        </div>
      </div>
      {children}
    </section>
  )
}

function ChoiceCard({
  selected,
  disabled,
  onClick,
  title,
  description,
  amount,
  icon,
}: {
  selected: boolean
  disabled?: boolean
  onClick: () => void
  title: string
  description?: string
  amount?: number
  icon?: string
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`w-full rounded-xl border-2 p-4 text-left transition touch-manipulation ${
        selected
          ? 'border-blue-600 bg-blue-50 shadow-md ring-2 ring-blue-200'
          : 'border-slate-200 bg-white hover:border-blue-300 hover:bg-blue-50/50'
      } ${disabled ? 'cursor-not-allowed opacity-50' : ''}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex gap-3">
          {icon && <span className="text-2xl">{icon}</span>}
          <div>
            <p className="font-bold text-slate-900 text-sm sm:text-base">{title}</p>
            {description && <p className="mt-1 text-xs text-slate-600 leading-snug">{description}</p>}
          </div>
        </div>
        {amount != null && (
          <span className="shrink-0 rounded-lg bg-emerald-100 px-2 py-1 text-sm font-bold text-emerald-800">
            ¥{amount.toLocaleString()}
          </span>
        )}
      </div>
    </button>
  )
}

function BreakdownPanel({ lines, total }: { lines: AmountLine[]; total: number }) {
  if (lines.length === 0 && total === 0) return null
  return (
    <div className="rounded-2xl border-2 border-blue-200 bg-gradient-to-br from-blue-50 to-indigo-50 p-4">
      <p className="mb-2 text-sm font-bold text-blue-900">💰 この日の支給内訳</p>
      <ul className="space-y-2">
        {lines.map((line, i) => (
          <li key={i} className="flex justify-between rounded-lg bg-white px-3 py-2 text-sm">
            <span className="text-slate-700 pr-2">{line.label}</span>
            <span className="font-bold text-slate-900 shrink-0">¥{line.amount.toLocaleString()}</span>
          </li>
        ))}
      </ul>
      <div className="mt-3 flex items-center justify-between border-t border-blue-200 pt-3">
        <span className="font-bold text-slate-800">合計</span>
        <span className="text-2xl font-extrabold text-blue-700">¥{total.toLocaleString()}</span>
      </div>
    </div>
  )
}

export function AllowanceInputForm({ value, onChange, dayType, isLocked, totalAmount }: Props) {
  const isWorkDay = isWorkDayFromDayType(dayType)
  const breakdown = getAmountBreakdown(value, dayType)

  const patch = (partial: Partial<AllowanceInputState>) => onChange({ ...value, ...partial })

  const selectBusiness = (id: AllowanceInputState['businessType']) => {
    onChange({
      ...value,
      businessType: id,
      subOptionId: '',
      disasterNote: id === 'DISASTER' ? value.disasterNote : '',
    })
  }

  const subOptions =
    value.businessType === 'SPORTS'
      ? SPORTS_SUB_OPTIONS
      : value.businessType === 'CLUB'
        ? CLUB_SUB_OPTIONS
        : []

  return (
    <div className="flex flex-col gap-4 sm:gap-5">
      {/* なし */}
      <button
        type="button"
        disabled={isLocked}
        onClick={() =>
          onChange({
            regionId: value.regionId,
            businessType: '',
            subOptionId: '',
            disasterNote: '',
            accommodationEnabled: false,
            accommodationType: '',
          })
        }
        className={`rounded-xl border-2 py-3 text-sm font-bold transition ${
          !value.businessType && !value.accommodationEnabled
            ? 'border-slate-600 bg-slate-100 text-slate-800'
            : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50'
        }`}
      >
        この日は手当なし（登録を削除）
      </button>

      <Section step={1} title="行き先（地域）" hint="どれか1つを選んでください">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {REGION_OPTIONS.map((r) => (
            <button
              key={r.id}
              type="button"
              disabled={isLocked}
              onClick={() => patch({ regionId: r.id })}
              className={`rounded-xl px-2 py-3 text-xs sm:text-sm font-bold transition touch-manipulation ${
                value.regionId === r.id
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'bg-white border border-slate-200 text-slate-700 hover:border-blue-400'
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </Section>

      <Section
        step={2}
        title="業務の種類"
        hint="どれか1つを選んでください（宿泊手当はあとで追加できます）"
      >
        <div className="flex flex-col gap-2">
          {BUSINESS_TYPES.map((b) => {
            let preview: number | undefined =
              'fixedAmount' in b ? (b as { fixedAmount: number }).fixedAmount : undefined
            if (b.id === 'TRIP' && isWorkDay) preview = 0
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
              />
            )
          })}
        </div>
        {value.businessType === 'TRIP' && isWorkDay && (
          <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs font-bold text-amber-800">
            ⚠️ この日は勤務日のため、出張手当は支給されません。
          </p>
        )}
      </Section>

      {(value.businessType === 'SPORTS' || value.businessType === 'CLUB') && (
        <Section step={3} title="業務内容（詳細）" hint="どれか1つを選んでください">
          <div className="flex flex-col gap-2">
            {subOptions.map((opt) => {
              const amt =
                value.businessType === 'CLUB' && isWorkDay && 'workDayAmount' in opt
                  ? (opt.workDayAmount ?? opt.amount)
                  : opt.amount
              return (
                <ChoiceCard
                  key={opt.id}
                  selected={value.subOptionId === opt.id}
                  disabled={isLocked}
                  onClick={() => patch({ subOptionId: opt.id })}
                  title={opt.label}
                  amount={amt}
                />
              )
            })}
          </div>
          {value.businessType === 'CLUB' && isWorkDay && (
            <p className="mt-2 text-xs text-slate-600">
              ※ 勤務日の場合、運転手当は表記の勤務日額（例: ¥5,100 / ¥7,600）が適用されます。
            </p>
          )}
        </Section>
      )}

      {value.businessType === 'DISASTER' && (
        <Section step={3} title="災害時等の内容" hint="500文字以内で具体的に記入してください">
          <textarea
            disabled={isLocked}
            value={value.disasterNote}
            onChange={(e) => patch({ disasterNote: e.target.value })}
            maxLength={500}
            rows={4}
            placeholder="例: 研修旅行中にトラブルがあり、深夜0:15～8:15まで対応した"
            className="w-full rounded-xl border-2 border-orange-200 bg-white p-3 text-sm text-slate-900 focus:border-orange-400 focus:outline-none"
          />
          <p className="mt-1 text-right text-xs text-slate-500">{value.disasterNote.length}/500文字</p>
        </Section>
      )}

      <Section
        step={value.businessType === 'DISASTER' || value.businessType === 'SPORTS' || value.businessType === 'CLUB' ? 4 : 3}
        title="宿泊業務手当（追加）"
        hint="日当とは別に支給されます。必要な場合だけオンにしてください"
      >
        <label className="mb-3 flex cursor-pointer items-center gap-3 rounded-xl border-2 border-purple-200 bg-white p-4">
          <input
            type="checkbox"
            disabled={isLocked || !value.businessType}
            checked={value.accommodationEnabled}
            onChange={(e) =>
              patch({
                accommodationEnabled: e.target.checked,
                accommodationType: e.target.checked ? value.accommodationType : '',
              })
            }
            className="h-5 w-5 rounded border-slate-300 text-purple-600"
          />
          <span className="font-bold text-slate-800">宿泊業務手当を追加する</span>
        </label>
        {!value.businessType && (
          <p className="mb-2 text-xs text-slate-500">先に「業務の種類」を選んでから宿泊を追加できます。</p>
        )}
        {value.accommodationEnabled && (
          <div className="flex flex-col gap-2">
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
              />
            ))}
          </div>
        )}
      </Section>

      <BreakdownPanel lines={breakdown} total={totalAmount} />
    </div>
  )
}
