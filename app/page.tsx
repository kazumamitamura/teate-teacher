'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import { handleSupabaseError, logSupabaseError } from '@/utils/supabase/errorHandler'
import { useRouter } from 'next/navigation'
import Calendar from 'react-calendar'
import 'react-calendar/dist/Calendar.css'
import { AllowanceInputForm } from '@/components/allowance/AllowanceInputForm'
import {
  EMPTY_ALLOWANCE_INPUT,
  buildInputForMultiDateSave,
  calculateR8Total,
  parseStoredAllowance,
  serializeForSave,
  validateAllowanceInput,
  type AllowanceInputState,
} from '@/utils/allowanceSpecR8'
import { fetchAllAnnualSchedules, isHolidayWorkType, isWorkDayWorkType } from '@/utils/annualSchedule'
import { fetchCurrentProfile, isAdminRole } from '@/utils/userProfile'
import { logout } from './auth/actions'

type MonthlyStatus = 'DRAFT' | 'SUBMITTED' | 'APPROVED'

type Allowance = { 
  id: number
  user_id: string
  user_email?: string
  date: string
  activity_type: string
  amount: number
  destination_type?: string | null
  destination_detail?: string | null
  is_driving: boolean
  is_accommodation: boolean
  custom_amount?: number | null
  custom_description?: string | null
  created_at?: string
  updated_at?: string
}
type SchoolCalendar = { date: string, day_type: string }
type AnnualSchedule = { date: string, work_type: string, event_name: string }
type AllowanceType = { id: number, code: string, display_name: string, base_amount: number, requires_holiday: boolean }

const formatDate = (date: Date) => {
  const y = date.getFullYear()
  const m = ('00' + (date.getMonth() + 1)).slice(-2)
  const d = ('00' + date.getDate()).slice(-2)
  return `${y}-${m}-${d}`
}

/**
 * 日付から勤務区分文字列を導出するヘルパー。
 * performSave での複数日ループでも同じロジックを使う。
 */
/** 入力画面に勤務区分バッジを表示するか（休日のみ） */
function shouldShowHolidayBadge(dayType: string): boolean {
  return dayType.includes('休日') || dayType.includes('週休')
}

function getDayTypeForDate(
  date: Date,
  annualSchedules: { date: string; work_type: string; event_name: string }[],
  schoolCalendar: { date: string; day_type: string }[],
  getHoliday: (d: Date) => string | null,
): string {
  const dateStr = formatDate(date)
  const annualSchedule = annualSchedules.find((s) => s.date === dateStr)
  const dayOfWeek = date.getDay()
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6
  const holidayName = getHoliday(date)
  const isHoliday = holidayName !== null

  if (annualSchedule) {
    let type: string
    if (isWorkDayWorkType(annualSchedule.work_type)) {
      type = '勤務日'
    } else if (isHolidayWorkType(annualSchedule.work_type)) {
      type = '休日'
    } else {
      type = isHoliday || isWeekend ? '休日' : '勤務日'
    }
    if (annualSchedule.event_name) type += `(${annualSchedule.event_name})`
    return type
  }

  const calData = schoolCalendar.find((c) => c.date === dateStr)
  if (calData) {
    if (isHoliday && !calData.day_type.includes('休日')) return `休日(${holidayName})`
    return calData.day_type
  }

  if (isHoliday) return `休日(${holidayName})`
  return isWeekend ? '休日(仮)' : '勤務日(仮)'
}

/**
 * 日本の祝日を判定する関数
 * @param date 判定する日付
 * @returns 祝日名（祝日でない場合はnull）
 */
const getJapaneseHoliday = (date: Date): string | null => {
  const year = date.getFullYear()
  const month = date.getMonth() + 1
  const day = date.getDate()
  
  // 固定祝日
  if (month === 1 && day === 1) return '元日'
  if (month === 1 && day === 2) return '振替休日' // 元日が日曜の場合
  if (month === 1 && day === 3) return '振替休日' // 元日が土曜の場合
  if (month === 2 && day === 11) return '建国記念の日'
  if (month === 2 && day === 23) return '天皇誕生日'
  if (month === 2 && day === 24) return '振替休日' // 天皇誕生日が日曜の場合
  if (month === 4 && day === 29) return '昭和の日'
  if (month === 5 && day === 3) return '憲法記念日'
  if (month === 5 && day === 4) return 'みどりの日'
  if (month === 5 && day === 5) return 'こどもの日'
  if (month === 8 && day === 11) return '山の日'
  if (month === 8 && day === 12) return '振替休日' // 山の日が日曜の場合
  if (month === 11 && day === 3) return '文化の日'
  if (month === 11 && day === 23) return '勤労感謝の日'
  
  // 変動祝日（春分の日・秋分の日）
  // 春分の日の計算式（2000年〜2099年）
  if (month === 3) {
    const springEquinox = Math.floor(20.8431 + 0.242194 * (year - 1980)) - Math.floor((year - 1980) / 4)
    if (day === springEquinox) return '春分の日'
  }
  
  // 秋分の日の計算式（2000年〜2099年）
  if (month === 9) {
    const autumnEquinox = Math.floor(23.2488 + 0.242194 * (year - 1980)) - Math.floor((year - 1980) / 4)
    if (day === autumnEquinox) return '秋分の日'
  }
  
  // 成人の日（1月の第2月曜日）
  if (month === 1) {
    const firstMonday = (8 - new Date(year, 0, 1).getDay()) % 7 || 7
    const adultDay = firstMonday + 7
    if (day === adultDay) return '成人の日'
  }
  
  // 海の日（7月の第3月曜日、2023年以降は固定7月17日）
  if (month === 7) {
    if (year >= 2023 && day === 17) {
      return '海の日'
    } else if (year < 2023) {
      const firstMonday = (8 - new Date(year, 6, 1).getDay()) % 7 || 7
      const marineDay = firstMonday + 14
      if (day === marineDay) return '海の日'
    }
  }
  
  // 敬老の日（9月の第3月曜日）
  if (month === 9) {
    const firstMonday = (8 - new Date(year, 8, 1).getDay()) % 7 || 7
    const respectDay = firstMonday + 14
    if (day === respectDay) return '敬老の日'
  }
  
  // スポーツの日（10月の第2月曜日、2020年は7月24日、2021年は7月23日）
  if (month === 10) {
    if (year === 2020 && day === 24) return 'スポーツの日'
    if (year === 2021 && day === 23) return 'スポーツの日'
    const firstMonday = (8 - new Date(year, 9, 1).getDay()) % 7 || 7
    const sportsDay = firstMonday + 7
    if (day === sportsDay) return 'スポーツの日'
  }
  
  return null
}

export default function Home() {
  const router = useRouter()
  const supabase = createClient()
  
  const [userEmail, setUserEmail] = useState('')
  const [userId, setUserId] = useState('')
  const [userName, setUserName] = useState('') // 表示名
  const [isAdmin, setIsAdmin] = useState(false)

  const [allowances, setAllowances] = useState<Allowance[]>([])
  const [schoolCalendar, setSchoolCalendar] = useState<SchoolCalendar[]>([])
  const [annualSchedules, setAnnualSchedules] = useState<AnnualSchedule[]>([])
  const [allowanceTypes, setAllowanceTypes] = useState<AllowanceType[]>([])
  
  const [selectedDate, setSelectedDate] = useState<Date>(new Date())
  const [selectedDates, setSelectedDates] = useState<Date[]>([]) // 複数日選択用
  const [isMultiSelectMode, setIsMultiSelectMode] = useState(false) // 複数選択モード
  const [dayType, setDayType] = useState<string>('---')
  
  // 月次集計データ
  const [monthTotal, setMonthTotal] = useState(0)
  const [campDays, setCampDays] = useState(0)
  const [expeditionDays, setExpeditionDays] = useState(0)

  // 氏名登録モーダル用
  const [showProfileModal, setShowProfileModal] = useState(false)
  
  // 入力フォームモーダル用
  const [showInputModal, setShowInputModal] = useState(false)
  const [inputDisplayName, setInputDisplayName] = useState('')

  const [allowanceInput, setAllowanceInput] = useState<AllowanceInputState>(EMPTY_ALLOWANCE_INPUT)
  const [calculatedAmount, setCalculatedAmount] = useState(0)

  /**
   * 複数日入力モーダルでの「日付ごとの個別設定」
   * key: YYYY-MM-DD、value: その日付専用の入力値
   * マップにないdateは共通設定(allowanceInput)を使用する
   */
  const [perDateOverrides, setPerDateOverrides] = useState<Record<string, AllowanceInputState>>({})
  /**
   * 現在編集中の日付（null = 共通設定）
   * 複数日モーダルでのみ使用
   */
  const [activeEditDate, setActiveEditDate] = useState<string | null>(null)

  // 月次申請ステータス
  const [monthlyStatus, setMonthlyStatus] = useState<MonthlyStatus>('DRAFT')
  const [submittingStatus, setSubmittingStatus] = useState(false)

  // 管理者は常に編集可能、一般ユーザーは SUBMITTED/APPROVED 時にロック
  const isAllowLocked = (monthlyStatus === 'SUBMITTED' || monthlyStatus === 'APPROVED') && !isAdmin

  useEffect(() => {
    const init = async () => {
      console.log('=== 初期化開始 ===')
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { 
        console.log('ユーザー未認証、ログイン画面へ')
        router.push('/login')
        return 
      }
      console.log('ユーザー認証成功:', user.email)
      setUserEmail(user.email || '')
      setUserId(user.id)

      const profile = await fetchCurrentProfile(supabase)
      if (profile && isAdminRole(profile.role)) {
        setIsAdmin(true)
      }

      await fetchProfile(user.id)

      // データ取得（並行実行）
      const now = new Date()
      await Promise.all([
        fetchData(user.id),
        fetchSchoolCalendar(),
        fetchAnnualSchedules(),
        fetchAllowanceTypes(),
        fetchMonthlyStatus(user.id, now.getFullYear(), now.getMonth() + 1),
      ])
      
      console.log('=== 初期化完了 ===')
    }
    init()
  }, [])

  // 氏名取得（新規登録で入力済みの場合はそのまま表示。モーダルは自動で開かない）
  const fetchProfile = async (uid: string) => {
      console.log('プロフィール取得開始:', uid)
      
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('user_id', uid)
        .single()
      
      console.log('プロフィール取得結果:', { data, error })
      
      if (error) {
        console.error('プロフィール取得エラー:', error)
        setUserName('')
        return
      }
      
      const name = (data?.display_name || '').trim()
      console.log('取得した氏名:', name || '(未登録)')
      setUserName(name)
      // 氏名が空でもモーダルは自動表示しない。変更・登録は「アカウント」から行う
  }

  // 氏名保存処理
  const handleSaveProfile = async () => {
      const fullName = inputDisplayName.trim()
      if (!fullName) {
          alert('氏名を入力してください')
          return
      }
      if (!userId) {
          alert('ユーザーIDが取得できませんでした。ページをリロードしてください。')
          return
      }
      
      console.log('=== 氏名保存開始 ===')
      console.log('User ID:', userId)
      console.log('Full Name:', fullName)
      console.log('User Email:', userEmail)
      
      // まず、既存のレコードがあるか確認
      const { data: existingProfile, error: checkError } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('user_id', userId)
        .single()
      
      console.log('既存プロフィール確認:', { existingProfile, checkError })
      
      let result
      let error
      
      if (existingProfile) {
          // 既存レコードがある場合は更新
          console.log('既存レコードを更新します')
          result = await supabase
            .from('user_profiles')
            .update({ 
              display_name: fullName,
              email: userEmail || ''
            })
            .eq('user_id', userId)
            .select()
      } else {
          // レコードが存在しない場合は挿入
          console.log('新規レコードを挿入します')
          result = await supabase
            .from('user_profiles')
            .insert({ 
              user_id: userId,
              email: userEmail || '',
              display_name: fullName
            })
            .select()
      }
      
      const { data, error: saveError } = result
      error = saveError

      console.log('氏名保存結果:', { data, error })

      if (error) {
          console.error('氏名登録エラー（詳細）:', {
            message: error.message,
            code: error.code,
            details: error.details,
            hint: error.hint,
            fullError: error
          })
          
          // エラーメッセージを詳細に表示
          let errorMessage = 'エラーが発生しました: ' + error.message
          if (error.code === 'PGRST205' || error.message.includes('schema cache')) {
              errorMessage += '\n\nスキーマキャッシュの問題の可能性があります。\n数秒待ってから再度お試しください。'
          } else if (error.code === '42501' || error.message.includes('permission denied')) {
              errorMessage += '\n\nアクセス権限の問題が発生しています。\n管理者にお問い合わせください。'
          }
          
          alert(errorMessage)
      } else {
          console.log('氏名登録成功:', fullName)
          setUserName(fullName)
          setShowProfileModal(false)
          setInputDisplayName('')
          // プロフィールを再取得して確認
          await fetchProfile(userId)
          alert('氏名を登録しました！')
      }
  }

  // 月次申請ステータス取得
  const fetchMonthlyStatus = async (uid: string, year: number, month: number) => {
    const targetMonth = `${year}-${String(month).padStart(2, '0')}`
    const { data, error } = await supabase
      .from('allowance_monthly_statuses')
      .select('status')
      .eq('user_id', uid)
      .eq('target_month', targetMonth)
      .single()
    if (error || !data) {
      setMonthlyStatus('DRAFT')
    } else {
      setMonthlyStatus((data.status as MonthlyStatus) || 'DRAFT')
    }
  }

  // 月が変わったらステータスを再取得
  useEffect(() => {
    if (!userId) return
    const year = selectedDate.getFullYear()
    const month = selectedDate.getMonth() + 1
    fetchMonthlyStatus(userId, year, month)
  }, [selectedDate.getFullYear(), selectedDate.getMonth(), userId])

  const countAllowancesInMonth = (items: Allowance[], refDate: Date) =>
    items.filter((i) => {
      const d = new Date(i.date)
      return d.getMonth() === refDate.getMonth() && d.getFullYear() === refDate.getFullYear()
    }).length

  // 月次申請（DB更新）
  const submitMonth = async (opts?: { skipConfirm?: boolean; successMessage?: string }) => {
    if (!userId) return false
    if (monthlyStatus !== 'DRAFT') {
      alert('この月はすでに申請済み、または承認済みのため申請できません。')
      return false
    }
    if (!opts?.skipConfirm && !confirm('この月の手当を申請しますか？\n申請後は承認されるか返却されるまで編集できなくなります。')) {
      return false
    }
    setSubmittingStatus(true)
    try {
      const year = selectedDate.getFullYear()
      const month = selectedDate.getMonth() + 1
      const targetMonth = `${year}-${String(month).padStart(2, '0')}`
      const { error } = await supabase.from('allowance_monthly_statuses').upsert(
        { user_id: userId, target_month: targetMonth, status: 'SUBMITTED' },
        { onConflict: 'user_id,target_month' }
      )
      if (error) {
        console.error('申請エラー:', error)
        alert('申請に失敗しました: ' + error.message)
        return false
      }
      setMonthlyStatus('SUBMITTED')
      alert(opts?.successMessage ?? '申請しました。管理者の承認をお待ちください。')
      return true
    } catch (err) {
      console.error(err)
      alert('申請処理中にエラーが発生しました。')
      return false
    } finally {
      setSubmittingStatus(false)
    }
  }

  const handleSubmitMonth = () => submitMonth()

  // 入力画面から：未保存分を保存してから月次申請
  const handleApplyFromInputModal = async () => {
    if (isAllowLocked) {
      alert(monthlyStatus === 'SUBMITTED' ? '申請中のため編集・再申請できません。' : '承認済のため申請できません。')
      return
    }
    if (
      !confirm(
        '入力内容を保存し、この月の手当を申請しますか？\n申請後は承認または返却までは編集できません。'
      )
    ) {
      return
    }
    setSubmittingStatus(true)
    try {
      const hasFormInput =
        allowanceInput.businessType ||
        (allowanceInput.accommodationEnabled && allowanceInput.accommodationType)
      if (hasFormInput) {
        const saved = await performSave({ closeModal: false, silent: true })
        if (!saved) return
      }
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        alert('ユーザー情報が取得できません。再ログインしてください。')
        return
      }
      const refreshed = await fetchData(user.id)
      if (countAllowancesInMonth(refreshed, selectedDate) === 0) {
        alert('申請する手当データがありません。内容を入力してから申請してください。')
        return
      }
      const ok = await submitMonth({
        skipConfirm: true,
        successMessage: hasFormInput
          ? '保存し、申請しました。管理者の承認をお待ちください。'
          : '申請しました。管理者の承認をお待ちください。',
      })
      if (ok) {
        setShowInputModal(false)
        setSelectedDates([])
        setIsMultiSelectMode(false)
      }
    } finally {
      setSubmittingStatus(false)
    }
  }

  // 月次集計の自動計算
  useEffect(() => {
    console.log('=== 月次集計開始 ===')
    console.log('全手当データ件数:', allowances.length)
    console.log('選択月:', selectedDate.getFullYear(), '年', selectedDate.getMonth() + 1, '月')
    
    const monthAllowances = allowances.filter(i => {
      const d = new Date(i.date)
      const match = d.getMonth() === selectedDate.getMonth() && d.getFullYear() === selectedDate.getFullYear()
      console.log('日付:', i.date, '金額:', i.amount, '活動:', i.activity_type, '月一致:', match)
      return match
    })

    console.log('対象月の手当件数:', monthAllowances.length)
    console.log('対象月の手当詳細:', monthAllowances)

    // 合計金額（数値型に変換して計算）
    const total = monthAllowances.reduce((sum, i) => {
      const amount = typeof i.amount === 'string' ? parseInt(i.amount, 10) : (i.amount || 0)
      console.log('加算:', sum, '+', amount, '=', sum + amount)
      return sum + amount
    }, 0)
    console.log('計算された合計金額:', total, '（型:', typeof total, '）')
    setMonthTotal(total)

    // 合宿日数（activity_typeに「合宿」を含む、またはcodeが'F'）
    const camps = monthAllowances.filter(a => 
      a.activity_type?.includes('合宿') || a.activity_type?.includes('Training Camp') || a.activity_type?.includes('F.')
    ).length
    setCampDays(camps)

    // 遠征日数（activity_typeに「遠征」を含む、またはcodeが'E'）
    const expeditions = monthAllowances.filter(a => 
      a.activity_type?.includes('遠征') || a.activity_type?.includes('Expedition') || a.activity_type?.includes('E.')
    ).length
    setExpeditionDays(expeditions)

    console.log('月次集計結果:', {
      year: selectedDate.getFullYear(),
      month: selectedDate.getMonth() + 1,
      total,
      camps,
      expeditions,
      dataCount: monthAllowances.length
    })
    console.log('=== 月次集計終了 ===')
  }, [allowances, selectedDate])

  const fetchData = async (uid: string) => {
    console.log('=== 手当データ取得開始 ===')
    console.log('ユーザーID:', uid)
    console.log('Supabase URL:', process.env.NEXT_PUBLIC_SUPABASE_URL)
    try {
      const { data: allowData, error } = await supabase
        .from('allowances')
      .select('*')
      .eq('user_id', uid)
        .order('date', { ascending: false })
    
      if (error) {
        // エラーの詳細をログに出力
        console.error('[手当データ取得エラー詳細]', {
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint,
          fullError: error
        })
        
        logSupabaseError('手当データ取得', error)
        
        // 404エラーやテーブルが見つからないエラーの場合は警告を表示
        if (error.code === 'PGRST116' || error.message?.includes('404') || error.message?.includes('not found') || error.message?.includes('Could not find')) {
          console.error('⚠️ テーブル "allowances" が見つかりません。Supabaseの設定を確認してください。')
        }
        
        setAllowances([])
        return []
      }

      console.log('手当データ取得成功:', allowData?.length, '件')
      const normalizedData = (allowData ?? []).map((item) => ({
        ...item,
        amount: typeof item.amount === 'string' ? parseInt(item.amount, 10) : item.amount,
      }))
      setAllowances(normalizedData)
      return normalizedData
    } catch (err) {
      console.error('手当データ取得中の予期しないエラー:', err)
      setAllowances([])
      return []
    }
    console.log('=== 手当データ取得終了 ===')
    return []
  }

  const fetchSchoolCalendar = async () => {
    try {
      const { data, error } = await supabase.from('school_calendar').select('*')
      if (error) {
        logSupabaseError('学校カレンダー取得', error)
        setSchoolCalendar([])
      } else {
        setSchoolCalendar(data || [])
  }
    } catch (err) {
      console.error('学校カレンダー取得中の予期しないエラー:', err)
      setSchoolCalendar([])
    }
  }

  const fetchAnnualSchedules = async () => {
    try {
      const { data, error } = await fetchAllAnnualSchedules(supabase)
      if (error) {
        logSupabaseError('年間予定取得', { message: error })
        setAnnualSchedules([])
      } else {
        setAnnualSchedules(data)
      }
    } catch (err) {
      console.error('年間予定取得中の予期しないエラー:', err)
      setAnnualSchedules([])
    }
  }

  const fetchAllowanceTypes = async () => {
    try {
      const { data, error } = await supabase.from('allowance_types').select('*').order('code')
      if (error) {
        logSupabaseError('手当種別取得', error)
        setAllowanceTypes([])
      } else {
        setAllowanceTypes(data || [])
      }
    } catch (err) {
      console.error('手当種別取得中の予期しないエラー:', err)
      setAllowanceTypes([])
    }
  }

  useEffect(() => {
    const updateDayInfo = async () => {
      const dateStr = formatDate(selectedDate)
      
      // annual_schedulesを優先的に使用（CSVアップロードされたデータ）
      const annualSchedule = annualSchedules.find(s => s.date === dateStr)
      let type = ''
      
      // 土曜日（6）と日曜日（0）を休日として判定
      const dayOfWeek = selectedDate.getDay()
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6
      
      // 日本の祝日を判定
      const holidayName = getJapaneseHoliday(selectedDate)
      const isHoliday = holidayName !== null
      
      if (annualSchedule) {
        if (isWorkDayWorkType(annualSchedule.work_type)) {
          type = '勤務日'
        } else if (isHolidayWorkType(annualSchedule.work_type)) {
          type = '休日'
        } else {
          type = isHoliday || isWeekend ? '休日' : '勤務日'
        }
        
        // 行事名がある場合は追加
        if (annualSchedule.event_name) {
          type += `(${annualSchedule.event_name})`
        }
      } else {
        // annual_schedulesがない場合はschoolCalendarを使用
        const calData = schoolCalendar.find(c => c.date === dateStr)
        if (calData) {
          type = calData.day_type
          // schoolCalendarにデータがあっても、祝日判定を優先
          if (isHoliday && !calData.day_type.includes('休日')) {
            type = `休日(${holidayName})`
          }
        } else {
          // どちらもない場合、祝日または週末は休日、平日は勤務日
          if (isHoliday) {
            type = `休日(${holidayName})`
          } else {
            type = isWeekend ? '休日(仮)' : '勤務日(仮)'
          }
        }
      }
      
      setDayType(type)

      const allowance = allowances.find(a => a.date === dateStr)
      if (allowance) {
        setAllowanceInput(parseStoredAllowance(allowance))
      } else {
        setAllowanceInput(EMPTY_ALLOWANCE_INPUT)
      }
    }
    updateDayInfo()
  }, [selectedDate, allowances, schoolCalendar, annualSchedules])

  useEffect(() => {
    setCalculatedAmount(calculateR8Total(allowanceInput, dayType))
  }, [allowanceInput, dayType])

  const performSave = async (opts?: { closeModal?: boolean; silent?: boolean }): Promise<boolean> => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      console.error('ユーザー情報が取得できません')
      alert('ユーザー情報が取得できません。再ログインしてください。')
      return false
    }
      
    // 保存対象の日付リスト（複数選択されている場合は全日付、そうでなければ単一日付）
    // 宿泊泊数の分散のため昇順ソート
    const rawTargetDates = selectedDates.length > 0 ? selectedDates : [selectedDate]
    const targetDates = [...rawTargetDates].sort((a, b) => a.getTime() - b.getTime())
    const totalDates = targetDates.length
    
    console.log('保存するユーザー:', {
      user_id: user.id,
      email: user.email,
      dates: targetDates.map(d => formatDate(d))
    })

    // 共通設定またはいずれかの個別設定に入力があるか判定
    const hasEntry =
      allowanceInput.businessType ||
      (allowanceInput.accommodationEnabled && allowanceInput.accommodationType) ||
      Object.values(perDateOverrides).some(o => o.businessType || (o.accommodationEnabled && o.accommodationType))

    if (hasEntry) {
      // 個別設定がある場合は日付ごとにバリデーション
      for (let dateIdx = 0; dateIdx < targetDates.length; dateIdx++) {
        const date = targetDates[dateIdx]
        const dateStr = formatDate(date)
        const isOverride = !!perDateOverrides[dateStr]
        const dateInput = perDateOverrides[dateStr] ?? allowanceInput
        const dateDayType = getDayTypeForDate(date, annualSchedules, schoolCalendar, getJapaneseHoliday)
        // 宿泊泊数は選択日数全体で検証（中間日の個別設定でも連泊として扱う）
        const inputForValidation = isOverride
          ? { ...dateInput, accommodationNights: 0 }
          : allowanceInput
        const datesForValidation = isOverride ? 1 : totalDates
        const validation = validateAllowanceInput(inputForValidation, dateDayType, datesForValidation)
        if (!validation.ok) {
          const label = perDateOverrides[dateStr]
            ? `${date.getMonth() + 1}/${date.getDate()}（個別設定）`
            : '共通設定'
          alert(`${label}:\n${validation.message}`)
          return false
        }
      }

      for (let dateIdx = 0; dateIdx < targetDates.length; dateIdx++) {
        const date = targetDates[dateIdx]
        const dateStr = formatDate(date)

        // 日付ごとに勤務区分を再計算（勤務日・休日混在対応）
        const dateDayType = getDayTypeForDate(date, annualSchedules, schoolCalendar, getJapaneseHoliday)
        // 個別設定があればそちら、なければ共通設定を使用
        const isOverride = !!perDateOverrides[dateStr]
        const dateInput = perDateOverrides[dateStr] ?? allowanceInput
        const inputForSave =
          totalDates > 1
            ? buildInputForMultiDateSave(allowanceInput, dateInput, isOverride)
            : dateInput
        const payload = serializeForSave(inputForSave, dateDayType, dateIdx)

        const insertData: Record<string, unknown> = {
          user_id: user.id,
          user_email: user.email,
          date: dateStr,
          activity_type: payload.activity_type,
          destination_type: payload.destination_type,
          destination_detail: payload.destination_detail,
          is_driving: payload.is_driving,
          is_accommodation: payload.is_accommodation,
          amount: payload.amount,
        }
        
        console.log('挿入データ:', dateStr, insertData)
        console.log('Supabase URL:', process.env.NEXT_PUBLIC_SUPABASE_URL)
        console.log('ユーザーID:', user.id)
        
        // リトライロジック（スキーマキャッシュエラー対策）
        let insertError = null
        let insertedData = null
        const maxRetries = 3
        const retryDelay = 2000 // 2秒
        
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
          console.log(`[保存試行 ${attempt}/${maxRetries}] ${dateStr}`)
          
          // 既存データを削除
          const deleteResult = await supabase.from('allowances').delete().eq('user_id', user.id).eq('date', dateStr)
          if (deleteResult.error && deleteResult.error.code !== 'PGRST205') {
            console.error('削除エラー:', dateStr, deleteResult.error)
            // 404エラーの場合はテーブルが存在しない可能性があるが、続行
            if (deleteResult.error.code === 'PGRST116' || deleteResult.error.message?.includes('404')) {
              console.warn('⚠️ テーブルが見つかりませんが、続行します...')
            }
          } else if (!deleteResult.error) {
            console.log('既存データ削除成功:', dateStr)
          }
          
          // データを挿入
          const result = await supabase.from('allowances').insert(insertData).select()
          insertError = result.error
          insertedData = result.data
          
          console.log(`[挿入結果 ${attempt}/${maxRetries}]`, {
            success: !insertError,
            error: insertError ? {
              code: insertError.code,
              message: insertError.message
            } : null
          })
          
          // 成功した場合はループを抜ける
          if (!insertError) {
            break
          }
          
          // 404エラーやテーブルが見つからないエラー（PGRST116、またはPGRST205で「Could not find the table」が含まれる場合）の場合はリトライしない
          const isTableNotFound = insertError.code === 'PGRST116' || 
              insertError.message?.includes('404') || 
              insertError.message?.includes('not found') ||
              insertError.message?.includes('Could not find the table')
          
          if (isTableNotFound) {
            console.error('⚠️ テーブルが見つかりません。リトライをスキップします。')
            break
          }
          
          // スキーマキャッシュエラー（PGRST205）の場合はリトライ
          // ただし、「Could not find the table」が含まれている場合はテーブルが存在しない可能性が高いのでスキップ
          if ((insertError.code === 'PGRST205' || insertError.message?.includes('schema cache')) && 
              !insertError.message?.includes('Could not find the table')) {
            if (attempt < maxRetries) {
              console.warn(`スキーマキャッシュエラー検出 (試行 ${attempt}/${maxRetries})。${retryDelay}ms待機して再試行します...`)
              await new Promise(resolve => setTimeout(resolve, retryDelay))
              continue
            } else {
              // 3回リトライしても解決しない場合は、テーブルが存在しない可能性が高い
              console.error('⚠️ スキーマキャッシュエラーが3回続けて発生しました。テーブルが存在しない可能性があります。')
            }
          } else {
            // その他のエラーの場合はループを抜ける
            break
          }
        }
        
        if (insertError) {
          // エラーの詳細をログに出力
          console.error(`[手当データ保存エラー詳細 (${dateStr})]`, {
            code: insertError.code,
            message: insertError.message,
            details: insertError.details,
            hint: insertError.hint,
            fullError: insertError
          })
          
          logSupabaseError(`手当データ保存 (${dateStr})`, insertError)
          const errorMessage = handleSupabaseError(insertError)
          
          // テーブルが見つからないエラーの場合は追加情報を表示
          if (insertError.code === 'PGRST116' || 
              insertError.code === 'PGRST205' ||
              insertError.message?.includes('404') || 
              insertError.message?.includes('not found') ||
              insertError.message?.includes('Could not find the table')) {
            alert(`${dateStr} の保存に失敗しました:\n\n${errorMessage}\n\n【重要】\nテーブル 'allowances' がSupabaseに存在しない可能性があります。\n\n【解決方法】\n1. Supabaseダッシュボード → SQL Editor を開く\n2. CREATE_ALL_TABLES.sql の内容を実行してテーブルを作成\n3. 数秒待ってからページをリロード\n4. それでも解決しない場合は、管理者にお問い合わせください\n\n※テーブル作成SQLファイルはプロジェクトのルートディレクトリにあります`)
          } else {
            alert(`${dateStr} の保存に失敗しました:\n\n${errorMessage}`)
          }
          return false
        }
        
        console.log('挿入成功:', dateStr, insertedData)
      }
        } else {
      // 手当なしの場合は削除のみ
      for (const date of targetDates) {
        const dateStr = formatDate(date)
        
        // リトライロジック（スキーマキャッシュエラー対策）
        const maxRetries = 3
        const retryDelay = 2000 // 2秒
        let deleteError = null
        
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
          const result = await supabase.from('allowances').delete().eq('user_id', user.id).eq('date', dateStr)
          deleteError = result.error
          
          // 成功した場合はループを抜ける
          if (!deleteError) {
            break
          }
          
          // 404エラーやテーブルが見つからないエラー（PGRST116、またはPGRST205で「Could not find the table」が含まれる場合）の場合はリトライしない
          const isTableNotFound = deleteError.code === 'PGRST116' || 
              deleteError.message?.includes('404') || 
              deleteError.message?.includes('not found') ||
              deleteError.message?.includes('Could not find the table')
          
          if (isTableNotFound) {
            console.warn('⚠️ テーブルが見つかりません。削除処理をスキップします。')
            break
          }
          
          // スキーマキャッシュエラー（PGRST205）の場合はリトライ
          // ただし、「Could not find the table」が含まれている場合はテーブルが存在しない可能性が高いのでスキップ
          if ((deleteError.code === 'PGRST205' || deleteError.message?.includes('schema cache')) && 
              !deleteError.message?.includes('Could not find the table')) {
            if (attempt < maxRetries) {
              console.warn(`スキーマキャッシュエラー検出 (試行 ${attempt}/${maxRetries})。${retryDelay}ms待機して再試行します...`)
              await new Promise(resolve => setTimeout(resolve, retryDelay))
              continue
            }
          } else {
            // その他のエラーの場合はループを抜ける
            break
          }
        }
        
        // 404エラーやテーブルが見つからないエラー以外のエラーのみログに出力
        if (deleteError && 
            deleteError.code !== 'PGRST205' && 
            deleteError.code !== 'PGRST116' &&
            !deleteError.message?.includes('404') &&
            !deleteError.message?.includes('not found')) {
          console.error('削除エラー:', dateStr, deleteError)
        }
      }
    }
    
    await fetchData(user.id)

    if (opts?.closeModal !== false) {
      setShowInputModal(false)
      setSelectedDates([])
      if (targetDates.length > 0) {
        setSelectedDate(targetDates[0])
      }
    }

    if (!opts?.silent) {
      const message =
        targetDates.length > 1 ? `${targetDates.length}日分のデータを保存しました` : '保存しました'
      alert(message)
    }
    return true
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    await performSave()
  }

  const handleDelete = async (id: number, dateStr: string) => { 
    if (isAllowLocked) {
      alert('現在この月は編集できません。')
      return
    }
    if (!window.confirm('削除しますか？')) return
    const { error } = await supabase.from('allowances').delete().eq('id', id)
    if (!error) fetchData(userId)
  }

  /** 履歴行の「修正」ボタン: 該当日付をセットしてモーダルを開く */
  const handleEditAllowance = (dateStr: string) => {
    if (isAllowLocked) {
      alert(monthlyStatus === 'SUBMITTED' ? '申請中のため編集できません。返却後に編集してください。' : '承認済のため編集できません。')
      return
    }
    const [y, m, d] = dateStr.split('-').map(Number)
    const date = new Date(y, m - 1, d)
    setSelectedDate(date)
    setSelectedDates([])
    setIsMultiSelectMode(false)
    setPerDateOverrides({})
    setActiveEditDate(null)
    setShowInputModal(true)
  }

  const handleLogout = async () => { 
    await logout()
  }
  const handlePrevMonth = () => { 
    const d = new Date(selectedDate)
    const currentDay = d.getDate()
    d.setMonth(d.getMonth() - 1)
    // 新しい月に同じ日付が存在する場合は保持、存在しない場合は1日に設定
    const maxDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()
    d.setDate(Math.min(currentDay, maxDay))
    setSelectedDate(d)
  }
  const handleNextMonth = () => { 
    const d = new Date(selectedDate)
    const currentDay = d.getDate()
    d.setMonth(d.getMonth() + 1)
    // 新しい月に同じ日付が存在する場合は保持、存在しない場合は1日に設定
    const maxDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()
    d.setDate(Math.min(currentDay, maxDay))
    setSelectedDate(d)
  }
  
  // カレンダー日付クリック時の処理
  const handleDateClick = (date: Date, event?: React.MouseEvent) => {
    if (isAllowLocked) {
      alert(monthlyStatus === 'SUBMITTED' ? '申請中のため編集できません。返却後に編集してください。' : '承認済のため編集できません。')
      return
    }
    // 複数選択モード（PC: Ctrl/Cmd押下、スマホ: 複数選択モード有効）
    const isMultiSelect = isMultiSelectMode || event?.ctrlKey || event?.metaKey
    
    // まず確実にselectedDateを更新
    setSelectedDate(date)
    
    if (isMultiSelect) {
      // 複数選択モード: 日付を配列に追加/削除（トグル）
      const dateStr = formatDate(date)
      const isAlreadySelected = selectedDates.some(d => formatDate(d) === dateStr)
      
      if (isAlreadySelected) {
        // 既に選択されている場合は削除
        setSelectedDates(selectedDates.filter(d => formatDate(d) !== dateStr))
      } else {
        // 未選択の場合は追加
        setSelectedDates([...selectedDates, date])
      }
    } else {
      // 単一選択モード
      setSelectedDates([]) // 複数選択をクリア
      
      setShowInputModal(true)
    }
  }
  
  // 複数選択モードの完了
  const handleMultiSelectComplete = () => {
    if (selectedDates.length === 0) {
      alert('日付を選択してください')
      return
    }
    setIsMultiSelectMode(false)
    // 個別設定をリセットして新規モーダルを開く
    setPerDateOverrides({})
    setActiveEditDate(null)
    setShowInputModal(true)
  }
  
  // 複数選択モードのキャンセル
  const handleMultiSelectCancel = () => {
    setIsMultiSelectMode(false)
    setSelectedDates([])
  }

  const getTileContent = ({ date, view }: { date: Date; view: string }) => {
    if (view !== 'month') return null
    const dateStr = formatDate(date)
    const allowance = allowances.find(i => i.date === dateStr)
    const schedule = annualSchedules.find(s => s.date === dateStr)
    
    // 今日かどうか判定
    const today = new Date()
    const isToday = date.getDate() === today.getDate() && 
                    date.getMonth() === today.getMonth() && 
                    date.getFullYear() === today.getFullYear()
    
    // 複数選択されているかどうか判定
    const isSelected = selectedDates.some(d => formatDate(d) === dateStr)

    // 背景色とボーダーの設定
    let bgClass = 'bg-gray-50' // 未入力の日（薄いグレー）
    let borderClass = 'border border-gray-200'
    
    if (allowance) {
      bgClass = 'bg-white' // 入力済みの日（白背景）
      borderClass = 'border-2 border-gray-300'
    } 
    
    if (isToday) {
      borderClass = 'border-2 border-blue-500' // 今日（青い枠線）
    }
    
    if (isSelected) {
      bgClass = 'bg-blue-100' // 選択中の日（青い背景）
      borderClass = 'border-3 border-blue-600' // 選択中（太い青い枠線）
    }

    return ( 
        <div 
            className={`flex flex-col items-start justify-start w-full h-full p-2 rounded-lg ${bgClass} ${borderClass} min-h-[60px] relative cursor-pointer hover:opacity-80 transition`}
            onClick={(e) => handleDateClick(date, e)}
        >
            {/* 選択中のチェックマーク */}
            {isSelected && (
                <div className="absolute top-1 left-1 bg-blue-600 text-white rounded-full w-5 h-5 flex items-center justify-center">
                    ✓
                </div>
            )}
            
            {/* 勤務区分（右上に小さく表示） */}
            {schedule && schedule.work_type && (
                <div className="absolute top-1 right-1 px-1.5 py-0.5 bg-purple-100 border border-purple-300 rounded text-xs font-bold text-purple-700">
                    {schedule.work_type}
                </div>
            )}
            
            {/* 日付番号（今日は青い丸で強調） */}
            <div className={`text-xs font-bold mb-1 ${isToday ? 'bg-blue-500 text-white rounded-full w-6 h-6 flex items-center justify-center' : 'text-gray-900'}`}>
                {date.getDate()}
            </div>
            
            {/* 手当金額（入力済みの場合のみ表示） */}
            {allowance && (
                <div className="w-full">
                    <div className="px-2 py-1 bg-blue-50 rounded-md border border-blue-200">
                        <span className="text-xs font-bold text-gray-900">¥{allowance.amount.toLocaleString()}</span>
                    </div>
                    <div className="text-xs text-gray-600 mt-1 truncate">{allowance.activity_type}</div>
                </div>
            )}
        </div> 
    )
  }
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
       {isAdmin && <div className="bg-slate-800 text-white text-center py-3 text-sm font-bold shadow-md"><a href="/admin" className="underline hover:text-blue-300 transition">事務担当者ページへ</a></div>}

      {/* 氏名は新規登録時のみ入力。修正・変更は「👤 アカウント」から */}

      {/* ヘッダー */}
      <div className="bg-white shadow-sm border-b border-slate-200 sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-3 sm:py-4">
          {/* スマホ: 縦並び、PC: 横並び */}
          <div className="flex flex-col lg:flex-row lg:justify-between lg:items-center gap-3 lg:gap-0">
            {/* 左側: 月選択と支給予定額 */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-6">
              {/* 月選択 */}
              <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto">
                <button onClick={handlePrevMonth} className="text-slate-400 hover:text-slate-600 p-2 sm:p-2 text-xl sm:text-2xl font-bold transition touch-manipulation">‹</button>
                <h2 className="text-lg sm:text-xl font-bold text-gray-900 whitespace-nowrap">{selectedDate.getFullYear()}年 {selectedDate.getMonth() + 1}月</h2>
                <button onClick={handleNextMonth} className="text-slate-400 hover:text-slate-600 p-2 sm:p-2 text-xl sm:text-2xl font-bold transition touch-manipulation">›</button>
              </div>
              
              {/* 支給予定額 + 申請ステータス */}
              <div className="flex flex-col items-start w-full sm:w-auto">
                <div className="flex items-center gap-2">
                  <div className="text-xs sm:text-sm text-gray-600 font-medium">支給予定額</div>
                  {monthlyStatus === 'DRAFT' && (
                    <span className="text-xs px-2 py-0.5 rounded-full font-bold bg-gray-100 text-gray-600 border border-gray-300">未申請</span>
                  )}
                  {monthlyStatus === 'SUBMITTED' && (
                    <span className="text-xs px-2 py-0.5 rounded-full font-bold bg-yellow-100 text-yellow-700 border border-yellow-300">申請中</span>
                  )}
                  {monthlyStatus === 'APPROVED' && (
                    <span className="text-xs px-2 py-0.5 rounded-full font-bold bg-green-100 text-green-700 border border-green-300">承認済</span>
                  )}
                </div>
                <div className="text-2xl sm:text-3xl font-extrabold text-blue-600">¥{monthTotal.toLocaleString()}</div>
                <div className="flex gap-2 sm:gap-3 mt-1 text-xs text-gray-600">
                  <span>🏕️ 合宿: {campDays}日</span>
                  <span>🚌 遠征: {expeditionDays}日</span>
                </div>
                {monthlyStatus === 'DRAFT' && monthTotal > 0 && (
                  <button
                    onClick={handleSubmitMonth}
                    disabled={submittingStatus}
                    className="mt-2 text-xs font-bold px-4 py-1.5 rounded-lg bg-gradient-to-r from-emerald-500 to-emerald-600 text-white hover:from-emerald-600 hover:to-emerald-700 active:from-emerald-700 active:to-emerald-800 transition-all shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {submittingStatus ? '申請中...' : '💰 この月の手当を申請する'}
                  </button>
                )}
                {isAllowLocked && (
                  <div className="mt-1 text-xs text-orange-600 font-bold">🔒 {monthlyStatus === 'SUBMITTED' ? '申請中のため編集できません' : '承認済のため編集できません'}</div>
                )}
              </div>
            </div>
            
            {/* 右側: ボタン類 */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3 w-full lg:w-auto">
              {/* アカウント（氏名の変更・登録）・複数選択・ログアウト */}
              <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                <div className="flex gap-2">
                  <button 
                      onClick={() => {
                          setInputDisplayName(userName || '')
                          setShowProfileModal(true)
                      }} 
                      className="text-xs sm:text-sm font-bold text-slate-600 bg-slate-100 px-3 sm:px-4 py-2 rounded-full border border-slate-200 hover:bg-slate-200 active:bg-slate-300 transition touch-manipulation flex-1 sm:flex-none whitespace-nowrap"
                  >
                      {userName ? `👤 ${userName.length > 8 ? userName.substring(0, 8) + '…' : userName}` : '👤 アカウント'}
                  </button>
                  
                  <button onClick={handleLogout} className="text-xs sm:text-sm font-bold text-slate-600 bg-slate-100 px-3 sm:px-4 py-2 rounded-full border border-slate-200 hover:bg-slate-200 active:bg-slate-300 transition touch-manipulation">ログアウト</button>
                </div>
                
                {/* 複数選択モードボタン（通常サイズ） */}
                <button
                  onClick={() => setIsMultiSelectMode(!isMultiSelectMode)}
                  className={`text-sm font-bold px-4 py-2 rounded-full border-2 transition touch-manipulation shadow-md whitespace-nowrap ${
                    isMultiSelectMode 
                      ? 'bg-blue-600 text-white border-blue-600 hover:bg-blue-700 shadow-blue-300' 
                      : 'bg-gradient-to-r from-blue-50 to-blue-100 text-blue-700 border-blue-300 hover:from-blue-100 hover:to-blue-200'
                  }`}
                >
                  {isMultiSelectMode ? '✅ 選択モード中' : '📅 複数日まとめて入力'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 複数選択モード中の案内バー（カレンダー直上・コンパクト表示） */}
      {(isMultiSelectMode || selectedDates.length > 0) && (
        <div className="max-w-7xl mx-auto px-2 sm:px-4 lg:px-8 pt-2 sm:pt-3">
          <div className="bg-gradient-to-r from-blue-50 to-blue-100 border border-blue-300 rounded-lg px-3 py-2 sm:px-4 sm:py-2.5 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 sm:gap-3 flex-wrap min-w-0">
              <span className="text-blue-900 font-bold text-sm sm:text-base whitespace-nowrap">
                {selectedDates.length > 0 ? `📅 ${selectedDates.length}日選択中` : '📅 カレンダーから日付をタップで選択/解除'}
              </span>
              {selectedDates.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {selectedDates.slice(0, 8).map((date, index) => (
                    <span key={index} className="text-xs px-2 py-0.5 rounded-full font-bold bg-blue-600 text-white">
                      {date.getMonth() + 1}/{date.getDate()}
                    </span>
                  ))}
                  {selectedDates.length > 8 && (
                    <span className="text-xs px-2 py-0.5 rounded-full font-bold bg-slate-500 text-white">
                      +{selectedDates.length - 8}
                    </span>
                  )}
                </div>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {selectedDates.length > 0 && (
                <button
                  onClick={handleMultiSelectComplete}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-1.5 px-3 sm:py-2 sm:px-4 rounded-lg transition text-xs sm:text-sm touch-manipulation whitespace-nowrap"
                >
                  ✏️ 内容を入力
                </button>
              )}
              <button
                onClick={handleMultiSelectCancel}
                className="bg-slate-400 hover:bg-slate-500 text-white font-bold py-1.5 px-2.5 sm:py-2 sm:px-3 rounded-lg transition text-xs sm:text-sm touch-manipulation"
                title="選択モードを解除"
              >
                ✕
              </button>
            </div>
          </div>
        </div>
      )}

      {/* メインカレンダー表示 */}
      <div className="max-w-7xl mx-auto px-2 sm:px-4 lg:px-8 py-4 sm:py-8">
        <div className="bg-white rounded-xl sm:rounded-2xl shadow-lg p-3 sm:p-6">
          <Calendar 
            value={selectedDate} 
            activeStartDate={selectedDate} 
            onActiveStartDateChange={({ activeStartDate, view }) => {
              // 月表示が変更された場合のみ処理（日付クリック時には影響しない）
              if (activeStartDate && view === 'month') {
                const currentMonth = selectedDate.getMonth()
                const currentYear = selectedDate.getFullYear()
                const newMonth = activeStartDate.getMonth()
                const newYear = activeStartDate.getFullYear()
                
                // 月が実際に変更された場合のみ処理
                if (currentMonth !== newMonth || currentYear !== newYear) {
                  const currentDay = selectedDate.getDate()
                  const newDate = new Date(activeStartDate)
                  // 新しい月に同じ日付が存在する場合は保持、存在しない場合は1日に設定
                  const maxDay = new Date(newDate.getFullYear(), newDate.getMonth() + 1, 0).getDate()
                  newDate.setDate(Math.min(currentDay, maxDay))
                  setSelectedDate(newDate)
                }
              }
            }} 
            locale="ja-JP" 
            tileContent={getTileContent} 
            className="w-full border-none calendar-large" 
            tileDisabled={() => false} 
          />
        </div>
        
        {/* 月次サマリー */}
        <div className="mt-8 bg-white rounded-2xl shadow-lg p-6">
          <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
            <h3 className="font-bold text-gray-900 text-lg">{selectedDate.getMonth() + 1}月の手当履歴</h3>
            {!isAllowLocked && (
              <button
                onClick={() => { setIsMultiSelectMode(true); window.scrollTo({ top: 0, behavior: 'smooth' }) }}
                className="text-xs font-bold px-3 py-1.5 rounded-lg bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 transition flex items-center gap-1"
              >
                📅 複数日まとめて修正
              </button>
            )}
          </div>
          {!isAllowLocked && (
            <p className="text-xs text-slate-400 mb-3">
              ✏️ 1件ずつ修正 → 「修正」ボタン　／　複数日まとめて修正 → 上の「複数日まとめて修正」ボタンで日付を選び直して上書き保存
            </p>
          )}
          <div className="space-y-2">
            {allowances.filter(i => { const d = new Date(i.date); return d.getMonth() === selectedDate.getMonth() && d.getFullYear() === selectedDate.getFullYear() }).map((item) => (
              <div key={item.id} className="bg-slate-50 p-3 rounded-xl flex justify-between items-center border border-slate-100 hover:border-slate-200 transition">
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <div className="shrink-0 w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-sm">
                    {item.date.split('-')[2]}
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="text-sm font-bold text-gray-900 leading-snug truncate">{item.activity_type}</span>
                    {item.destination_type && (
                      <span className="text-xs text-slate-500">📍 {item.destination_type}</span>
                    )}
                    {item.is_accommodation && (
                      <span className="text-xs text-amber-600 font-bold">🏨 宿泊あり</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0 ml-2">
                  <span className="font-bold text-gray-900 text-base">¥{item.amount.toLocaleString()}</span>
                  {!isAllowLocked && (
                    <button
                      onClick={() => handleEditAllowance(item.date)}
                      className="text-xs font-bold px-2.5 py-1.5 rounded-lg bg-white text-blue-700 border border-blue-200 hover:bg-blue-50 transition touch-manipulation"
                    >
                      ✏️ 修正
                    </button>
                  )}
                  {!isAllowLocked && (
                    <button
                      onClick={() => handleDelete(item.id, item.date)}
                      className="text-slate-300 hover:text-red-500 transition text-xl touch-manipulation"
                    >
                      🗑
                    </button>
                  )}
                </div>
              </div>
            ))}
            {allowances.filter(i => { const d = new Date(i.date); return d.getMonth() === selectedDate.getMonth() && d.getFullYear() === selectedDate.getFullYear() }).length === 0 && (
              <div className="text-center py-8 text-slate-400">まだ手当の登録がありません</div>
            )}
          </div>
        </div>
      </div>

      {/* 入力フォームモーダル - スマホ: 全画面、PC: センター表示 */}
      {showInputModal && (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 sm:p-4" onClick={() => setShowInputModal(false)}>
          <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-2xl h-[95vh] sm:h-auto sm:max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            {/* モーダルヘッダー */}
            <div className="sticky top-0 bg-white border-b border-slate-200 px-4 sm:px-6 py-3 sm:py-4 flex justify-between items-start rounded-t-2xl z-10">
              <div className="flex-1">
                {selectedDates.length > 0 ? (
                  <>
                    <h2 className="font-bold text-gray-900 text-base sm:text-lg mb-2">
                      📅 複数日入力（{selectedDates.length}日分）
                    </h2>
                    <p className="text-xs text-slate-500 mb-2">共通設定 or 日付をタップして個別設定</p>
                    {/* 日付タブ：共通設定 + 日付ごと */}
                    <div className="flex flex-wrap gap-1.5">
                      {/* 共通設定タブ */}
                      <button
                        type="button"
                        onClick={() => setActiveEditDate(null)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition touch-manipulation ${
                          activeEditDate === null
                            ? 'bg-blue-600 text-white shadow'
                            : 'bg-white border border-blue-200 text-blue-700 hover:bg-blue-50'
                        }`}
                      >
                        🔗 共通設定
                        {Object.keys(perDateOverrides).length > 0 && activeEditDate !== null && (
                          <span className="ml-1 text-blue-300">
                            ({selectedDates.filter(d => !perDateOverrides[formatDate(d)]).length}日)
                          </span>
                        )}
                      </button>
                      {/* 日付ごとタブ */}
                      {[...selectedDates].sort((a, b) => a.getTime() - b.getTime()).map((date) => {
                        const dateStr = formatDate(date)
                        const hasOverride = !!perDateOverrides[dateStr]
                        const isActive = activeEditDate === dateStr
                        return (
                          <button
                            key={dateStr}
                            type="button"
                            onClick={() => {
                              setActiveEditDate(dateStr)
                              if (!perDateOverrides[dateStr]) {
                                // 初回タップ時：既存データまたは共通設定で初期化
                                const existing = allowances.find(a => a.date === dateStr)
                                const init: AllowanceInputState = existing
                                  ? { ...parseStoredAllowance(existing), accommodationNights: 0 }
                                  : { ...allowanceInput, accommodationNights: 0 }
                                setPerDateOverrides(prev => ({ ...prev, [dateStr]: init }))
                              }
                            }}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition touch-manipulation flex items-center gap-1 ${
                              isActive
                                ? 'bg-purple-600 text-white shadow'
                                : hasOverride
                                  ? 'bg-purple-100 border border-purple-400 text-purple-800'
                                  : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                            }`}
                          >
                            {date.getMonth() + 1}/{date.getDate()}
                            {hasOverride && <span className="text-purple-400">✏️</span>}
                          </button>
                        )
                      })}
                    </div>
                    {/* 個別設定中の場合：リセットボタン */}
                    {activeEditDate && (
                      <div className="mt-2 flex items-center justify-between">
                        <span className="text-xs font-bold text-purple-700">
                          ✏️ {(() => { const [y,m,d] = activeEditDate.split('-').map(Number); return `${m}月${d}日 の個別設定` })()}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setPerDateOverrides(prev => {
                              const next = { ...prev }
                              delete next[activeEditDate]
                              return next
                            })
                            setActiveEditDate(null)
                          }}
                          className="text-xs text-slate-500 hover:text-red-600 border border-slate-200 px-2 py-1 rounded-lg transition"
                        >
                          🔄 共通設定に戻す
                        </button>
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    <h2 className="font-bold text-gray-900 text-base sm:text-lg">{selectedDate.getMonth() + 1}月{selectedDate.getDate()}日 ({['日', '月', '火', '水', '木', '金', '土'][selectedDate.getDay()]}) の手当入力</h2>
                    <div className="flex gap-2 mt-2">
                      {isAllowLocked && <span className="text-xs px-2 py-1 rounded font-bold bg-gray-100 text-gray-500">💰 編集不可</span>}
                      {shouldShowHolidayBadge(dayType) && (
                        <span className="text-xs px-2 py-1 rounded font-bold bg-red-100 text-red-600">
                          {dayType}
                        </span>
                      )}
                    </div>
                  </>
              )}
              </div>
              <button onClick={() => { setShowInputModal(false); setSelectedDates([]); setIsMultiSelectMode(false); setPerDateOverrides({}); setActiveEditDate(null); }} className="text-slate-400 hover:text-slate-600 active:text-slate-800 text-3xl sm:text-2xl font-bold ml-2 touch-manipulation">×</button>
            </div>

            {/* モーダルコンテンツ */}
            <div className="p-4 sm:p-6">
              {/* 個別設定中の日付の勤務区分バッジ */}
              {selectedDates.length > 0 && activeEditDate && (() => {
                const [y,m,d] = activeEditDate.split('-').map(Number)
                const dt = getDayTypeForDate(new Date(y, m-1, d), annualSchedules, schoolCalendar, getJapaneseHoliday)
                if (!shouldShowHolidayBadge(dt)) return null
                return (
                  <div className="mb-3 flex items-center gap-2">
                    <span className="text-xs px-2 py-1 rounded font-bold bg-red-100 text-red-600">
                      {dt}
                    </span>
                  </div>
                )
              })()}
              <form onSubmit={handleSave} className={`flex flex-col gap-4 sm:gap-5 ${isAllowLocked ? 'opacity-60 pointer-events-none' : ''}`}>
                {(() => {
                  // アクティブな入力値と dayType を決定
                  const activeInput = selectedDates.length > 0 && activeEditDate
                    ? (perDateOverrides[activeEditDate] ?? allowanceInput)
                    : allowanceInput
                  const setActiveInput = (v: AllowanceInputState) => {
                    if (selectedDates.length > 0 && activeEditDate) {
                      setPerDateOverrides(prev => ({ ...prev, [activeEditDate]: v }))
                    } else {
                      setAllowanceInput(v)
                    }
                  }
                  const activeDayType = selectedDates.length > 0 && activeEditDate
                    ? (() => { const [y,m,d] = activeEditDate.split('-').map(Number); return getDayTypeForDate(new Date(y,m-1,d), annualSchedules, schoolCalendar, getJapaneseHoliday) })()
                    : dayType
                  const activeTotalDates = selectedDates.length > 0 && !activeEditDate
                    ? selectedDates.length
                    : 1
                  const activeTotalAmount = calculateR8Total(activeInput, activeDayType)
                  return (
                    <AllowanceInputForm
                      value={activeInput}
                      onChange={setActiveInput}
                      dayType={activeDayType}
                      isLocked={isAllowLocked}
                      totalAmount={activeTotalAmount}
                      totalDates={activeTotalDates}
                    />
                  )
                })()}

                {!isAllowLocked && (
                  <div className="flex flex-col gap-2 sm:gap-3">
                    <button
                      type="submit"
                      disabled={submittingStatus}
                      className="w-full bg-gradient-to-r from-blue-600 to-blue-700 text-white font-bold py-4 sm:py-5 rounded-xl hover:from-blue-700 hover:to-blue-800 active:from-blue-800 active:to-blue-900 shadow-xl hover:shadow-2xl text-base sm:text-lg touch-manipulation transition-all transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
                    >
                      <span className="flex items-center justify-center gap-2">
                        <span className="text-xl">💾</span>
                        <span>この内容で保存する</span>
                      </span>
                    </button>
                    {monthlyStatus === 'DRAFT' && (
                      <button
                        type="button"
                        onClick={handleApplyFromInputModal}
                        disabled={submittingStatus}
                        className="w-full bg-gradient-to-r from-emerald-500 to-emerald-600 text-white font-bold py-4 sm:py-5 rounded-xl hover:from-emerald-600 hover:to-emerald-700 active:from-emerald-700 active:to-emerald-800 shadow-xl hover:shadow-2xl text-base sm:text-lg touch-manipulation transition-all disabled:opacity-50"
                      >
                        <span className="flex items-center justify-center gap-2">
                          <span className="text-xl">📤</span>
                          <span>{submittingStatus ? '処理中…' : '保存して今月の手当を申請する'}</span>
                        </span>
                      </button>
                    )}
                    {monthlyStatus === 'DRAFT' && (
                      <p className="text-xs text-slate-500 text-center">
                        申請後は管理者の承認または返却までは編集できません
                      </p>
                    )}
                  </div>
                )}
              </form>
            </div>
          </div>
        </div>
      )}

      {/* 氏名登録モーダル（中央に大きく表示） */}
      {showProfileModal && (
          <div 
              className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
              onClick={() => {
                  if (userName) setShowProfileModal(false)
              }}
          >
              <div 
                  className="bg-white p-8 rounded-3xl shadow-2xl w-full max-w-md border-4 border-blue-500 relative"
                  onClick={(e) => e.stopPropagation()}
              >
                  {/* ×ボタン（既に氏名が登録されている場合のみ表示） */}
                  {userName && (
                      <button
                          onClick={() => setShowProfileModal(false)}
                          className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 active:text-slate-800 text-3xl font-bold transition touch-manipulation"
                      >
                          ×
                      </button>
                  )}
                  
                  <div className="text-center mb-4">
                      <div className="text-5xl mb-2">👤</div>
                      <h3 className="text-2xl font-extrabold text-gray-900">
                          {userName ? '氏名を変更' : '氏名を登録'}
                      </h3>
                  </div>
                  <p className="text-sm text-slate-600 mb-6 text-center">
                      {userName ? (
                        <>帳票用の氏名を変更できます。</>
                      ) : (
                        <>帳票用の氏名が未登録です。氏名を入力して登録してください。</>
                      )}
                  </p>
                  
                  {/* 現在の氏名表示（変更時のみ） */}
                  {userName && (
                      <div className="mb-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
                          <p className="text-xs text-blue-700 font-bold mb-1">現在の氏名</p>
                          <p className="text-sm text-blue-900 font-bold">{userName}</p>
                      </div>
                  )}
                  
                  <div className="space-y-4 mb-6">
                      <div>
                          <label className="block text-sm font-bold text-gray-700 mb-2">氏名</label>
                          <input 
                              type="text" 
                              value={inputDisplayName} 
                              onChange={(e) => setInputDisplayName(e.target.value)} 
                              placeholder="例: 三田村 和真" 
                              className="w-full px-4 py-3 border-2 border-slate-300 rounded-lg font-bold text-black focus:border-blue-500 focus:outline-none" 
                          />
                      </div>
                  </div>
                  
                  <div className="flex flex-col gap-3">
                      <div className="flex gap-3">
                          {userName && (
                              <button 
                                  onClick={() => { setShowProfileModal(false); setInputDisplayName(''); }}
                                  className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-700 font-bold py-4 rounded-xl transition shadow-lg text-lg"
                              >
                                  キャンセル
                              </button>
                          )}
                          <button 
                              onClick={handleSaveProfile} 
                              className={`${userName ? 'flex-1' : 'w-full'} bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-bold py-4 rounded-xl transition shadow-xl text-lg`}
                          >
                              💾 {userName ? '氏名を変更する' : '氏名を登録する'}
                          </button>
                      </div>
                      {!userName && (
                          <button onClick={() => setShowProfileModal(false)} className="text-sm text-slate-500 hover:text-slate-700 underline">
                              あとでする
                          </button>
                      )}
                  </div>
              </div>
          </div>
      )}
    </div>
  )
}

// Update trigger: 2026-01-19 23:45:00 JST - Force rebuild for Vercel deployment
// This ensures the page is properly recognized and deployed
