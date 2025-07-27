# TaskTrackr API ドキュメント

## 📚 目次
1. [概要](#概要)
2. [認証](#認証)
3. [共通仕様](#共通仕様)
4. [認証エンドポイント](#認証エンドポイント)
5. [プロジェクト管理API](#プロジェクト管理api)
6. [案件管理API](#案件管理api)
7. [週次レポートAPI](#週次レポートapi)
8. [会議議事録API](#会議議事録api)
9. [ユーザー管理API](#ユーザー管理api)
10. [システム設定API](#システム設定api)
11. [AI機能API](#ai機能api)
12. [検索API](#検索api)
13. [エラーレスポンス](#エラーレスポンス)

---

## 概要

TaskTrackr APIは、プロジェクト・案件・週次レポートの管理とAI機能を提供するRESTful APIです。

**ベースURL**: `http://localhost:5000/api`

**技術仕様**:
- REST API
- JSON形式のリクエスト/レスポンス
- セッションベース認証
- Passport.js認証フレームワーク
- Drizzle ORMによるデータベース操作

---

## 認証

### セッションベース認証
- Cookieベースのセッション管理
- ログイン後、セッションCookieが自動設定
- 全ての保護されたエンドポイントで認証チェック

### 権限レベル
- **一般ユーザー**: 基本的な閲覧・編集権限
- **管理者**: すべての機能にアクセス可能

---

## 共通仕様

### HTTPステータスコード
- `200` - 成功
- `201` - 作成成功
- `400` - リクエストエラー
- `401` - 認証が必要
- `403` - 権限不足
- `404` - リソースが見つからない
- `409` - 競合エラー
- `500` - サーバーエラー

### 共通レスポンスヘッダー
```
Content-Type: application/json
Set-Cookie: connect.sid=... (認証後)
```

---

## 認証エンドポイント

### POST /api/auth/login
ユーザーログイン

**リクエスト**:
```json
{
  "username": "admin",
  "password": "password"
}
```

**レスポンス**:
```json
{
  "user": {
    "id": 1,
    "username": "admin",
    "isAdmin": true
  }
}
```

### POST /api/auth/logout
ユーザーログアウト

**レスポンス**:
```json
{
  "success": true
}
```

### GET /api/check-auth
認証状態確認

**レスポンス**:
```json
{
  "user": {
    "id": 1,
    "username": "admin",
    "isAdmin": true
  }
}
```

---

## プロジェクト管理API

### GET /api/projects
プロジェクト一覧取得

**クエリパラメータ**:
- `limit` (optional): 取得件数制限
- `lightweight` (optional): 軽量版（必要最小限のフィールドのみ）

**レスポンス**:
```json
[
  {
    "id": 1,
    "name": "プロジェクト名",
    "overview": "概要",
    "organization": "組織名",
    "personnel": "要員情報",
    "progress": "進捗状況",
    "businessDetails": "業務詳細",
    "issues": "課題",
    "documents": "ドキュメント",
    "handoverNotes": "引き継ぎ事項",
    "remarks": "備考",
    "isDeleted": false,
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z"
  }
]
```

### POST /api/projects
プロジェクト作成

**リクエスト**:
```json
{
  "name": "新規プロジェクト",
  "overview": "プロジェクト概要",
  "organization": "組織名",
  "personnel": "要員構成",
  "progress": "進捗状況",
  "businessDetails": "業務詳細",
  "issues": "課題",
  "documents": "関連ドキュメント",
  "handoverNotes": "引き継ぎ事項",
  "remarks": "備考"
}
```

### GET /api/projects/:id
特定プロジェクト取得

### PUT /api/projects/:id
プロジェクト更新

### DELETE /api/projects/:id
プロジェクト削除（ソフト削除）

---

## 案件管理API

### GET /api/cases
案件一覧取得

**クエリパラメータ**:
- `limit` (optional): 取得件数制限（デフォルト: 20）
- `lightweight` (optional): 軽量版フラグ

**レスポンス**:
```json
[
  {
    "id": 1,
    "projectName": "プロジェクト名",
    "caseName": "案件名",
    "description": "案件説明",
    "milestone": "マイルストーン",
    "includeProgressAnalysis": true,
    "isDeleted": false,
    "createdAt": "2024-01-01T00:00:00.000Z"
  }
]
```

### POST /api/cases
案件作成

### GET /api/cases/:id
特定案件取得

### PUT /api/cases/:id
案件更新

### DELETE /api/cases/:id
案件削除（ソフト削除）

---

## 週次レポートAPI

### GET /api/weekly-reports
週次レポート一覧取得

**クエリパラメータ**:
- `caseId` (optional): 案件IDでフィルタリング
- `limit` (optional): 取得件数制限

**レスポンス**:
```json
[
  {
    "id": 1,
    "caseId": 1,
    "weekStartDate": "2024-01-01",
    "progressSummary": "進捗概要",
    "tasksCompleted": "完了タスク",
    "tasksInProgress": "進行中タスク",
    "tasksPlanned": "予定タスク",
    "challenges": "課題",
    "achievements": "成果",
    "nextWeekPlan": "来週の計画",
    "clientCommunication": "クライアント連絡",
    "riskAssessment": "リスク評価",
    "qualityMetrics": "品質指標",
    "resourceUtilization": "リソース活用",
    "stakeholderFeedback": "ステークホルダーFB",
    "lessonsLearned": "学んだ教訓",
    "improvementActions": "改善アクション",
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z",
    "createdBy": 1
  }
]
```

### POST /api/weekly-reports
週次レポート作成

### GET /api/weekly-reports/:id
特定週次レポート取得

### PUT /api/weekly-reports/:id
週次レポート更新

**特殊機能**:
- 自動保存機能（デバウンス）
- AI分析自動実行
- 管理者編集時の並列AI処理

### DELETE /api/weekly-reports/:id
週次レポート削除

### GET /api/weekly-reports/previous/:caseId
前回レポート取得

**説明**: 指定案件の最新レポートを取得（履歴比較用）

### POST /api/weekly-reports/:id/regenerate-admin-email
管理者確認メール再生成

---

## 会議議事録API

### GET /api/manager-meetings
管理者会議一覧取得

### POST /api/manager-meetings
管理者会議作成

### GET /api/weekly-report-meetings/:reportId
週次レポート会議取得

### POST /api/weekly-report-meetings
週次レポート会議作成

---

## ユーザー管理API

### GET /api/users
ユーザー一覧取得（管理者権限必要）

**レスポンス**:
```json
[
  {
    "id": 1,
    "username": "admin",
    "isAdmin": true,
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z"
  }
]
```

### POST /api/users
ユーザー作成（管理者権限必要）

### PUT /api/users/:id
ユーザー更新（管理者権限必要）

### DELETE /api/users/:id
ユーザー削除（管理者権限必要）

---

## システム設定API

### GET /api/system-settings
システム設定取得

**レスポンス**:
```json
{
  "REALTIME_PROVIDER": "gemini",
  "AI_LOG_LEVEL": "info",
  "AI_LOG_CONSOLE": "true"
}
```

### POST /api/system-settings
システム設定更新（管理者権限必要）

**リクエスト**:
```json
{
  "key": "REALTIME_PROVIDER",
  "value": "openai"
}
```

---

## AI機能API

### POST /ai/summarize
テキスト要約・分析

**リクエスト**:
```json
{
  "text": "分析対象のテキスト",
  "type": "summary",
  "context": "追加コンテキスト"
}
```

**レスポンス**:
```json
{
  "analysis": "AI分析結果",
  "suggestions": ["改善提案1", "改善提案2"],
  "summary": "要約文"
}
```

### POST /ai/chat
AI チャット

**リクエスト**:
```json
{
  "messages": [
    {
      "role": "user",
      "content": "質問内容"
    }
  ]
}
```

### POST /ai/stream
ストリーミングAI応答

**説明**: リアルタイムでAI応答をストリーミング
**対応プロバイダー**: Gemini, OpenAI

---

## 検索API

### GET /api/search
全文検索

**クエリパラメータ**:
- `q`: 検索クエリ（必須）
- `limit`: 結果件数制限（デフォルト: 20）

**レスポンス**:
```json
{
  "projects": [
    {
      "id": 1,
      "name": "検索にマッチしたプロジェクト",
      "overview": "概要..."
    }
  ],
  "cases": [
    {
      "id": 1,
      "projectName": "プロジェクト名",
      "caseName": "案件名",
      "description": "説明..."
    }
  ],
  "weeklyReports": [
    {
      "id": 1,
      "caseId": 1,
      "progressSummary": "検索にマッチした内容..."
    }
  ]
}
```

---

## エラーレスポンス

### 標準エラー形式
```json
{
  "error": "エラーメッセージ",
  "code": "ERROR_CODE",
  "details": "詳細情報（任意）"
}
```

### 一般的なエラー

#### 401 Unauthorized
```json
{
  "error": "認証が必要です"
}
```

#### 403 Forbidden
```json
{
  "error": "管理者権限が必要です"
}
```

#### 404 Not Found
```json
{
  "error": "リソースが見つかりません"
}
```

#### 409 Conflict（楽観ロック）
```json
{
  "error": "データが他のユーザーによって更新されています",
  "code": "OPTIMISTIC_LOCK_ERROR"
}
```

#### 500 Internal Server Error
```json
{
  "error": "内部サーバーエラー",
  "details": "具体的なエラー内容"
}
```

---

## 使用例

### JavaScript/TypeScript クライアント例

```typescript
// 認証
const loginResponse = await fetch('/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ username: 'admin', password: 'password' }),
  credentials: 'include'
});

// プロジェクト一覧取得
const projectsResponse = await fetch('/api/projects?lightweight=true', {
  credentials: 'include'
});
const projects = await projectsResponse.json();

// 週次レポート作成
const reportResponse = await fetch('/api/weekly-reports', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    caseId: 1,
    weekStartDate: '2024-01-01',
    progressSummary: '進捗概要...'
  }),
  credentials: 'include'
});
```

### cURL例

```bash
# ログイン
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"password"}' \
  -c cookies.txt

# プロジェクト一覧取得
curl -X GET http://localhost:5000/api/projects \
  -b cookies.txt

# AI分析
curl -X POST http://localhost:5000/ai/summarize \
  -H "Content-Type: application/json" \
  -d '{"text":"分析対象テキスト","type":"summary"}' \
  -b cookies.txt
```

---

## 技術仕様詳細

### AIプロバイダー対応
- **OpenAI**: GPT-4o-mini, GPT-4など
- **Ollama**: ローカル大言語モデル
- **Google Gemini**: Gemini-2.5-Flash, Gemini-2.5-Pro
- **Groq**: Llama-3.3-70B-Versatile
- **OpenRouter**: Claude-3.5-Sonnet, 他多数

### パフォーマンス最適化
- 軽量版API（`lightweight=true`）
- React Query キャッシュ戦略
- 検索結果制限（20件）
- 並列AI処理
- データベースインデックス最適化

### セキュリティ機能
- セッションベース認証
- CSRF保護
- 入力値サニタイゼーション
- SQLインジェクション対策
- 管理者権限チェック

---

このAPIドキュメントは、TaskTrackrシステムの全機能を網羅しています。追加の質問や詳細については、開発チームまでお問い合わせください。