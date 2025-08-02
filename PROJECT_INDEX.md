# TaskTrackr プロジェクトインデックス

## 📋 プロジェクト概要

TaskTrackrは、プロジェクト管理と週次レポート作成を効率化するWebアプリケーションです。特にAI機能を活用した自動分析とレポート生成機能を特徴としています。

- **開発言語**: TypeScript (フルスタック)
- **アーキテクチャ**: React + Express統合型
- **AI統合**: 5つのプロバイダー対応（OpenAI, Ollama, Google Gemini, Groq, OpenRouter）
- **データベース**: PostgreSQL + Drizzle ORM
- **認証**: Passport.js セッションベース認証

## 🏗️ プロジェクト構造

```
TaskTrackr/
├── 📁 client/src/                    # Reactフロントエンド
│   ├── 📁 components/               # UIコンポーネント
│   │   ├── 📁 ui/                   # Shadcn/ui コンポーネント (48+)
│   │   ├── 📁 weekly-report/        # 週次レポート専用コンポーネント
│   │   └── 📄 *.tsx                 # 機能別コンポーネント
│   ├── 📁 pages/                    # ルートページコンポーネント
│   ├── 📁 hooks/                    # カスタムReactフック
│   ├── 📁 lib/                      # ユーティリティ・認証
│   └── 📁 contexts/                 # WebSocketコンテキスト
├── 📁 server/                       # Expressバックエンド
│   ├── 📄 routes.ts                 # メインAPIルート (60+ エンドポイント)
│   ├── 📄 ai-routes.ts              # AI専用ルート (10+ エンドポイント)
│   ├── 📄 storage.ts                # データベース操作層
│   ├── 📄 ai-service.ts             # AI抽象化サービス
│   ├── 📁 ai-providers/             # AI プロバイダー実装
│   ├── 📁 prompts/                  # AIプロンプトテンプレート
│   └── 📁 migrations/               # データベースマイグレーション
├── 📁 shared/                       # 共有TypeScript型定義
│   ├── 📄 schema.ts                 # Drizzle ORMスキーマ
│   └── 📄 *.ts                      # 共通型・定数・ユーティリティ
├── 📁 tests/                        # テストスイート (51件)
│   ├── 📁 unit/                     # ユニットテスト (26件)
│   ├── 📁 integration/              # 統合テスト (25件)
│   └── 📁 __fixtures__/             # テストデータ
└── 📁 .claude/                      # Claude Code 知識管理
    ├── 📄 context.md                # プロジェクトコンテキスト
    ├── 📄 project-knowledge.md      # 技術知識
    └── 📄 common-patterns.md        # 開発パターン
```

## 🛠️ 技術スタック

### フロントエンド技術
- **React 18.3.1** - UIライブラリ
- **TypeScript 5.6.3** - 型安全性
- **Vite 5.4.14** - ビルドツール・開発サーバー
- **TailwindCSS 3.4.14** - CSSフレームワーク
- **Wouter 3.3.5** - 軽量ルーティング
- **TanStack Query 5.60.5** - データフェッチング・キャッシュ
- **React Hook Form 7.53.1** - フォーム管理
- **Zod 3.23.8** - スキーマバリデーション

### UIコンポーネント
- **Shadcn/ui** - Radix UIベースのコンポーネントシステム (48+コンポーネント)
- **Lucide React** - アイコンライブラリ
- **Sonner** - トースト通知
- **React Day Picker** - 日付選択

### バックエンド技術
- **Express 4.21.2** - Webサーバーフレームワーク
- **Drizzle ORM 0.39.1** - TypeScript ORM
- **PostgreSQL** - リレーショナルデータベース
- **Passport.js** - 認証ライブラリ
- **Winston** - ログ管理
- **WebSocket (ws 8.18.0)** - リアルタイム通信

### AI統合
- **OpenAI SDK 4.96.2** - GPTモデル統合
- **Google Generative AI 0.24.1** - Geminiモデル統合
- **Groq SDK 0.26.0** - Groqモデル統合
- **カスタム実装** - Ollama, OpenRouter対応

### 開発・テストツール
- **Vitest 3.2.4** - テストフレームワーク
- **React Testing Library 16.3.0** - Reactコンポーネントテスト
- **MSW 2.10.4** - モックサービスワーカー
- **Happy DOM 18.0.1** - DOM環境
- **ESBuild 0.25.6** - 高速ビルド
- **Drizzle Kit 0.30.4** - データベースマイグレーション

## 📚 API エンドポイント

### 認証関連
```
POST /api/login          # ユーザーログイン
POST /api/logout         # ユーザーログアウト
GET  /api/check-auth     # 認証状態確認
```

### プロジェクト管理
```
GET    /api/projects              # プロジェクト一覧取得
POST   /api/projects              # 新規プロジェクト作成 [管理者]
GET    /api/projects/:id          # プロジェクト詳細取得
PUT    /api/projects/:id          # プロジェクト更新 [管理者]
DELETE /api/projects/:id          # プロジェクト削除 [管理者]
POST   /api/projects/:id/restore  # プロジェクト復元 [管理者]
GET    /api/projects/by-name/:name # プロジェクト名検索
```

### 案件管理
```
GET    /api/cases        # 案件一覧取得
POST   /api/cases        # 新規案件作成 [管理者]
GET    /api/cases/:id    # 案件詳細取得
PUT    /api/cases/:id    # 案件更新 [管理者]
PATCH  /api/cases/:id/milestone # マイルストーン更新
```

### 週次レポート
```
GET  /api/weekly-reports                    # レポート一覧
POST /api/weekly-reports                    # 新規レポート作成
GET  /api/weekly-reports/:id                # レポート詳細
PUT  /api/weekly-reports/:id                # レポート更新
DELETE /api/weekly-reports/:id              # レポート削除 [管理者]
GET  /api/weekly-reports/by-case/:caseId    # 案件別レポート
GET  /api/weekly-reports/latest/:projectName # 最新レポート
GET  /api/weekly-reports/previous/:caseId   # 前回レポート取得
POST /api/weekly-reports/:id/regenerate-admin-email # 管理者確認メール再生成
```

### 会議管理
```
GET  /api/manager-meetings                  # 管理者会議一覧
POST /api/manager-meetings                  # 新規会議作成
GET  /api/manager-meetings/:id              # 会議詳細
PUT  /api/manager-meetings/:id              # 会議更新
DELETE /api/manager-meetings/:id            # 会議削除

GET  /api/weekly-report-meetings            # 週次レポート会議一覧
POST /api/weekly-report-meetings            # 新規会議作成
PUT  /api/weekly-report-meetings/:id        # 会議更新
GET  /api/weekly-report-meetings/by-case/:caseId # 案件別会議
```

### AI機能
```
POST /api/ai/chat                    # AI チャット
POST /api/ai/summarize               # テキスト要約
POST /api/ai/analyze-task            # タスク分析
POST /api/ai/analyze-text            # テキスト分析
POST /api/ai/analyze-text-trial      # トライアル分析
POST /api/ai/conversation            # AI会話
POST /api/ai/analyze-text-stream     # ストリーミング分析
POST /api/chat/admin-email           # 管理者メール生成
GET  /api/ai/status                  # AIサービス状態
```

### システム設定
```
GET    /api/settings                # 設定一覧 [管理者]
GET    /api/settings/:key          # 設定取得 [管理者]
PUT    /api/settings/:key          # 設定更新 [管理者]
DELETE /api/settings/:key          # 設定削除 [管理者]

GET    /api/session-ai-settings    # セッションAI設定取得
PUT    /api/session-ai-settings    # セッションAI設定更新
DELETE /api/session-ai-settings    # セッションAI設定削除
```

### ユーザー管理
```
GET    /api/users        # ユーザー一覧 [管理者]
POST   /api/users        # 新規ユーザー作成 [管理者]
PUT    /api/users/:id    # ユーザー更新 [管理者]
DELETE /api/users/:id    # ユーザー削除 [管理者]
```

### 検索・その他
```
GET /api/search              # 全文検索
GET /api/search/suggest      # 検索候補
GET /api/recent-reports      # 最近のレポート
GET /api/monthly-summary/:projectName        # 月次サマリー
GET /api/monthly-summary-input/:projectName  # 月次サマリー入力
GET /api/monthly-reports/latest/:projectName # 最新月次レポート
POST /api/monthly-reports                    # 月次レポート作成
GET /api/monthly-reports/history/:projectName # 月次レポート履歴
```

## 🗃️ データベーススキーマ

### 主要テーブル

#### users（ユーザー）
```sql
- id: SERIAL PRIMARY KEY
- username: TEXT NOT NULL UNIQUE
- password: TEXT NOT NULL
- isAdmin: BOOLEAN NOT NULL DEFAULT false
- createdAt: TIMESTAMP NOT NULL DEFAULT now()
```

#### projects（プロジェクト）
```sql
- id: SERIAL PRIMARY KEY
- name: TEXT NOT NULL UNIQUE
- overview: TEXT               # プロジェクト概要
- organization: TEXT           # 体制と関係者
- personnel: TEXT              # 要員・契約情報
- progress: TEXT               # 現状の進捗・スケジュール
- businessDetails: TEXT        # 業務・システム内容
- issues: TEXT                 # 課題・リスク・懸念点
- documents: TEXT              # ドキュメント・ナレッジ
- handoverNotes: TEXT          # 引き継ぎ時の優先確認事項
- remarks: TEXT                # その他特記事項
- isDeleted: BOOLEAN NOT NULL DEFAULT false
- createdAt: TIMESTAMP NOT NULL DEFAULT now()
- updatedAt: TIMESTAMP NOT NULL DEFAULT now()
```

#### cases（案件）
```sql
- id: SERIAL PRIMARY KEY
- projectName: TEXT NOT NULL
- caseName: TEXT NOT NULL
- description: TEXT
- milestone: TEXT
- includeProgressAnalysis: BOOLEAN NOT NULL DEFAULT true
- isDeleted: BOOLEAN NOT NULL DEFAULT false
- createdAt: TIMESTAMP NOT NULL DEFAULT now()
```

#### weeklyReports（週次レポート）
```sql
- id: SERIAL PRIMARY KEY
- caseId: INTEGER NOT NULL
- reportDate: DATE NOT NULL
- weekNumber: TEXT
- taskDetails: TEXT            # 作業内容
- completedTasks: TEXT         # 完了したタスク
- nextWeekTasks: TEXT          # 来週予定
- issues: TEXT                 # 課題・問題
- progressNotes: TEXT          # 進捗に関する補足
- qualityConcerns: TEXT        # 品質に関する懸念
- resourceNeeds: TEXT          # リソース要求
- riskAssessment: TEXT         # リスク評価
- clientFeedback: TEXT         # 顧客フィードバック
- teamCommunication: TEXT      # チーム内連携
- improvementSuggestions: TEXT # 改善提案
- personalReflection: TEXT     # 個人的な振り返り
- overallStatus: TEXT          # 全体的なステータス
- createdAt: TIMESTAMP NOT NULL DEFAULT now()
- updatedAt: TIMESTAMP NOT NULL DEFAULT now()
```

#### managerMeetings（管理者会議）
```sql
- id: SERIAL PRIMARY KEY
- projectId: INTEGER NOT NULL
- title: TEXT NOT NULL
- date: DATE NOT NULL
- content: TEXT                # 会議内容
- summary: TEXT                # 会議サマリー
- createdAt: TIMESTAMP NOT NULL DEFAULT now()
- updatedAt: TIMESTAMP NOT NULL DEFAULT now()
```

#### systemSettings（システム設定）
```sql
- id: SERIAL PRIMARY KEY
- key: TEXT NOT NULL UNIQUE
- value: TEXT NOT NULL
- description: TEXT
- createdAt: TIMESTAMP NOT NULL DEFAULT now()
- updatedAt: TIMESTAMP NOT NULL DEFAULT now()
```

### リレーション
- cases → projects (多対一)
- weeklyReports → cases (多対一)
- managerMeetings → projects (多対一)
- weeklyReportMeetings → weeklyReports (多対一)
- adminConfirmationEmails → weeklyReports (一対一)

## 🧩 コンポーネント階層

### ページコンポーネント（/pages/）
```typescript
- Home.tsx                    # ダッシュボード
- projects.tsx                # プロジェクト一覧
- project-detail.tsx          # プロジェクト詳細
- project-form.tsx            # プロジェクト作成・編集
- cases.tsx                   # 案件一覧
- case-view.tsx               # 案件詳細
- case-form.tsx               # 案件作成・編集
- weekly-report.tsx           # 週次レポート作成・編集
- weekly-report-detail.tsx    # 週次レポート詳細
- weekly-report-list.tsx      # レポート一覧
- recent-weekly-reports.tsx   # 最近のレポート
- meeting-list.tsx            # 会議一覧
- admin-settings.tsx          # 管理者設定
- admin-users.tsx             # ユーザー管理
- search.tsx                  # 検索結果
- login.tsx                   # ログイン
- not-found.tsx               # 404エラー
```

### UIコンポーネント（/components/ui/）
```typescript
- button.tsx                  # ボタン
- input.tsx                   # 入力フィールド
- textarea.tsx                # テキストエリア
- select.tsx                  # セレクトボックス
- dialog.tsx                  # ダイアログ
- alert-dialog.tsx            # 確認ダイアログ
- card.tsx                    # カード
- table.tsx                   # テーブル
- form.tsx                    # フォーム
- toast.tsx                   # トースト通知
- tooltip.tsx                 # ツールチップ
- badge.tsx                   # バッジ
- tabs.tsx                    # タブ
- calendar.tsx                # カレンダー
- command.tsx                 # コマンドパレット
- popover.tsx                 # ポップオーバー
- scroll-area.tsx             # スクロールエリア
- separator.tsx               # セパレータ
- skeleton.tsx                # スケルトンローダー
- switch.tsx                  # スイッチ
- checkbox.tsx                # チェックボックス
- radio-group.tsx             # ラジオボタン
- collapsible.tsx             # 折りたたみ
- toggle.tsx                  # トグル
- sheet.tsx                   # シート
- breadcrumb.tsx              # パンくずリスト
- label.tsx                   # ラベル
- alert.tsx                   # アラート
- toaster.tsx                 # トースター
```

### 機能コンポーネント（/components/）
```typescript
- site-layout.tsx             # レイアウト
- site-header.tsx             # ヘッダー
- search-bar.tsx              # 検索バー
- ai-analysis-result.tsx      # AI分析結果表示
- ai-provider-selector.tsx    # AIプロバイダー選択
- case-selector-modal.tsx     # 案件選択モーダル
- previous-report-tooltip.tsx # 前回レポート比較
- manager-meeting-form.tsx    # 管理者会議フォーム
- manager-meeting-list.tsx    # 管理者会議一覧
- milestone-dialog.tsx        # マイルストーンダイアログ
- sample-report-dialog.tsx    # サンプルレポートダイアログ
- theme-toggle.tsx            # テーマ切り替え
- editing-users-indicator.tsx # 編集中ユーザー表示
- navigation-confirm-dialog.tsx # ナビゲーション確認
- conflict-resolution-dialog.tsx # 競合解決ダイアログ
```

### 週次レポート専用コンポーネント（/components/weekly-report/）
```typescript
- report-header.tsx           # レポートヘッダー
- basic-info-form.tsx         # 基本情報フォーム
- task-details-section.tsx    # タスク詳細セクション
- meeting-minutes.tsx         # 会議議事録
```

### カスタムフック（/hooks/）
```typescript
- use-ai-analysis.ts          # AI分析フック
- use-toast.ts                # トースト通知フック
- use-navigation-guard.ts     # ナビゲーションガード
- use-meeting-minutes-generator.ts # 会議議事録生成
- use-mobile.tsx              # モバイル判定
- use-report-auto-save.ts     # レポート自動保存
- use-custom-event.ts         # カスタムイベント
- use-performance.ts          # パフォーマンス監視
- use-weekly-report-form.ts   # 週次レポートフォーム
```

## 🧪 テスト構成

### テスト統計
- **総テスト数**: 51件
- **ユニットテスト**: 26件
- **統合テスト**: 25件
- **カバレッジ**: 1.06%（基盤構築完了）

### テストカテゴリ
```
tests/
├── unit/                     # ユニットテスト
│   ├── client/              # フロントエンドテスト
│   │   ├── components/      # コンポーネントテスト
│   │   ├── hooks/           # フックテスト
│   │   └── utils/           # ユーティリティテスト
│   └── server/              # バックエンドテスト
│       ├── basic.test.ts    # 基本機能テスト
│       ├── ai-service.test.ts # AIサービステスト
│       └── storage.test.ts  # ストレージテスト
├── integration/             # 統合テスト
│   ├── api/                 # APIテスト
│   ├── auth/                # 認証テスト
│   └── e2e/                 # E2Eテスト
├── __fixtures__/            # テストデータ
├── __mocks__/               # MSWモック
├── utils/                   # テストユーティリティ
└── setup.ts                 # テスト環境設定
```

## 🔧 開発コマンド

### 基本開発
```bash
npm run dev          # 開発サーバー起動（統合サーバー・ポート5000）
npm run build        # 本番ビルド（Vite + ESBuild）
npm start            # 本番サーバー起動
npm run check        # TypeScript型チェック
```

### データベース
```bash
npm run db:push      # スキーマ変更をプッシュ
npx drizzle-kit push # 手動スキーマプッシュ
```

### テスト
```bash
npm test                    # 全テスト実行
npm run test:unit          # ユニットテスト
npm run test:integration   # 統合テスト
npm run test:watch         # ウォッチモード
npm run test:coverage      # カバレッジレポート
npm run test:ui            # ブラウザテスト表示
```

## 📋 主要機能

### プロジェクト管理
- プロジェクト作成・編集・削除
- 詳細情報管理（体制、要員、進捗、課題等）
- ソフト削除による安全な削除機能

### 案件管理
- プロジェクト関連付けによる案件管理
- マイルストーン設定・更新
- 進捗分析オプション設定

### 週次レポート
- 包括的な週次レポート作成
- 前回レポートとの比較機能
- AI分析による自動要約・アドバイス生成
- リアルタイム自動保存
- 管理者向け確認メール自動生成

### AI統合機能
- **テキスト分析**: タスク内容の分析とアドバイス生成
- **自動要約**: 長文の自動要約機能
- **ストリーミング分析**: リアルタイム分析結果表示
- **会話機能**: AI とのインタラクティブな対話
- **プロバイダー切り替え**: 5つのAIプロバイダー対応

### 検索機能
- プロジェクト、案件、レポート横断の全文検索
- 検索候補表示
- 高速検索レスポンス

### ユーザー管理
- 役割ベースアクセス制御（管理者/一般）
- セッションベース認証
- ユーザー作成・編集・削除（管理者機能）

### 会議管理
- 管理者会議記録
- 週次レポート関連会議記録
- AI生成による議事録作成支援

### システム設定
- 動的設定管理
- AIプロバイダー設定
- セッション別AI設定

## 🔐 セキュリティ機能

### 認証・認可
- Passport.js によるセッションベース認証
- PostgreSQL セッションストア（Neon.tech環境ではMemoryStoreフォールバック）
- ミドルウェアによるルート保護（`isAuthenticated`, `isAdmin`）

### データ保護
- Drizzle ORM によるSQLインジェクション対策
- Zod によるバリデーション
- ソフト削除によるデータ保護

### AI セキュリティ
- APIキーの環境変数管理と自動マスキング
- プロンプトインジェクション対策
- AIレスポンスのコンテンツクリーニング

## 🚀 パフォーマンス最適化

### フロントエンド
- React Query による効率的なキャッシュ戦略
- コンポーネント最適化とレンダリング効率化
- 検索結果制限（20件）とページネーション

### バックエンド
- データベースクエリ最適化
- 並列AI処理による応答時間短縮（30-50%改善）
- 接続プールとリトライロジック

### AI統合
- プロバイダー別最適化
- トークン使用量追跡
- 包括的なログとモニタリング

## 📚 ドキュメント

### プロジェクトドキュメント
- `CLAUDE.md` - プロジェクト概要と開発ガイド
- `README.md` - プロジェクト説明とセットアップ
- `API.md` - API仕様書
- `TESTING.md` - テスト仕様とガイド
- `USER_GUIDE.md` - ユーザーガイド
- `DEVELOPMENT.md` - 開発者向けガイド

### Claude Code ナレッジマネジメント
- `.claude/context.md` - プロジェクトコンテキスト
- `.claude/project-knowledge.md` - 技術知識
- `.claude/project-improvements.md` - 改善履歴
- `.claude/common-patterns.md` - 開発パターン
- `.claude/debug-log.md` - デバッグログ

---

## 🎯 今後の改善予定

### 技術的改善
- テストカバレッジの向上（現在1.06% → 目標80%+）
- TypeScript型エラーの解決
- パフォーマンス監視の強化

### 機能拡張
- ダッシュボード機能の強化
- レポートテンプレート機能
- 通知システムの実装
- データエクスポート機能

### AI機能強化
- 新しいAIプロバイダーの追加
- より高精度な分析アルゴリズム
- カスタムプロンプトテンプレート

---

*このドキュメントは、TaskTrackrプロジェクトの包括的なインデックスとして機能し、開発チーム全体での知識共有と効率的な開発をサポートします。*