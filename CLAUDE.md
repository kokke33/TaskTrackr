# CLAUDE.md

このファイルは、Claude Code (claude.ai/code) がこのリポジトリでコードを扱う際のガイダンスを提供します。

TaskTrackrプロジェクトのClaude Code用設定ファイルです。このファイルは、Claude Codeがこのリポジトリで作業する際のガイダンスを提供します。

## 知識管理システム

このプロジェクトでは、以下のファイル構成で知識を体系的に管理しています：

- **CLAUDE.md** (このファイル) - プロジェクト概要と開発ガイド
- **.claude/context.md** - プロジェクトの背景と制約
- **.claude/project-knowledge.md** - 技術的な洞察とパターン
- **.claude/project-improvements.md** - 改善履歴と学習内容
- **.claude/common-patterns.md** - よく使うコマンドパターン
- **.claude/debug-log.md** - 重要なデバッグ記録
- **.claude/debug/** - セッション固有のログとアーカイブ

このシステムにより、プロジェクトの知識を継続的に蓄積・共有し、開発効率と品質の向上を目指しています。

## グローバル設定
- すべての応答は日本語で行ってください
- YOU MUST always respond in Japanese

## 開発コマンド

### 基本開発コマンド
- `npm run dev` - 開発サーバー起動（Expressバックエンドがlocalhost:5000でフロントエンドを配信）
- `npm run build` - 本番ビルド（Viteフロントエンド + ESBuildバックエンド）
- `npm start` - 本番サーバー起動
- `npm run check` - TypeScript型チェック（注意：現在フォームで型エラーあり）
- `npm run db:push` - Drizzle Kitを使用してデータベーススキーマ変更をプッシュ

### 既知の問題
TypeScriptチェックは以下のフォーム値型エラーで現在失敗しています：
- `client/src/pages/weekly-report.tsx` - Textareaコンポーネントが`null`値を受信
- `server/routes.ts` - ユーザーオブジェクトプロパティアクセスの問題

## アーキテクチャ概要

### 技術スタック
- **フロントエンド**: React 18 + TypeScript + Vite + TailwindCSS + Wouter（ルーティング）
- **バックエンド**: Express + TypeScript + Drizzle ORM + PostgreSQL
- **認証**: Passport.jsによるセッションベース認証
- **UI**: Shadcn/uiコンポーネント（Radix UIプリミティブ） - 48+コンポーネント利用可能
- **状態管理**: TanStack Query（React Query）
- **AI統合**: マルチプロバイダー対応（OpenAI、Ollama、Google Gemini、Groq）

### プロジェクト構造
```
TaskTrackr/
├── client/src/           # Reactフロントエンド
│   ├── components/       # 再利用可能なReactコンポーネント
│   │   └── ui/          # Shadcn/uiコンポーネント
│   ├── pages/           # ルートコンポーネント（Wouterルーティング）
│   ├── lib/             # ユーティリティと認証ヘルパー
│   └── hooks/           # カスタムReactフック
├── server/              # Expressバックエンド
│   ├── routes.ts        # APIルート定義
│   ├── storage.ts       # データベース操作（Drizzle ORM）
│   ├── ai-service.ts    # AIプロバイダー抽象化
│   ├── ai-logger.ts     # AIインタラクションログ
│   ├── auth.ts          # Passport.js認証設定
│   ├── config.ts        # 設定バリデーション
│   └── migrations/      # データベースマイグレーションファイル
├── shared/              # 共有TypeScript型定義
│   └── schema.ts        # Drizzle ORMスキーマ定義
```

### データベーススキーマ
Drizzle ORMで管理される主要エンティティ：
- **users** - 認証と役割ベースアクセス（管理者/一般）
- **projects** - 詳細な追跡フィールドを持つ高レベルプロジェクト情報
- **cases** - プロジェクト内の特定のケース/タスク
- **weeklyReports** - ケースにリンクされた包括的な週次ステータスレポート
- **managerMeetings** - プロジェクトにリンクされた会議議事録と記録
- **weeklyReportMeetings** - 週次レポートにリンクされた会議記録
- **systemSettings** - アプリケーション設定

### 重要なアーキテクチャパターン

#### APIクライアントパターン
すべてのAPI呼び出しは`client/src/lib/queryClient.ts`の`apiRequest(url, { method, data? })`を使用：
- セッションクッキーのために常に`credentials: "include"`を含む
- 詳細ログ付きで401エラーを処理
- `throwIfResNotOk`エラーハンドリングで型付きレスポンスを返す

#### 認証フロー
- PostgreSQLセッションストアを使用したPassport.jsベースのセッション認証
- Neon.tech互換性のためのMemoryStoreへのフォールバック
- `isAuthenticated`と`isAdmin`ミドルウェアがルートを保護
- `client/src/lib/auth.tsx`の認証コンテキストがユーザー状態を管理

#### データベースアクセスパターン
すべてのデータベース操作は`server/storage.ts`を通じて実行され、以下を含む：
- `withRetry()`関数による自動リトライロジック
- コネクションプーリングとエラーハンドリング
- Drizzle ORMに対する一貫したインターフェース抽象化
- ソフト削除パターン（isDeletedフラグ）

#### AIサービスアーキテクチャ
`server/ai-service.ts`の抽象`AIService`クラスが複数プロバイダーをサポート：
- OpenAI、Ollama、Google Gemini、Groq実装
- `ai-logger.ts`による包括的ログ
- コンテンツクリーニング（`<think>`タグ、マークダウンブロックを除去）
- トークン使用量追跡とリクエストID生成
- `getDynamicAIConfig()`による動的設定

#### フォームハンドリングパターン
- 全体でReact Hook Form + Zodバリデーション
- `drizzle-zod`を使用した`shared/schema.ts`の共有スキーマ
- 既知の問題：フォームは非null値を期待するがDBフィールドはnullable
- 週次レポートでデバウンス付き自動保存機能

### 主要機能
- プロジェクト、ケース、レポート横断の**全文検索**と候補機能
- テキスト要約とリアルタイム分析のための**AI統合**
- **役割ベースアクセス制御**（管理者/一般ユーザー）
- PostgreSQLストレージによる**セッション管理**
- React Hook Form + Zodバリデーションによる**包括的フォームハンドリング**
- 週次レポート編集のための**前回レポート比較ツールチップ**
- プロジェクトベースフィルタリングと履歴機能付き**ケース選択モーダル**

## 環境設定

必要な環境変数：
```env
# データベース
DATABASE_URL=postgres://user:pass@localhost:5432/tasktrackr

# セッション
SESSION_SECRET=your-session-secret

# AIプロバイダー
AI_PROVIDER=openai  # または "ollama", "gemini", "groq"
AI_LOG_LEVEL=info
AI_LOG_CONSOLE=true

# OpenAI（使用する場合）
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o-mini
OPENAI_MAX_TOKENS=10000
OPENAI_TEMPERATURE=0.7

# Ollama（使用する場合）
OLLAMA_BASE_URL=http://localhost:11434/
OLLAMA_MODEL=qwen3:latest

# Gemini（使用する場合）
GEMINI_API_KEY=your-key
GEMINI_MODEL=gemini-2.5-flash

# Groq（使用する場合）
GROQ_API_KEY=your-key
GROQ_MODEL=llama-3.1-70b-versatile
```

## 開発パターン

### 新しいデータベースフィールドの追加
1. `shared/schema.ts`でスキーマを更新
2. `npm run db:push`を実行して変更を適用
3. 必要に応じてTypeScript型とフォームを更新
4. コンポーネントでnullableフィールドを適切に処理

### 新しいAPIルートの追加
1. `server/routes.ts`でルートハンドラーを追加
2. `server/storage.ts`で対応するストレージメソッドを追加
3. 保護のために`isAuthenticated`/`isAdmin`ミドルウェアを使用
4. データ取得のためにフロントエンドフック/クエリを更新

### コンポーネント開発
- `client/src/components/ui/`のShadcn/uiコンポーネントを使用
- `client/src/components/`の既存パターンに従う
- 適切なTypeScript型付けとエラーハンドリングを実装
- 履歴データを持つフォームフィールドにはPreviousReportTooltipを使用

### AI統合
- 新しいAI機能には抽象AIServiceパターンを使用
- aiLoggerを通じてすべてのAIインタラクションをログ
- cleanThinkTagsメソッドでコンテンツをクリーニング
- 設定によるプロバイダー切り替えを処理

## 特別な設定

### データベース互換性
- **Neon.tech対応**: PostgreSQLセッションが失敗した場合のMemoryStoreへの自動フォールバック
- **接続リトライロジック**: ストレージ操作で接続失敗を適切に処理
- **マイグレーションシステム**: スキーマバージョニングにDrizzle Kitを使用

### ビルド設定
- **ハイブリッドビルドシステム**: フロントエンドはVite、バックエンドはESBuildでビルド
- **パスエイリアス**: クライアントコード用`@/`、共有型用`@shared/`
- **開発サーバー**: 単一の`npm run dev`コマンドでフロントエンドとバックエンドの両方を実行
- **出力**: フロントエンドは`dist/public/`、バックエンドは`dist/index.js`

### 認証機能
- **初期ユーザー作成**: 初回実行時の自動管理者ユーザー設定（admin/password）
- **セッションデバッグ**: セッショントラブルシューティング用の開発ミドルウェア
- **役割ベースミドルウェア**: APIルート用の`isAuthenticated`と`isAdmin`ガード

## 重要な実装注意事項

### フォームのnull値ハンドリング
既知のTypeScript問題：データベースフィールドはnullableだがReactコンポーネントは非null値を期待。TextAreaには`value={field.value ?? ""}`パターンを使用。

### APIリクエストパターン
常に`apiRequest(url, { method: "GET"|"POST"|"PUT"|"DELETE", data? })`を使用 - fetchを直接呼び出さない。

### AI分析統合
週次レポートフィールドはblur時に自動的にAI分析をトリガー。`analyzeField(fieldName, content, originalContent?, previousReportContent?)`パターンを使用。

### 前回レポートデータ
履歴比較には週次レポートクエリの`latestReport`を使用。レポートは`/api/weekly-reports/previous/:caseId`エンドポイント経由でケースと日付関係に基づいて取得。