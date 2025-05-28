-- マネージャ定例議事録テーブルの作成
CREATE TABLE IF NOT EXISTS manager_meetings (
  id SERIAL PRIMARY KEY,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  meeting_date DATE NOT NULL,
  year_month TEXT NOT NULL,
  title TEXT NOT NULL,
  agenda TEXT,
  content TEXT,
  attendees TEXT,
  action_items TEXT,
  next_meeting_date DATE,
  remarks TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- インデックス作成
CREATE INDEX idx_manager_meetings_project_year_month ON manager_meetings(project_id, year_month);
CREATE INDEX idx_manager_meetings_date ON manager_meetings(meeting_date);

-- 更新時のタイムスタンプ自動更新のトリガー
CREATE OR REPLACE FUNCTION update_manager_meetings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER manager_meetings_updated_at_trigger
  BEFORE UPDATE ON manager_meetings
  FOR EACH ROW
  EXECUTE FUNCTION update_manager_meetings_updated_at();
