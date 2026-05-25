-- ========================================================================
-- 004 コアテーブル（無い場合のみ作成）
-- ========================================================================
-- setup.sql をまだ実行していない、または一部だけ作成した場合に実行。
-- 既にあるテーブルは IF NOT EXISTS でスキップされます。
-- ========================================================================

-- 手当入力
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

ALTER TABLE public.allowances ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own allowances" ON public.allowances;
CREATE POLICY "Users can view their own allowances" ON public.allowances
  FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can insert their own allowances" ON public.allowances;
CREATE POLICY "Users can insert their own allowances" ON public.allowances
  FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can update their own allowances" ON public.allowances;
CREATE POLICY "Users can update their own allowances" ON public.allowances
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can delete their own allowances" ON public.allowances;
CREATE POLICY "Users can delete their own allowances" ON public.allowances
  FOR DELETE USING (auth.uid() = user_id);

-- 月次申請ステータス（アプリが実際に使用）
CREATE TABLE IF NOT EXISTS public.allowance_monthly_statuses (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  target_month TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'SUBMITTED', 'APPROVED')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, target_month)
);

ALTER TABLE public.allowance_monthly_statuses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own monthly status" ON public.allowance_monthly_statuses;
CREATE POLICY "Users can manage own monthly status" ON public.allowance_monthly_statuses
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 年間勤務表
CREATE TABLE IF NOT EXISTS public.annual_schedules (
  id BIGSERIAL PRIMARY KEY,
  date DATE NOT NULL UNIQUE,
  work_type TEXT NOT NULL,
  event_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.annual_schedules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view annual schedules" ON public.annual_schedules;
CREATE POLICY "Anyone can view annual schedules" ON public.annual_schedules
  FOR SELECT USING (auth.role() = 'authenticated');

-- 手当マスタ
CREATE TABLE IF NOT EXISTS public.allowance_types (
  id BIGSERIAL PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  base_amount INTEGER NOT NULL DEFAULT 0,
  requires_holiday BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.allowance_types ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated can view allowance_types" ON public.allowance_types;
CREATE POLICY "Authenticated can view allowance_types" ON public.allowance_types
  FOR SELECT USING (auth.role() = 'authenticated');

-- 規約 PDF
CREATE TABLE IF NOT EXISTS public.documents (
  id BIGSERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  file_path TEXT NOT NULL UNIQUE,
  file_name TEXT NOT NULL,
  file_size BIGINT NOT NULL,
  uploaded_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can view documents" ON public.documents;
CREATE POLICY "Authenticated users can view documents" ON public.documents
  FOR SELECT USING (auth.role() = 'authenticated');
