-- ========================================================================
-- 003 管理者判定をメール固定から role カラムへ統一
-- ========================================================================
-- migrations/001 を先に実行していること。
-- テーブルが無い場合はその部分をスキップ（setup.sql 未実行でもエラーにならない）。
-- ========================================================================

CREATE OR REPLACE FUNCTION public.is_admin_user()
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE user_id = auth.uid() AND role IN ('admin', 'super_admin')
  );
$$;
GRANT EXECUTE ON FUNCTION public.is_admin_user() TO authenticated;

-- user_profiles
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'user_profiles'
  ) THEN
    DROP POLICY IF EXISTS "Admins can view all profiles" ON public.user_profiles;
  END IF;
END $$;

-- monthly_applications（setup.sql 実行時のみ・現行アプリは allowance_monthly_statuses を使用）
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'monthly_applications'
  ) THEN
    DROP POLICY IF EXISTS "Admins can view all monthly applications" ON public.monthly_applications;
    CREATE POLICY "Admins can view all monthly applications" ON public.monthly_applications
      FOR SELECT USING (public.is_admin_user());
  END IF;
END $$;

-- allowance_monthly_statuses（月次申請・承認用）
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'allowance_monthly_statuses'
  ) THEN
    DROP POLICY IF EXISTS "Admins can manage allowance monthly statuses" ON public.allowance_monthly_statuses;
    CREATE POLICY "Admins can manage allowance monthly statuses" ON public.allowance_monthly_statuses
      FOR ALL USING (public.is_admin_user()) WITH CHECK (public.is_admin_user());
  END IF;
END $$;

-- documents
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'documents'
  ) THEN
    DROP POLICY IF EXISTS "Admins can insert documents" ON public.documents;
    DROP POLICY IF EXISTS "Admins can delete documents" ON public.documents;
    CREATE POLICY "Admins can insert documents" ON public.documents
      FOR INSERT WITH CHECK (public.is_admin_user());
    CREATE POLICY "Admins can delete documents" ON public.documents
      FOR DELETE USING (public.is_admin_user());
  END IF;
END $$;

-- annual_schedules
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'annual_schedules'
  ) THEN
    DROP POLICY IF EXISTS "Admins can manage annual schedules" ON public.annual_schedules;
    CREATE POLICY "Admins can manage annual schedules" ON public.annual_schedules
      FOR ALL USING (public.is_admin_user()) WITH CHECK (public.is_admin_user());
  END IF;
END $$;

-- allowance_types
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'allowance_types'
  ) THEN
    DROP POLICY IF EXISTS "Admins can manage allowance_types" ON public.allowance_types;
    CREATE POLICY "Admins can manage allowance_types" ON public.allowance_types
      FOR ALL USING (public.is_admin_user()) WITH CHECK (public.is_admin_user());
  END IF;
END $$;

-- allowances（全員分の閲覧・管理が必要な場合）
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'allowances'
  ) THEN
    DROP POLICY IF EXISTS "Admins can view all allowances" ON public.allowances;
    CREATE POLICY "Admins can view all allowances" ON public.allowances
      FOR SELECT USING (public.is_admin_user());
  END IF;
END $$;
