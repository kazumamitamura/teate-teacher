-- ========================================
-- haguro-allowance-app 新規 Supabase プロジェクト用セットアップ
-- ========================================
-- 対象: 空のデータベース（allowance-app-simple 等）
-- 実行: Supabase Dashboard → SQL Editor でこのファイルを実行
-- ========================================

-- ========== A. User Profiles & Auth Trigger (安定版) ==========

CREATE TABLE IF NOT EXISTS public.user_profiles (
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT,
  display_name TEXT,
  avatar_url TEXT,
  department TEXT,
  position TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile" ON public.user_profiles FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own profile" ON public.user_profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own profile" ON public.user_profiles FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "System can insert profile" ON public.user_profiles FOR INSERT TO postgres WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.user_profiles (user_id, email, display_name, avatar_url)
  VALUES (new.id, new.email, COALESCE(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)), new.raw_user_meta_data->>'avatar_url');
  RETURN new;
EXCEPTION WHEN OTHERS THEN RETURN new; END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE INDEX IF NOT EXISTS idx_user_profiles_email ON public.user_profiles(email);

-- updated_at 自動更新
CREATE OR REPLACE FUNCTION update_user_profiles_updated_at() RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = timezone('utc'::text, now()); RETURN NEW; END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS update_user_profiles_updated_at_trigger ON public.user_profiles;
CREATE TRIGGER update_user_profiles_updated_at_trigger BEFORE UPDATE ON public.user_profiles FOR EACH ROW EXECUTE FUNCTION update_user_profiles_updated_at();


-- ========== B. allowances ==========

CREATE TABLE IF NOT EXISTS public.allowances (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_email TEXT,
  date DATE NOT NULL,
  activity_type TEXT NOT NULL,
  amount INTEGER NOT NULL DEFAULT 0,
  destination_type TEXT,
  destination_detail TEXT,
  is_driving BOOLEAN NOT NULL DEFAULT false,
  is_accommodation BOOLEAN NOT NULL DEFAULT false,
  custom_amount INTEGER,
  custom_description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, date)
);

CREATE INDEX IF NOT EXISTS idx_allowances_user_id ON public.allowances(user_id);
CREATE INDEX IF NOT EXISTS idx_allowances_date ON public.allowances(date);
CREATE INDEX IF NOT EXISTS idx_allowances_user_date ON public.allowances(user_id, date);

ALTER TABLE public.allowances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own allowances" ON public.allowances FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own allowances" ON public.allowances FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own allowances" ON public.allowances FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete their own allowances" ON public.allowances FOR DELETE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can view all allowances" ON public.allowances;
CREATE POLICY "Admins can view all allowances" ON public.allowances FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.user_profiles up WHERE up.user_id = auth.uid() AND up.email IN ('mitamuraka@haguroko.ed.jp', 'tomonoem@haguroko.ed.jp')));


-- ========== C. monthly_applications ==========

CREATE TABLE IF NOT EXISTS public.monthly_applications (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_email TEXT,
  year_month TEXT NOT NULL,
  application_type TEXT NOT NULL DEFAULT 'allowance',
  status TEXT NOT NULL DEFAULT 'draft',
  submitted_at TIMESTAMPTZ,
  approver_id UUID REFERENCES auth.users(id),
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, year_month, application_type)
);

CREATE INDEX IF NOT EXISTS idx_monthly_applications_user_id ON public.monthly_applications(user_id);
CREATE INDEX IF NOT EXISTS idx_monthly_applications_year_month ON public.monthly_applications(year_month);
CREATE INDEX IF NOT EXISTS idx_monthly_applications_status ON public.monthly_applications(status);
CREATE INDEX IF NOT EXISTS idx_monthly_applications_user_year_month ON public.monthly_applications(user_id, year_month);

ALTER TABLE public.monthly_applications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own monthly applications" ON public.monthly_applications FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own monthly applications" ON public.monthly_applications FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own monthly applications" ON public.monthly_applications FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete their own monthly applications" ON public.monthly_applications FOR DELETE USING (auth.uid() = user_id);

-- 管理者ポリシーは migrations/001, 003 で role ベースに設定


-- ========== D. documents ==========

CREATE TABLE IF NOT EXISTS public.documents (
  id BIGSERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  file_path TEXT NOT NULL UNIQUE,
  file_name TEXT NOT NULL,
  file_size BIGINT NOT NULL,
  uploaded_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_documents_created_at ON public.documents(created_at DESC);

ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view documents" ON public.documents FOR SELECT USING (auth.role() = 'authenticated');
-- 管理者ポリシーは migrations/003 で追加


-- ========== E. annual_schedules ==========

CREATE TABLE IF NOT EXISTS public.annual_schedules (
  id BIGSERIAL PRIMARY KEY,
  date DATE NOT NULL UNIQUE,
  work_type TEXT NOT NULL,
  event_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_annual_schedules_date ON public.annual_schedules(date);

ALTER TABLE public.annual_schedules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view annual schedules" ON public.annual_schedules FOR SELECT USING (auth.role() = 'authenticated');
-- 管理者ポリシーは migrations/003 で追加


-- ========== F. allowance_types ==========

CREATE TABLE IF NOT EXISTS public.allowance_types (
  id BIGSERIAL PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  base_amount INTEGER NOT NULL DEFAULT 0,
  requires_holiday BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_allowance_types_code ON public.allowance_types(code);

ALTER TABLE public.allowance_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view allowance_types" ON public.allowance_types FOR SELECT USING (auth.role() = 'authenticated');
-- 管理者ポリシーは migrations/003 で追加


-- ========== G. school_calendar (オプション・アプリで参照あり) ==========

CREATE TABLE IF NOT EXISTS public.school_calendar (
  id BIGSERIAL PRIMARY KEY,
  date DATE NOT NULL,
  day_type TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_school_calendar_date ON public.school_calendar(date);

ALTER TABLE public.school_calendar ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view school_calendar" ON public.school_calendar FOR SELECT USING (auth.role() = 'authenticated');


-- ========== H. updated_at 共通トリガー ==========

CREATE OR REPLACE FUNCTION update_updated_at_column() RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_allowances_updated_at ON public.allowances;
CREATE TRIGGER update_allowances_updated_at BEFORE UPDATE ON public.allowances FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_monthly_applications_updated_at ON public.monthly_applications;
CREATE TRIGGER update_monthly_applications_updated_at BEFORE UPDATE ON public.monthly_applications FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_annual_schedules_updated_at_trigger ON public.annual_schedules;
CREATE TRIGGER update_annual_schedules_updated_at_trigger BEFORE UPDATE ON public.annual_schedules FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_allowance_types_updated_at ON public.allowance_types;
CREATE TRIGGER update_allowance_types_updated_at BEFORE UPDATE ON public.allowance_types FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- ========== I. 既存 auth.users の user_profiles 補完 ==========

INSERT INTO public.user_profiles (user_id, email, display_name, avatar_url)
SELECT u.id, u.email, COALESCE(u.raw_user_meta_data->>'full_name', split_part(u.email, '@', 1)), u.raw_user_meta_data->>'avatar_url'
FROM auth.users u
WHERE NOT EXISTS (SELECT 1 FROM public.user_profiles p WHERE p.user_id = u.id)
ON CONFLICT (user_id) DO NOTHING;


-- ========== 完了 ==========
-- 続けて migrations/ 内の SQL を順番に実行してください（docs/SETUP.md 参照）。
-- Storage バケット "documents" は Dashboard から手動作成してください。
