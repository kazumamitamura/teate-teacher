'use client'

import { useState } from 'react'
import Link from 'next/link'

/** 検索時にセクションを表示するか判定するラッパー */
function ManualSection({
  searchQuery,
  searchText,
  children,
}: {
  searchQuery: string
  searchText: string
  children: React.ReactNode
}) {
  const q = searchQuery.trim().toLowerCase()
  if (!q) return <>{children}</>
  if (searchText.toLowerCase().includes(q)) return <>{children}</>
  return null
}

/** 図番号（1〜7）に対応する画像パス */
const MANUAL_IMAGE_PATHS: Record<number, string> = {
  1: '/images/manual/login.png',
  2: '/images/manual/dashboard-top.png',
  3: '/images/manual/calendar-zoom.png',
  4: '/images/manual/input-modal.png',
  5: '/images/manual/input-calc.png',
  6: '/images/manual/multi-select.png',
  7: '/images/manual/apply-confirm.png',
}

/** 図番号に対応するキャプション */
const MANUAL_IMAGE_CAPTIONS: Record<number, string> = {
  1: '図1：ログイン画面',
  2: '図2：トップ画面（カレンダー）全体',
  3: '図3：カレンダーの日付表示の例',
  4: '図4：手当入力画面（1日分）',
  5: '図5：支給予定額と保存ボタン',
  6: '図6：複数日選択モード（案内バーとカレンダー）',
  7: '図7：手当申請ボタンと確認画面',
}

type FigNumber = 1 | 2 | 3 | 4 | 5 | 6 | 7

function ManualImage({ fig, caption }: { fig: FigNumber; caption?: string }) {
  const src = MANUAL_IMAGE_PATHS[fig]
  const label = caption ?? MANUAL_IMAGE_CAPTIONS[fig]
  return (
    <figure className="my-6 border border-slate-300 rounded-lg overflow-hidden bg-slate-50">
      <img
        src={src}
        alt={label}
        className="w-full h-auto block"
      />
      <figcaption className="px-4 py-2 text-sm text-slate-600 border-t border-slate-200 bg-white">
        {label}
      </figcaption>
    </figure>
  )
}

export default function ManualPage() {
  const [searchQuery, setSearchQuery] = useState('')

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      <div className="bg-white shadow-sm border-b border-slate-200">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <h1 className="text-2xl font-bold text-gray-900">操作マニュアル</h1>
            <Link
              href="/"
              className="text-blue-600 hover:text-blue-700 font-bold text-sm"
            >
              ← メイン画面に戻る
            </Link>
          </div>
          {/* 検索窓 */}
          <div className="mt-4">
            <label htmlFor="manual-search" className="sr-only">
              キーワードでマニュアルを検索
            </label>
            <input
              id="manual-search"
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="キーワードで検索（例：申請、ログイン、複数日、休日、期限）"
              className="w-full max-w-md px-4 py-2.5 rounded-lg border border-slate-300 bg-white text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
            />
          </div>
        </div>
      </div>

      <article className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-2xl shadow-xl p-6 sm:p-8 prose prose-slate max-w-none">
          <h2 className="text-xl font-bold text-gray-900 mt-0">
            特殊勤務手当管理アプリ 仕様マニュアル
          </h2>
          <p className="text-gray-700">
            部活動指導等の手当を入力・集計するためのWebアプリの操作説明です。
          </p>

          <hr className="border-slate-200 my-8" />

          {/* 1. アプリの概要 */}
          <ManualSection searchQuery={searchQuery} searchText="アプリ 概要 できること 手当 入力 集計 申請 複数日 一括 利用の流れ ログイン 氏名 カレンダー">
          <h3 className="text-lg font-bold text-gray-900 mt-8">1. アプリの概要</h3>
          <h4 className="text-base font-semibold text-gray-800 mt-4">1.1 できること</h4>
          <ul className="list-disc pl-6 text-gray-700 space-y-1">
            <li><strong>手当の入力</strong>：日付を選び、業務内容・行き先・運転・宿泊の有無を入力する</li>
            <li><strong>月ごとの集計確認</strong>：支給予定額・合宿日数・遠征日数が自動表示される</li>
            <li><strong>複数日の一括入力</strong>：同じ内容で複数日分をまとめて入力できる</li>
          </ul>
          <h4 className="text-base font-semibold text-gray-800 mt-4">1.2 利用の流れ（概要）</h4>
          <p className="text-gray-700">
            1. ログイン（新規登録時に氏名入力） → 2. カレンダーで日付を選んで手当を入力。氏名の変更は「👤 アカウント」から
          </p>
          </ManualSection>

          <hr className="border-slate-200 my-8" />

          {/* 2. ログイン */}
          <ManualSection searchQuery={searchQuery} searchText="ログイン メール パスワード 手順 パスワードを忘れた URL 画面 新規登録 姓 名">
          <h3 className="text-lg font-bold text-gray-900 mt-8">2. ログイン</h3>
          <ManualImage fig={1} />
          <h4 className="text-base font-semibold text-gray-800 mt-4">2.1 ログイン画面の開き方</h4>
          <p className="text-gray-700">
            アプリのURL（例：https://haguro-allowance-app.vercel.app）をブラウザで開きます。
          </p>
          <h4 className="text-base font-semibold text-gray-800 mt-4">2.2 ログイン手順</h4>
          <ol className="list-decimal pl-6 text-gray-700 space-y-1">
            <li><strong>メールアドレス</strong>と<strong>パスワード</strong>を入力する</li>
            <li><strong>「ログイン」</strong>ボタンをクリックする</li>
            <li>ログインに成功すると、カレンダー画面（トップ画面）に移動する</li>
          </ol>
          <h4 className="text-base font-semibold text-gray-800 mt-4">2.3 パスワードを忘れた場合</h4>
          <ul className="list-disc pl-6 text-gray-700 space-y-1">
            <li>ログイン画面の「パスワードを忘れた方」をクリックする</li>
            <li>案内に従い、登録メールアドレスに送られるリンクからパスワードを再設定する</li>
          </ul>
          <h4 className="text-base font-semibold text-gray-800 mt-4">2.4 新規登録の手順</h4>
          <p className="text-gray-700">初めて利用する方は、ログイン画面から新規登録を行います。</p>
          <ol className="list-decimal pl-6 text-gray-700 space-y-2">
            <li>アプリのログイン画面（<strong>/login</strong>）を開く</li>
            <li>画面上部のタブで<strong>「新規登録」</strong>をクリックする</li>
            <li>次の項目を入力する：
              <ul className="list-disc pl-6 mt-1 space-y-0.5">
                <li><strong>姓</strong>・<strong>名</strong>（帳票に表示される名前。例：姓「三田村」、名「和真」）</li>
                <li><strong>メールアドレス</strong>（ログイン時に使用。学校などで使うアドレスを推奨）</li>
                <li><strong>パスワード</strong>（6文字以上。忘れないようにメモしておいてください）</li>
              </ul>
            </li>
            <li><strong>「新規登録してログイン」</strong>ボタンをクリックする</li>
            <li>登録が完了すると、そのままカレンダー画面（トップ）に移動します。メール確認は不要です。</li>
          </ol>
          <p className="text-gray-700 text-sm mt-2">※すでに同じメールアドレスで登録済みの場合は、同じ画面の「ログイン」タブからログインしてください。</p>
          </ManualSection>

          <hr className="border-slate-200 my-8" />

          {/* 3. トップ画面 */}
          <ManualSection searchQuery={searchQuery} searchText="トップ カレンダー 月 支給予定額 合宿 遠征 期限 手当申請 氏名 規約 ログアウト 複数日 日付 休日 勤務日 履歴 ゴミ箱">
          <h3 className="text-lg font-bold text-gray-900 mt-8">3. トップ画面（カレンダー）の見方</h3>
          <p className="text-gray-700">ログイン後、最初に表示されるのが「トップ画面」です。</p>
          <ManualImage fig={2} />
          <h4 className="text-base font-semibold text-gray-800 mt-4">3.1 画面上部の要素</h4>
          <div className="overflow-x-auto my-4">
            <table className="w-full border border-slate-200 text-sm">
              <thead>
                <tr className="bg-slate-100">
                  <th className="border border-slate-200 px-3 py-2 text-left">表示・ボタン</th>
                  <th className="border border-slate-200 px-3 py-2 text-left">説明</th>
                </tr>
              </thead>
              <tbody className="text-gray-700">
                <tr><td className="border border-slate-200 px-3 py-2">‹ ○年○月 ›</td><td className="border border-slate-200 px-3 py-2">月の切り替え。‹で前月、›で次月。</td></tr>
                <tr><td className="border border-slate-200 px-3 py-2">支給予定額 ¥○○○</td><td className="border border-slate-200 px-3 py-2">表示中の月の手当合計（自動計算）</td></tr>
                <tr><td className="border border-slate-200 px-3 py-2">合宿：○日 / 遠征：○日</td><td className="border border-slate-200 px-3 py-2">その月の合宿・遠征の日数</td></tr>
                <tr><td className="border border-slate-200 px-3 py-2">👤 アカウント</td><td className="border border-slate-200 px-3 py-2">氏名の登録・変更（新規登録時に入力した氏名は自動で登録されます）</td></tr>
                <tr><td className="border border-slate-200 px-3 py-2">規約閲覧</td><td className="border border-slate-200 px-3 py-2">手当規約のページへ移動</td></tr>
                <tr><td className="border border-slate-200 px-3 py-2">ログアウト</td><td className="border border-slate-200 px-3 py-2">ログアウトする</td></tr>
                <tr><td className="border border-slate-200 px-3 py-2">📅 複数日まとめて入力</td><td className="border border-slate-200 px-3 py-2">複数日をまとめて同じ内容で入力するモード（後述）</td></tr>
              </tbody>
            </table>
          </div>
          <h4 className="text-base font-semibold text-gray-800 mt-4">3.2 カレンダー上の表示</h4>
          <ul className="list-disc pl-6 text-gray-700 space-y-1">
            <li><strong>日付</strong>：クリック（タップ）すると、その日の手当入力画面が開く</li>
            <li><strong>休日</strong>：紫色の「休日」などと表示される日（土日・祝日は自動で休日扱い）</li>
            <li><strong>勤務日</strong>：A・B・Cなどのラベルが付く日（年間予定に基づく）</li>
            <li><strong>入力済みの日</strong>：白背景で、金額と業務内容が表示される</li>
            <li><strong>今日</strong>：青い枠で強調される</li>
          </ul>
          <ManualImage fig={3} />
          <h4 className="text-base font-semibold text-gray-800 mt-4">3.3 手当履歴（画面下部）</h4>
          <ul className="list-disc pl-6 text-gray-700 space-y-1">
            <li>表示中の月に入力した手当が、日付・業務内容・金額の一覧で表示される</li>
            <li>各行のゴミ箱アイコンで、その日付の手当を削除できる</li>
          </ul>
          </ManualSection>

          <hr className="border-slate-200 my-8" />

          {/* 4. 手当の入力方法 */}
          <ManualSection searchQuery={searchQuery} searchText="入力 1日 日付 クリック モーダル 業務内容 行き先 運転 宿泊 保存 部活動 休日 勤務日 支給予定額 編集 削除 行き先 大会 運転あり 宿泊あり">
          <h3 className="text-lg font-bold text-gray-900 mt-8">4. 手当の入力方法（1日分）</h3>
          <h4 className="text-base font-semibold text-gray-800 mt-4">4.1 入力の流れ</h4>
          <ol className="list-decimal pl-6 text-gray-700 space-y-1">
            <li>トップ画面のカレンダーで<strong>日付をクリック（タップ）</strong>する</li>
            <li>その日の<strong>手当入力画面（モーダル）</strong>が開く</li>
            <li><strong>業務内容・行き先・運転・宿泊</strong>を選び、<strong>「この内容で保存する」</strong>を押す</li>
          </ol>
          <ManualImage fig={4} />
          <h4 className="text-base font-semibold text-gray-800 mt-4">4.2 入力項目の説明</h4>
          <p className="text-gray-700 font-medium">部活動 業務内容（必須）</p>
          <p className="text-gray-700 text-sm">プルダウンから1つ選びます。<strong>休日のみ選べるもの</strong>と<strong>勤務日・休日どちらでも選べるもの</strong>があります。</p>
          <div className="overflow-x-auto my-4">
            <table className="w-full border border-slate-200 text-sm">
              <thead>
                <tr className="bg-slate-100">
                  <th className="border border-slate-200 px-3 py-2 text-left">選択肢</th>
                  <th className="border border-slate-200 px-3 py-2 text-left">選べる日</th>
                  <th className="border border-slate-200 px-3 py-2 text-left">備考</th>
                </tr>
              </thead>
              <tbody className="text-gray-700">
                <tr><td className="border border-slate-200 px-3 py-2">なし（部活なし）</td><td className="border border-slate-200 px-3 py-2">いつでも</td><td className="border border-slate-200 px-3 py-2">手当なしにするとき</td></tr>
                <tr><td className="border border-slate-200 px-3 py-2">A:休日部活(1日)</td><td className="border border-slate-200 px-3 py-2">休日のみ</td><td className="border border-slate-200 px-3 py-2">2,400円</td></tr>
                <tr><td className="border border-slate-200 px-3 py-2">B:休日部活(半日)</td><td className="border border-slate-200 px-3 py-2">休日のみ</td><td className="border border-slate-200 px-3 py-2">1,700円</td></tr>
                <tr><td className="border border-slate-200 px-3 py-2">C:指定大会（対外運動競技等引率）</td><td className="border border-slate-200 px-3 py-2">いつでも</td><td className="border border-slate-200 px-3 py-2">大会名入力あり</td></tr>
                <tr><td className="border border-slate-200 px-3 py-2">D:指定外大会</td><td className="border border-slate-200 px-3 py-2">いつでも</td><td className="border border-slate-200 px-3 py-2">—</td></tr>
                <tr><td className="border border-slate-200 px-3 py-2">E:遠征（部活動指導）</td><td className="border border-slate-200 px-3 py-2">いつでも</td><td className="border border-slate-200 px-3 py-2">運転・宿泊で金額変動</td></tr>
                <tr><td className="border border-slate-200 px-3 py-2">F:校内合宿（宿泊を伴う指導）</td><td className="border border-slate-200 px-3 py-2">いつでも</td><td className="border border-slate-200 px-3 py-2">宿泊で加算</td></tr>
                <tr><td className="border border-slate-200 px-3 py-2">G:研修旅行等引率</td><td className="border border-slate-200 px-3 py-2">いつでも</td><td className="border border-slate-200 px-3 py-2">—</td></tr>
                <tr><td className="border border-slate-200 px-3 py-2">災害業務</td><td className="border border-slate-200 px-3 py-2">いつでも</td><td className="border border-slate-200 px-3 py-2">内容のテキスト入力必須</td></tr>
                <tr><td className="border border-slate-200 px-3 py-2">その他（手入力）</td><td className="border border-slate-200 px-3 py-2">いつでも</td><td className="border border-slate-200 px-3 py-2">内容・金額を手入力</td></tr>
              </tbody>
            </table>
          </div>
          <p className="text-gray-700 text-sm">休日の日に「A」「B」が選べない場合は、その日が休日として判定されていない可能性があります（土日・祝日は自動で休日になります）。</p>
          <p className="text-gray-700 font-medium mt-3">行き先（区分）</p>
          <p className="text-gray-700 text-sm">業務内容によって表示されます。校内・管内（庄内・新庄最上）・県内（片道120km以上）・県外から選択します。</p>
          <p className="text-gray-700 font-medium mt-3">指定大会の場合</p>
          <p className="text-gray-700 text-sm">「C:指定大会」を選んだときは<strong>大会名</strong>を入力します。県内120km以上または県外で「運転あり」のときは、<strong>目的地（運転先）</strong>も入力します。</p>
          <p className="text-gray-700 font-medium mt-3">運転あり・宿泊あり</p>
          <p className="text-gray-700 text-sm"><strong>運転あり</strong>：車で移動する場合にチェック。<strong>宿泊あり</strong>：宿泊を伴う場合にチェック。チェックの有無で<strong>支給予定額が自動計算</strong>されます。</p>
          <h4 className="text-base font-semibold text-gray-800 mt-4">4.3 支給予定額と保存</h4>
          <ul className="list-disc pl-6 text-gray-700 space-y-1">
            <li>入力内容に応じて<strong>支給予定額</strong>が自動で表示される</li>
            <li>内容を確認し、<strong>「この内容で保存する」</strong>をクリックして保存する</li>
            <li>保存後、モーダルが閉じ、カレンダーと手当履歴が更新される</li>
          </ul>
          <ManualImage fig={5} />
          <h4 className="text-base font-semibold text-gray-800 mt-4">4.4 編集・削除</h4>
          <ul className="list-disc pl-6 text-gray-700 space-y-1">
            <li><strong>編集</strong>：同じ日付を再度クリックして入力画面を開き、内容を変えて保存する</li>
            <li><strong>削除</strong>：トップ画面下部の「○月の手当履歴」で、該当行のゴミ箱アイコンをクリックして削除する</li>
          </ul>
          <p className="text-gray-700 text-sm">※入力した手当はいつでも編集・削除できます。</p>
          </ManualSection>

          <hr className="border-slate-200 my-8" />

          {/* 5. 複数日まとめて入力 */}
          <ManualSection searchQuery={searchQuery} searchText="複数日 まとめて 選択 案内バー 内容を入力 申請済み 期限 注意 解除">
          <h3 className="text-lg font-bold text-gray-900 mt-8">5. 複数日まとめて入力</h3>
          <p className="text-gray-700">同じ内容で<strong>複数の日</strong>にまとめて手当を入れたいときに使います。</p>
          <h4 className="text-base font-semibold text-gray-800 mt-4">5.1 手順</h4>
          <ol className="list-decimal pl-6 text-gray-700 space-y-1">
            <li>トップ画面で<strong>「📅 複数日まとめて入力」</strong>ボタンをクリックする</li>
            <li>カレンダー直上に<strong>「📅 カレンダーから日付をタップで選択/解除」</strong>などの案内バーが出る</li>
            <li><strong>カレンダーで日付をクリック</strong>するたびに、その日が選択／解除される（複数日選べる）</li>
            <li>選択した日付が案内バーに「○日選択中」「1/3」「1/5」のように表示される</li>
            <li><strong>「✏️ 内容を入力」</strong>をクリックする</li>
            <li>開いた入力画面で<strong>業務内容・行き先・運転・宿泊</strong>を入力し、<strong>「この内容で保存する」</strong>を押す</li>
            <li>選択した<strong>すべての日</strong>に同じ内容で保存される</li>
          </ol>
          <ManualImage fig={6} />
          <h4 className="text-base font-semibold text-gray-800 mt-4">5.2 注意点</h4>
          <ul className="list-disc pl-6 text-gray-700 space-y-1">
            <li>選択した日を確認し、「内容を入力」で同じ内容を一括入力します</li>
            <li>選択モードをやめるときは、案内バーの<strong>「✕」</strong>をクリックする</li>
          </ul>
          </ManualSection>

          <hr className="border-slate-200 my-8" />

          {/* 6. 手当の入力について（申請・承認は行いません） */}
          <ManualSection searchQuery={searchQuery} searchText="手当 入力 保存 編集 削除 集計">
          <h3 className="text-lg font-bold text-gray-900 mt-8">6. 手当の入力について</h3>
          <p className="text-gray-700">
            手当は日付ごとに入力・保存すると、その月の支給予定額や合宿・遠征日数として自動で集計されます。申請・承認の手続きはありません。入力した内容はいつでも編集・削除できます。
          </p>
          </ManualSection>

          <hr className="border-slate-200 my-8" />

          {/* 7. その他の機能 */}
          <ManualSection searchQuery={searchQuery} searchText="氏名登録 規約閲覧 管理者 事務担当者 氏名 変更">
          <h3 className="text-lg font-bold text-gray-900 mt-8">7. その他の機能</h3>
          <h4 className="text-base font-semibold text-gray-800 mt-4">7.1 氏名の登録・変更</h4>
          <p className="text-gray-700">氏名はトップ画面の<strong>「👤 アカウント」</strong>をクリックすると変更・登録できます。帳票などに使う表示名として保存されます。</p>
          <h4 className="text-base font-semibold text-gray-800 mt-4">7.2 規約閲覧</h4>
          <p className="text-gray-700"><strong>「規約閲覧」</strong>をクリックすると、手当に関する規約を確認できるページに移動します。</p>
          <h4 className="text-base font-semibold text-gray-800 mt-4">7.3 事務担当者（管理者）向けページ</h4>
          <p className="text-gray-700">管理者用メールアドレスでログインしている場合、画面上部に<strong>「事務担当者ページへ」</strong>のリンクが表示されます。クリックすると、Excel出力・設定などの管理機能があるページに移動します。（一般ユーザー向けマニュアルでは、詳細は「管理者マニュアル」に任せてよいです）</p>
          </ManualSection>

          <hr className="border-slate-200 my-8" />

          {/* 8. よくある質問 */}
          <ManualSection searchQuery={searchQuery} searchText="よくある質問 休日 選べない テーブル 期限 申請 差し戻し 複数日 変更 保存 エラー">
          <h3 className="text-lg font-bold text-gray-900 mt-8">8. よくある質問・注意事項</h3>
          <p className="text-gray-700 font-medium">Q1. 休日なのに「A:休日部活(1日)」が選べない</p>
          <p className="text-gray-700 text-sm">その日が<strong>休日として判定されているか</strong>を確認してください。土日・祝日は自動で休日になります。年間予定で「勤務日」になっている日は休日扱いになりません。</p>
          <p className="text-gray-700 font-medium mt-3">Q2. 保存すると「テーブルが見つかりません」と出る</p>
          <p className="text-gray-700 text-sm">データベース（Supabase）に<strong>allowances</strong>などのテーブルがまだない可能性があります。管理者に連絡し、テーブル作成（CREATE_ALL_TABLES.sql の実行）を依頼してください。</p>
          <p className="text-gray-700 font-medium mt-3">Q3. 入力した内容を直したい</p>
          <p className="text-gray-700 text-sm">いつでも編集・削除できます。該当する日付をカレンダーでクリックし、入力画面で修正して保存するか、履歴のゴミ箱アイコンで削除してください。</p>
          <p className="text-gray-700 font-medium mt-3">Q4. 複数日まとめて入力で、一部の日だけ内容を変えたい</p>
          <p className="text-gray-700 text-sm">まとめて入力したあと、<strong>変更したい日だけ</strong>カレンダーでその日をクリックし、1日分の入力画面で内容を修正して保存してください。</p>
          </ManualSection>

          <hr className="border-slate-200 my-8" />

          {/* 9. 画像挿入一覧 */}
          <ManualSection searchQuery={searchQuery} searchText="画像 図 挿入 一覧">
          <h3 className="text-lg font-bold text-gray-900 mt-8">9. 画像挿入一覧（まとめ）</h3>
          <p className="text-gray-700">マニュアル内で使用している画像の一覧です。</p>
          <div className="overflow-x-auto my-4">
            <table className="w-full border border-slate-200 text-sm">
              <thead>
                <tr className="bg-slate-100">
                  <th className="border border-slate-200 px-3 py-2 text-left">番号</th>
                  <th className="border border-slate-200 px-3 py-2 text-left">挿入場所（見出し）</th>
                  <th className="border border-slate-200 px-3 py-2 text-left">画像の内容</th>
                </tr>
              </thead>
              <tbody className="text-gray-700">
                <tr><td className="border border-slate-200 px-3 py-2">図1</td><td className="border border-slate-200 px-3 py-2">2. ログインの直後</td><td className="border border-slate-200 px-3 py-2">ログイン画面全体（メール・パスワード欄、ログインボタン）</td></tr>
                <tr><td className="border border-slate-200 px-3 py-2">図2</td><td className="border border-slate-200 px-3 py-2">3. トップ画面の直後</td><td className="border border-slate-200 px-3 py-2">トップ画面全体（月表示・支給予定額・ボタン類・カレンダー・手当履歴）</td></tr>
                <tr><td className="border border-slate-200 px-3 py-2">図3</td><td className="border border-slate-200 px-3 py-2">3.2 カレンダー上の表示の直後</td><td className="border border-slate-200 px-3 py-2">カレンダー部分の拡大（休日・勤務日・入力済み・今日の例）</td></tr>
                <tr><td className="border border-slate-200 px-3 py-2">図4</td><td className="border border-slate-200 px-3 py-2">4.1 入力の流れの直後</td><td className="border border-slate-200 px-3 py-2">手当入力モーダル全体（1日分の入力画面）</td></tr>
                <tr><td className="border border-slate-200 px-3 py-2">図5</td><td className="border border-slate-200 px-3 py-2">4.3 支給予定額と保存の直後</td><td className="border border-slate-200 px-3 py-2">入力画面の下部（計算内訳・支給予定額・保存ボタン）</td></tr>
                <tr><td className="border border-slate-200 px-3 py-2">図6</td><td className="border border-slate-200 px-3 py-2">5.1 手順の直後</td><td className="border border-slate-200 px-3 py-2">複数日選択モード（案内バー＋カレンダー）</td></tr>
              </tbody>
            </table>
          </div>

          <p className="text-gray-700 mt-6">以上が、特殊勤務手当管理アプリの仕様マニュアルです。</p>
          </ManualSection>

          {/* 検索中の説明 */}
          {searchQuery.trim() && (
            <p className="mt-6 text-center text-gray-500 text-sm" aria-live="polite">
              キーワード「{searchQuery.trim()}」に一致したセクションのみ表示しています。すべて表示するには検索窓を空にしてください。
            </p>
          )}
        </div>
      </article>
    </div>
  )
}
