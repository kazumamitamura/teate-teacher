-- ========================================================================
-- 001 ユーザー管理マイグレーション
-- ========================================================================
-- 新しい Supabase プロジェクトの SQL Editor で 1 度だけ実行してください。
-- ・user_profiles テーブル（無ければ作成、あれば不足カラム追加）
-- ・role カラム（user / admin / super_admin）
-- ・user_id NULL 許容（CSV 事前登録のため）
-- ・初回 Google ログイン時のプロフィール連携 RPC
-- ・RLS（一般 = 自分行のみ更新、admin/super_admin = 全行 CRUD）
-- ・bootstrap: mitamuraka@haguroko.ed.jp を super_admin に
-- ========================================================================

-- 1) テーブル本体
CREATE TABLE IF NOT EXISTS public.user_profiles (
  id           BIGSERIAL PRIMARY KEY,
  user_id      UUID UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  email        TEXT NOT NULL,
  display_name TEXT NOT NULL DEFAULT '',
  role         TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user','admin','super_admin')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2) 既存テーブルにカラムが無ければ追加（冪等）
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'user';
ALTER TABLE public.user_profiles ALTER COLUMN user_id DROP NOT NULL;

-- role CHECK 制約（無ければ追加）
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'user_profiles_role_chk'
  ) THEN
    ALTER TABLE public.user_profiles
      ADD CONSTRAINT user_profiles_role_chk CHECK (role IN ('user','admin','super_admin'));
  END IF;
END $$;

-- 3) email ユニーク（小文字運用前提）
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND indexname = 'user_profiles_email_unique'
  ) THEN
    CREATE UNIQUE INDEX user_profiles_email_unique ON public.user_profiles (email);
  END IF;
END $$;

-- 4) updated_at 自動更新
CREATE OR REPLACE FUNCTION public.tg_user_profiles_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_user_profiles_updated_at ON public.user_profiles;
CREATE TRIGGER trg_user_profiles_updated_at
  BEFORE UPDATE ON public.user_profiles
  FOR EACH ROW EXECUTE FUNCTION public.tg_user_profiles_updated_at();

-- 5) 現在ユーザーのロール取得（SECURITY DEFINER で RLS をバイパス）
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS TEXT
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT role FROM public.user_profiles WHERE user_id = auth.uid() LIMIT 1;
$$;
GRANT EXECUTE ON FUNCTION public.current_user_role() TO authenticated;

-- 6) ログイン時にプロフィールを連携／作成する RPC
--    ・事前登録行 (user_id IS NULL) があれば user_id を紐付け
--    ・無ければ role='user' で新規作成
--    ・自分のメールしか紐付け／作成できない（なりすまし防止）
CREATE OR REPLACE FUNCTION public.link_user_profile(
  p_email        TEXT,
  p_display_name TEXT
)
RETURNS public.user_profiles
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_uid   UUID := auth.uid();
  v_email TEXT := LOWER(p_email);
  v_row   public.user_profiles;
  v_auth_email TEXT;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT LOWER(email) INTO v_auth_email FROM auth.users WHERE id = v_uid;
  IF v_auth_email IS DISTINCT FROM v_email THEN
    RAISE EXCEPTION 'Email mismatch';
  END IF;

  SELECT * INTO v_row FROM public.user_profiles WHERE LOWER(email) = v_email LIMIT 1;

  IF FOUND THEN
    IF v_row.user_id IS NULL THEN
      UPDATE public.user_profiles
      SET user_id      = v_uid,
          display_name = CASE WHEN COALESCE(v_row.display_name,'') = ''
                              THEN p_display_name
                              ELSE v_row.display_name END
      WHERE id = v_row.id
      RETURNING * INTO v_row;
    END IF;
  ELSE
    INSERT INTO public.user_profiles (user_id, email, display_name, role)
    VALUES (v_uid, v_email, p_display_name, 'user')
    RETURNING * INTO v_row;
  END IF;

  RETURN v_row;
END $$;
GRANT EXECUTE ON FUNCTION public.link_user_profile(TEXT, TEXT) TO authenticated;

-- 7) RLS
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS user_profiles_select_authenticated ON public.user_profiles;
CREATE POLICY user_profiles_select_authenticated ON public.user_profiles
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS user_profiles_update_own ON public.user_profiles;
CREATE POLICY user_profiles_update_own ON public.user_profiles
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid() AND role = (SELECT role FROM public.user_profiles WHERE user_id = auth.uid()));

-- admin/super_admin は全行 CRUD
DROP POLICY IF EXISTS user_profiles_admin_all ON public.user_profiles;
CREATE POLICY user_profiles_admin_all ON public.user_profiles
  FOR ALL TO authenticated
  USING (public.current_user_role() IN ('admin','super_admin'))
  WITH CHECK (public.current_user_role() IN ('admin','super_admin'));

-- 8) 最初のスーパー管理者（プロジェクト所有者）を投入
INSERT INTO public.user_profiles (email, display_name, role)
VALUES ('mitamuraka@haguroko.ed.jp', '三田村 和真', 'super_admin')
ON CONFLICT (email) DO UPDATE SET role = 'super_admin';

-- ========================================================================
-- 実行後の確認用クエリ:
--   SELECT id, email, display_name, role, user_id FROM public.user_profiles;
-- ========================================================================
