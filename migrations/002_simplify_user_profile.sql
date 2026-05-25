-- ========================================================================
-- 002 user_profiles を「氏名のみ」に単純化
-- ========================================================================
-- 旧版 (001_user_management.sql 初版) で last_name / first_name カラムを
-- 作っていた場合の片付け用。冪等なので何度実行しても安全。
-- ========================================================================

ALTER TABLE public.user_profiles DROP COLUMN IF EXISTS last_name;
ALTER TABLE public.user_profiles DROP COLUMN IF EXISTS first_name;

-- 確認:
--   SELECT column_name FROM information_schema.columns
--   WHERE table_schema = 'public' AND table_name = 'user_profiles'
--   ORDER BY ordinal_position;
