import type { AdminAllowanceView } from '@/utils/adminAllowanceDisplay'

export function AllowanceActivityCell({ view }: { view: AdminAllowanceView }) {
  return (
    <div className="space-y-1 min-w-[10rem]">
      <p className="font-semibold text-gray-900 text-sm leading-snug">{view.activityLabel}</p>
      {view.supplement && (
        <p className="text-xs text-slate-500 leading-snug whitespace-pre-wrap">{view.supplement}</p>
      )}
    </div>
  )
}

export function AllowanceRegionCell({ label }: { label: string }) {
  if (label === '-') {
    return <span className="text-gray-400">-</span>
  }
  return (
    <span className="inline-flex items-center rounded-lg bg-blue-50 px-2 py-1 text-xs font-medium text-blue-900 border border-blue-100">
      {label}
    </span>
  )
}

export function AllowanceAccommodationCell({ label }: { label: string | null }) {
  if (!label) {
    return <span className="text-gray-400">-</span>
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-lg bg-amber-50 px-2 py-1 text-xs font-medium text-amber-900 border border-amber-200 max-w-[14rem] text-left leading-snug">
      <span aria-hidden>🏨</span>
      <span>{label}</span>
    </span>
  )
}

export function AllowanceDrivingCell({ hasDriving }: { hasDriving: boolean }) {
  if (!hasDriving) {
    return <span className="text-gray-400">-</span>
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-lg bg-green-50 px-2 py-1 text-xs font-bold text-green-800 border border-green-200">
      <span aria-hidden>🚗</span>
      あり
    </span>
  )
}
