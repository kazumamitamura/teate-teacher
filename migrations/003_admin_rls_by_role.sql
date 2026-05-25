-- ========================================================================
-- 003 管理者判定をメール固定から role カラムへ統一
-- ========================================================================
-- setup.sql 実行済みで「mitamuraka@...」固定の RLS が残っている場合に実行。
-- migrations/001 を先に実行していること。
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

-- user_profiles: 旧メール固定ポリシーを削除
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.user_profiles;

-- monthly_applications
DROP POLICY IF EXISTS "Admins can view all monthly applications" ON public.monthly_applications;
CREATE POLICY "Admins can view all monthly applications" ON public.monthly_applications
  FOR SELECT USING (public.is_admin_user());

-- documents
DROP POLICY IF EXISTS "Admins can insert documents" ON public.documents;
DROP POLICY IF EXISTS "Admins can delete documents" ON public.documents;
CREATE POLICY "Admins can insert documents" ON public.documents
  FOR INSERT WITH CHECK (public.is_admin_user());
CREATE POLICY "Admins can delete documents" ON public.documents
  FOR DELETE USING (public.is_admin_user());

-- annual_schedules
DROP POLICY IF EXISTS "Admins can manage annual schedules" ON public.annual_schedules;
CREATE POLICY "Admins can manage annual schedules" ON public.annual_schedules
  FOR ALL USING (public.is_admin_user()) WITH CHECK (public.is_admin_user());

-- allowance_types
DROP POLICY IF EXISTS "Admins can manage allowance_types" ON public.allowance_types;
CREATE POLICY "Admins can manage allowance_types" ON public.allowance_types
  FOR ALL USING (public.is_admin_user()) WITH CHECK (public.is_admin_user());
