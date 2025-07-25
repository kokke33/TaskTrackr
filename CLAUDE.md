# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

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
- **.claude/commands/** - コマンド関連の記録
- **.claude/settings.local.json** - Claude Code ローカル設定

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
- `tsx server/index.ts` - サーバーの直接実行（デバッグ用）
- `npx drizzle-kit push` - データベーススキーマの手動プッシュ

### 重要：統合サーバー設計
- **統一ポート構成**: 開発時は単一のExpressサーバーがポート5000でフロントエンドとバックエンドの両方を配信
- **個別起動不可**: フロントエンドとバックエンドを個別に起動するコマンドは存在しない
- **ビルド出力**: フロントエンドは`dist/public/`、バックエンドは`dist/index.js`に出力

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
- **AI統合**: マルチプロバイダー対応（OpenAI、Ollama、Google Gemini、Groq、OpenRouter）
- **フォーム処理**: React Hook Form + Zod バリデーション
- **スタイリング**: TailwindCSS + Tailwind Animate + class-variance-authority

### プロジェクト構造
```
TaskTrackr/
├── client/src/           # Reactフロントエンド
│   ├── components/       # 再利用可能なReactコンポーネント
│   │   ├── ui/          # Shadcn/uiコンポーネント（48+コンポーネント）
│   │   ├── ai-analysis-result.tsx      # AI分析結果表示
│   │   ├── case-selector-modal.tsx     # 案件選択モーダル
│   │   ├── previous-report-tooltip.tsx # 前回レポート比較機能
│   │   └── search-bar.tsx              # 全文検索機能
│   ├── pages/           # ルートコンポーネント（Wouterルーティング）
│   ├── lib/             # ユーティリティと認証ヘルパー
│   │   ├── auth.tsx     # 認証コンテキスト
│   │   ├── queryClient.ts # API リクエスト共通処理
│   │   └── utils.ts     # ユーティリティ関数
│   ├── hooks/           # カスタムReactフック
│   │   ├── use-ai-analysis.ts # AI分析フック
│   │   └── use-toast.ts       # トースト通知フック
│   └── utils/           # その他ユーティリティ
├── server/              # Expressバックエンド
│   ├── routes.ts        # APIルート定義
│   ├── storage.ts       # データベース操作（Drizzle ORM）
│   ├── ai-service.ts    # AIプロバイダー抽象化
│   ├── ai-logger.ts     # AIインタラクションログ
│   ├── ai-routes.ts     # AI専用ルート
│   ├── auth.ts          # Passport.js認証設定
│   ├── config.ts        # 設定バリデーション
│   ├── db.ts            # データベース接続設定
│   ├── migrations/      # データベースマイグレーションファイル
│   └── prompts/         # AI プロンプトテンプレート
│       ├── config/      # 設定用プロンプト
│       ├── core/        # 基本プロンプト
│       └── reports/     # レポート用プロンプト
├── shared/              # 共有TypeScript型定義
│   └── schema.ts        # Drizzle ORMスキーマ定義
├── .claude/             # Claude Code 知識管理
│   ├── context.md       # プロジェクトコンテキスト
│   ├── project-knowledge.md # 技術知識
│   └── common-patterns.md   # 共通パターン
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
- OpenAI、Ollama、Google Gemini、Groq、OpenRouter実装
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
AI_PROVIDER=openai  # または "ollama", "gemini", "groq", "openrouter"
AI_LOG_LEVEL=info   # debug, info, warn, error (本番環境では自動的にwarnに設定)
AI_LOG_CONSOLE=true # 本番環境では自動的にfalseに設定
AI_LOG_FILE=false   # ファイルログを有効にする場合はtrueに設定
AI_LOG_MASK_SENSITIVE=true  # 機密データのマスク化を有効にする

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

# OpenRouter（使用する場合）
OPENROUTER_API_KEY=sk-or-your-key
OPENROUTER_MODEL=anthropic/claude-3.5-sonnet  # または "anthropic/claude-sonnet-4", "google/gemini-2.0-flash-001", "google/gemini-2.5-flash", "google/gemini-2.5-pro"
OPENROUTER_MAX_TOKENS=4000
OPENROUTER_TEMPERATURE=0.7

# 開発環境設定
PORT=3000
NODE_ENV=development
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

### フォーム開発パターン
```typescript
// React Hook Form + Zod バリデーション
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertProjectSchema } from "@shared/schema";

const form = useForm<z.infer<typeof insertProjectSchema>>({
  resolver: zodResolver(insertProjectSchema),
  defaultValues: {
    name: "",
    overview: "",
    // null値対応: value={field.value ?? ""}
  },
});
```

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
- **TypeScript設定**: incremental buildとtsBuildInfoFileによる高速コンパイル
- **モジュール解決**: bundler方式でallowImportingTsExtensions有効

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
週次レポートフィールドは初回編集時のみblur時に自動的にAI分析をトリガー。2回目以降は手動再生成ボタンでのみ実行。`analyzeField(fieldName, content, originalContent?, previousReportContent?)`パターンを使用。`useAIAnalysis`フックの`hasRunAnalysis`フラグで初回実行を追跡。

### 前回レポートデータ
履歴比較には週次レポートクエリの`latestReport`を使用。レポートは`/api/weekly-reports/previous/:caseId`エンドポイント経由でケースと日付関係に基づいて取得。

### 設定キー名の整合性
リアルタイム分析設定は`REALTIME_PROVIDER`キーを使用（`REALTIME_AI_PROVIDER`ではない）。画面表示、DB保存、サーバー読み込み全てで統一。

### AIログ機能
AIサービスのログは本番環境で自動的に最適化されます：
- ログレベルが自動的にWARNINGに設定
- コンソールログが自動的に無効化
- 大きなレスポンスボディは1000文字で切り詰め
- APIキーは自動的にマスク化（OpenAI、Groq、Gemini、OpenRouter対応）
- リクエストデータはキャッシュされ、レスポンス/エラーログで再利用

### ストリーミング対応
一部のAIプロバイダーでリアルタイムストリーミングをサポート：
- **Gemini**: `generateStreamResponse`メソッドでストリーミング対応
- **OpenAI**: 標準でストリーミング機能を提供
- フロントエンドの`streamingSupportedProviders`配列で管理

### 管理者向け確認メール機能
週次レポート作成時に管理者向けの確認メールを自動生成：
- `generate-admin-confirmation-email.usecase.ts`でメール内容を生成
- レポート詳細ページで管理者がメールを確認・再生成可能
- `/api/weekly-reports/:id/regenerate-admin-email`エンドポイントで再生成

## デバッグとトラブルシューティング

### 一般的な問題と解決策

#### 1. TypeScript型エラー
```bash
# 型チェックを実行
npm run check

# 既知の問題：
# - client/src/pages/weekly-report.tsx の TextArea null値エラー
# - server/routes.ts のユーザーオブジェクトプロパティアクセス
```

#### 2. データベース接続エラー
```bash
# スキーマをプッシュ
npm run db:push

# 接続確認
# 環境変数 DATABASE_URL を確認
# PostgreSQL/Neon.tech への接続状況を確認
```

#### 3. AI機能のデバッグ
```bash
# AI ログの確認
# 環境変数 AI_LOG_LEVEL=debug に設定
# AI_LOG_CONSOLE=true でコンソール出力を有効化

# プロバイダー別のトラブルシューティング：
# - OpenAI: API キーと利用制限を確認
# - Ollama: ローカルサーバーの起動状況を確認
# - Gemini: APIキーと地域制限を確認
# - Groq: APIキーとレート制限を確認
```

#### 4. セッション認証エラー
```bash
# セッションストレージの確認
# PostgreSQL セッションテーブルの状況を確認
# MemoryStore フォールバック動作を確認
```

### 開発サーバーの再起動手順
```bash
# 完全な再起動（推奨）
npm run dev

# 注意：個別起動コマンドは存在しません
# npm run dev で統合サーバーが localhost:5000 で起動
```

### 開発時のポート構成
- **開発サーバー**: `localhost:5000` - 統合サーバー（フロント + バック）
- **本番サーバー**: `PORT`環境変数で指定（デフォルト3000）
- **データベース**: PostgreSQL標準ポート5432またはNeon.tech

### パフォーマンス監視
- React Query DevTools を使用してキャッシュ状況を確認
- ブラウザの Network タブでAPI呼び出しを監視
- AI分析処理の応答時間を `ai-logger.ts` で確認
- データベースクエリのパフォーマンスを監視

## 知識管理と継続的改善

### 知識の記録場所
- **.claude/context.md** - プロジェクトの背景と制約情報
- **.claude/project-knowledge.md** - 技術的な洞察と実装パターン
- **.claude/project-improvements.md** - 改善履歴と学習内容
- **.claude/common-patterns.md** - 頻繁に使用するコマンドとパターン
- **.claude/debug-log.md** - 重要なデバッグ記録

### 継続的改善のプロセス
1. **新しい技術パターンの発見** → `.claude/project-knowledge.md` に記録
2. **問題解決の手順** → `.claude/debug-log.md` に記録
3. **改善された実装** → `.claude/project-improvements.md` に記録
4. **よく使うコマンド** → `.claude/common-patterns.md` に記録

## テストとデプロイメント

### 初期ユーザー作成
初回実行時に自動的に管理者ユーザーが作成されます：
- **ユーザー名**: `admin`
- **パスワード**: `password`

### テスト実行
現在、専用のテストフレームワークは設定されていません。機能テストは手動で実行：
1. `npm run dev` でサーバー起動
2. ブラウザで `localhost:5000` にアクセス
3. 管理者ログイン（admin/password）で機能確認

**注意**: 将来的にはJest/VitestやPlaywrightなどのテストフレームワークの導入を検討してください。現在は統合テストも手動で実行する必要があります。

### 品質チェック
```bash
npm run check    # TypeScript型チェック
npm run build    # ビルドエラーチェック
```

## セキュリティとベストプラクティス

### 認証・セッション管理
- Passport.jsによるセッションベース認証を採用
- PostgreSQLセッションストア使用（Neon.tech環境ではMemoryStoreにフォールバック）
- セッション有効期限とCookie設定の適切な管理
- 初期管理者アカウント（admin/password）は本番環境では必ず変更

### データベースセキュリティ
- Drizzle ORMによるクエリインジェクション対策
- 適切なバリデーション（Zod）による入力値検証
- ソフト削除パターン（isDeletedフラグ）によるデータ保護

### AI統合のセキュリティ
- APIキーの環境変数管理と自動マスキング
- プロンプトインジェクション対策
- AIレスポンスのコンテンツクリーニング（`<think>`タグ除去）

## パフォーマンス最適化ガイド

### フロントエンド最適化
- React Query による適切なキャッシュ戦略（2-5分間）
- コンポーネントの適切な分割とレンダリング最適化
- 大量データに対する検索制限（20件）とページネーション

### バックエンド最適化
- データベースクエリの最適化（必要最小限のフィールド取得）
- N+1問題の解決（一括データ取得）
- 並列AI処理による応答時間の短縮（30-50%改善）