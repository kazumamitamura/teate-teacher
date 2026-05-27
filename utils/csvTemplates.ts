/** UTF-8 BOM 付き CSV をブラウザでダウンロード */
export function downloadCsvTemplate(filename: string, csvBody: string) {
  const csv = '\uFEFF' + csvBody.replace(/^\uFEFF/, '')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

/** ユーザー管理: 氏名, メールアドレス, 権限 */
export const TEACHERS_CSV_FILENAME = 'teachers_format.csv'
export const TEACHERS_CSV_BODY = `氏名,メールアドレス,権限
三田村 和真,mitamuraka@haguroko.ed.jp,super_admin
友野 太郎,tomonoem@haguroko.ed.jp,admin
山田 花子,yamada@haguroko.ed.jp,
`

export function downloadTeachersCsvTemplate() {
  downloadCsvTemplate(TEACHERS_CSV_FILENAME, TEACHERS_CSV_BODY)
}

/** 年間勤務表: 日付, 勤務区分, 行事名 */
export const ANNUAL_SCHEDULE_CSV_FILENAME = 'annual_schedule_format.csv'
export const ANNUAL_SCHEDULE_CSV_BODY = `日付,勤務区分,行事名
2025-04-01,A,入学式
2025-04-02,B,通常授業
2025-04-29,祝,昭和の日
2025-05-03,休,憲法記念日
2025/06/01,A,行事名は省略可
`

export function downloadAnnualScheduleCsvTemplate() {
  downloadCsvTemplate(ANNUAL_SCHEDULE_CSV_FILENAME, ANNUAL_SCHEDULE_CSV_BODY)
}
