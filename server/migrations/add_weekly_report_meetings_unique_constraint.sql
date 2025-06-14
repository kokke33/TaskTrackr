-- WeeklyReportMeetingテーブルのweeklyReportIdにユニーク制約を追加
-- 同一週次報告に対して複数の議事録が存在する場合は、最新のもの以外を削除してからユニーク制約を追加

-- 1. 重複レコードがある場合、最新のもの以外を削除
WITH ranked_meetings AS (
  SELECT id, 
         weekly_report_id,
         ROW_NUMBER() OVER (PARTITION BY weekly_report_id ORDER BY created_at DESC) as rn
  FROM weekly_report_meetings
)
DELETE FROM weekly_report_meetings 
WHERE id IN (
  SELECT id FROM ranked_meetings WHERE rn > 1
);

-- 2. weekly_report_idにユニーク制約を追加
ALTER TABLE weekly_report_meetings 
ADD CONSTRAINT uk_weekly_report_meetings_weekly_report_id 
UNIQUE (weekly_report_id);

-- 3. 制約追加後のインデックス確認用コメント
-- インデックスは自動的に作成されるため、手動追加は不要