-- 週次報告パフォーマンス改善のためのインデックス追加
-- 実行日: 2025-05-28
-- 目的: /api/weekly-reportsエンドポイントの高速化

-- 1. 週次報告テーブルのcase_id用インデックス（JOIN最適化）
CREATE INDEX IF NOT EXISTS idx_weekly_reports_case_id 
  ON weekly_reports(case_id);

-- 2. 週次報告テーブルのreport_period_start用インデックス（ORDER BY最適化）
CREATE INDEX IF NOT EXISTS idx_weekly_reports_period_start 
  ON weekly_reports(report_period_start DESC);

-- 3. 週次報告テーブルのcreated_at用インデックス（作成日ソート最適化）
CREATE INDEX IF NOT EXISTS idx_weekly_reports_created_at 
  ON weekly_reports(created_at DESC);

-- 4. 案件テーブルのis_deleted用インデックス（WHERE条件最適化）
CREATE INDEX IF NOT EXISTS idx_cases_is_deleted 
  ON cases(is_deleted);

-- 5. 複合インデックス: case_idとis_deletedの組み合わせ（JOIN + WHERE最適化）
CREATE INDEX IF NOT EXISTS idx_weekly_reports_case_id_not_deleted 
  ON weekly_reports(case_id) 
  WHERE case_id IN (SELECT id FROM cases WHERE is_deleted = false);

-- インデックス作成完了確認用
SELECT 
  schemaname,
  tablename,
  indexname,
  indexdef
FROM pg_indexes 
WHERE tablename IN ('weekly_reports', 'cases')
  AND indexname LIKE 'idx_%'
ORDER BY tablename, indexname;
