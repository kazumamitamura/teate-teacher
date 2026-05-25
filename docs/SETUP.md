# セットアップ手順

## 1. 環境変数（`.env.local` / Vercel）

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
NEXT_PUBLIC_ALLOWED_EMAIL_DOMAIN=haguroko.ed.jp
NEXT_PUBLIC_SITE_URL=https://teate-teacher.vercel.app
```

`NEXT_PUBLIC_SUPABASE_URL` に `/rest/v1/` を付けないこと。

## 2. Supabase（新規プロジェクト）

SQL Editor で **この順番** に実行:

| 順番 | ファイル | 説明 |
|------|----------|------|
| 1 | `migrations/004_core_tables_if_missing.sql` | 手当・月次ステータス等（空DB向け） |
| 2 | `migrations/001_user_management.sql` | ユーザー管理・ロール |
| 3 | `migrations/002_simplify_user_profile.sql` | 氏名カラム整理 |
| 4 | `migrations/003_admin_rls_by_role.sql` | 管理者RLS（roleベース） |

**または** まとめて `setup.sql` を実行した場合も、上記 001〜003 は引き続き実行してください。

`003` で `monthly_applications does not exist` と出た場合 → 修正済みの `003` を再実行するか、先に `004` を実行してください。

## 3. Supabase 認証設定

- **Authentication → Providers → Google** を有効化
- **Authentication → URL Configuration**
  - Site URL: 本番URL
  - Redirect URLs: `https://<your-domain>/auth/callback`

## 4. Storage（規約 PDF 用・任意）

Storage でバケット `documents` を作成。

## 5. 初回ユーザー

1. Google でログイン（`@haguroko.ed.jp`）
2. `/admin/users` で教員を CSV 登録
3. 必要な人を **管理者 (admin)** に変更（スーパー管理者のみ）

## プロジェクト構成（修正するとき）

```
app/              … 画面・API
  admin/          … 管理画面
  auth/           … Google ログイン
utils/
  userProfile.ts  … ロール判定
  useRequireAdmin.ts … 管理画面の認証
migrations/       … DB マイグレーション
setup.sql         … 初回テーブル作成
docs/SETUP.md     … このファイル
```
