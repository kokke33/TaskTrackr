# TaskTrackr AI詳細ログ機能 統合ガイド

山村さん、AI機能の詳細ログ実装が完了しました。このドキュメントでは、AI連携時の詳細ログ機能について説明します。

## 📊 ログ機能の概要

TaskTrackrのAI機能では、以下の詳細情報をログとして記録できます：

### ログ記録内容
- **AIプロバイダー情報**：OpenAI または Ollama
- **リクエスト詳細**：送信データ、ヘッダー、エンドポイント
- **応答詳細**：受信データ、ステータス、所要時間
- **ユーザー情報**：ユーザーID（ログイン時）
- **パフォーマンス情報**：処理時間、トークン使用量
- **エラー情報**：詳細なエラーメッセージとスタック

### セキュリティ機能
- **APIキーマスキング**：センシティブ情報の自動マスキング
- **設定可能なログレベル**：DEBUG、INFO、WARN、ERROR
- **プライバシー保護**：個人情報の自動検出・マスキング

## ⚙️ 環境設定

`.env`ファイルに以下を追加してください：

```env
# AI Logging Configuration
AI_LOG_LEVEL=info                    # debug, info, warn, error
AI_LOG_CONSOLE=true                  # コンソール出力有効/無効
AI_LOG_FILE=false                    # ファイル出力有効/無効（将来対応）
AI_LOG_MASK_SENSITIVE=true           # センシティブ情報マスキング
```

### ログレベル説明

| レベル | 出力内容 |
|--------|----------|
| `debug` | すべてのログ（開発時推奨） |
| `info` | 基本的な処理ログ（本番推奨） |
| `warn` | 警告レベル以上 |
| `error` | エラーのみ |

## 📝 ログ出力例

### 正常なOllama APIリクエスト

```
[2025-01-25T10:30:15.123Z] [INFO] [AI:ollama] [generateResponse] {
  "timestamp": "2025-01-25T10:30:15.123Z",
  "level": "info",
  "provider": "ollama",
  "operation": "generateResponse",
  "requestId": "req_1737879015123_abc123xyz",
  "userId": "yamakawa@tss.co.jp",
  "request": {
    "endpoint": "http://172.20.100.49:11434/api/generate",
    "method": "POST",
    "headers": {
      "Content-Type": "application/json"
    },
    "body": {
      "model": "llama2",
      "prompt": "<|system|>\nあなたは損害保険システム開発のプロジェクトマネージャーです...",
      "stream": false,
      "options": {
        "temperature": 0.7,
        "num_predict": 1000
      }
    },
    "size": 1456
  },
  "metadata": {
    "endpoint": "analyze-task",
    "userAgent": "Mozilla/5.0...",
    "ip": "192.168.1.100"
  }
}
```

### 応答ログ

```
[2025-01-25T10:30:17.456Z] [INFO] [AI:ollama] [generateResponse] {
  "timestamp": "2025-01-25T10:30:17.456Z",
  "level": "info",
  "provider": "ollama",
  "operation": "generateResponse",
  "requestId": "req_1737879015123_abc123xyz",
  "userId": "yamakawa@tss.co.jp",
  "response": {
    "status": 200,
    "headers": {},
    "body": {
      "model": "llama2",
      "content": "{\"priority\": \"high\", \"estimatedHours\": 8, \"tags\": [\"msad\", \"requirements\"]}",
      "done": true,
      "eval_count": 45,
      "prompt_eval_count": 312,
      "total_duration": 2334567890
    },
    "size": 234,
    "duration": 2333
  }
}
```

### APIキーマスキング例

```
[2025-01-25T10:30:15.123Z] [INFO] [AI:openai] [generateResponse] {
  "request": {
    "endpoint": "https://api.openai.com/v1/chat/completions",
    "headers": {
      "Authorization": "Bearer ***MASKED***",
      "Content-Type": "application/json"
    },
    "body": {
      "model": "gpt-3.5-turbo",
      "messages": [...]
    }
  }
}
```

## 🔧 実装された機能

### 1. リクエスト/レスポンストラッキング
- 各AI APIコールに一意のリクエストIDを付与
- 処理時間の正確な測定
- トークン使用量の記録

### 2. エラーハンドリング
- 詳細なエラー情報とスタックトレース
- フォールバック処理の記録
- ネットワークエラーの詳細

### 3. セキュリティ
- OpenAI APIキー（`sk-***`）の自動マスキング
- Authorization headerの自動マスキング
- その他センシティブキーワードの検出・マスキング

### 4. パフォーマンス分析
- AI応答時間の測定
- プロンプト/レスポンストークン数
- データサイズ情報

## 🔍 ログ分析とモニタリング

### 山村さんの業務での活用例

1. **プロジェクト別分析**
   ```bash
   # MSAD_NEC_共同損サ関連のAI使用状況確認
   grep "MSAD" /var/log/tasktrackr-ai.log | grep "analyzeTask"
   ```

2. **パフォーマンス監視**
   ```bash
   # 応答時間が5秒以上のケースを確認
   grep "duration.*[5-9][0-9][0-9][0-9]" /var/log/tasktrackr-ai.log
   ```

3. **エラー分析**
   ```bash
   # Ollama接続エラーの確認
   grep "ERROR" /var/log/tasktrackr-ai.log | grep "ollama"
   ```

## 🧪 動作確認・テスト方法

### 1. ログレベル変更テスト

```bash
# 環境変数を一時的に変更
export AI_LOG_LEVEL=debug

# サーバー再起動
npm run dev

# AIエンドポイントをテスト
curl -X POST http://localhost:3000/api/ai/analyze-task \
  -H "Content-Type: application/json" \
  -d '{"taskDescription": "MSAD_NEC_共同損サの要件定義書作成"}'
```

### 2. センシティブ情報マスキングテスト

```bash
# マスキング無効でテスト
export AI_LOG_MASK_SENSITIVE=false

# OpenAI APIキーがログに出力されることを確認（開発環境のみ）
curl -X POST http://localhost:3000/api/ai/status
```

### 3. パフォーマンス測定

```bash
# 処理時間とトークン使用量の確認
curl -X POST http://localhost:3000/api/ai/summarize \
  -H "Content-Type: application/json" \
  -d '{"text": "長いテキストサンプル..."}'

# ログでdurationとtokensを確認
```

## 🚨 トラブルシューティング

### ログが出力されない場合

1. **環境変数確認**
   ```bash
   echo $AI_LOG_LEVEL
   echo $AI_LOG_CONSOLE
   ```

2. **権限確認**
   ```bash
   # ログファイル出力時の権限確認
   ls -la /var/log/tasktrackr-ai.log
   ```

3. **設定再読み込み**
   ```bash
   # サーバー再起動
   npm run dev
   ```

### パフォーマンス問題

1. **ログレベル調整**
   - 本番環境では`AI_LOG_LEVEL=info`推奨
   - DEBUG出力は開発時のみ使用

2. **ログファイルローテーション**
   ```bash
   # ログファイルサイズ確認
   du -h /var/log/tasktrackr-ai.log
   ```

### Ollama接続エラー

1. **接続確認**
   ```bash
   curl http://172.20.100.49:11434/api/tags
   ```

2. **ログでエラー詳細確認**
   ```bash
   grep "Ollama API error" /var/log/tasktrackr-ai.log
   ```

## 📈 運用での活用

### 山村さんの管理業務での活用

1. **チーム生産性分析**
   - AI機能の使用頻度
   - 処理時間の傾向
   - エラー発生パターン

2. **コスト管理**
   - OpenAI APIの使用量監視
   - トークン消費量の分析

3. **品質管理**
   - AI分析結果の精度監視
   - フォールバック処理の発生頻度

### 推奨監視項目

- AI応答時間：平均5秒以下
- エラー率：1%以下
- トークン使用量：予算内収量
- Ollama稼働率：99%以上

これで山村さんのTaskTrackrシステムで、AI連携の完全な可視化と監視が可能になります！
