-- システム設定テーブルの作成
CREATE TABLE IF NOT EXISTS system_settings (
  id SERIAL PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,
  value TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- 初期データの投入
INSERT INTO system_settings (key, value, description) VALUES
  ('AI_PROVIDER', 'openai', 'AIサービスプロバイダー (openai, ollama, gemini, groq)')
ON CONFLICT (key) DO NOTHING;