# TaskTrackr プロジェクトドキュメント

このドキュメントは、TaskTrackr プロジェクトの概要、開発ガイド、アーキテクチャ、および運用に関する詳細情報を提供します。

## 更新履歴
- **2025/1/30**: ドキュメント全体を更新し、最新の技術スタックと機能を反映
- **2024年後半**: AIプロバイダーの拡張（5種類をサポート）、テストインフラの構築

## 知識管理システム

このプロジェクトは、以下のファイル構造で知識を体系的に管理しています。

- **GEMINI.md** (このファイル) - プロジェクトの概要と開発ガイド
- **.claude/context.md** - プロジェクトの背景と制約
- **.claude/project-knowledge.md** - 技術的な洞察とパターン
- **.claude/project-improvements.md** - 改善履歴と教訓
- **.claude/common-patterns.md** - 頻繁に使用されるコマンドパターン
- **.claude/debug-log.md** - 重要なデバッグ記録
- **.claude/debug/** - セッション固有のログとアーカイブ
- **.claude/commands/** - コマンド関連の記録
- **.claude/settings.local.json** - ローカル設定

このシステムは、プロジェクト知識を継続的に蓄積・共有し、開発効率と品質の向上を目指しています。

## 開発コマンド

### 基本開発コマンド
- `npm run dev` - 開発サーバーを起動します (Express バックエンドが localhost:5000 でフロントエンドを提供します)
- `npm run build` - 本番ビルドを実行します (Vite フロントエンド + ESBuild バックエンド)
- `npm start` - 本番サーバーを起動します
- `npm run check` - TypeScript の型チェックを実行します (注意: 現在、フォームに型エラーがあります)
- `npm run db:push` - Drizzle Kit を使用してデータベーススキーマの変更をプッシュします
- `tsx server/index.ts` - サーバーを直接実行します (デバッグ用)
- `npx drizzle-kit push` - 手動でデータベーススキーマをプッシュします

### テストコマンド
- `npm test` - 全てのテストを実行します (ユニットテスト + 統合テスト)
- `npm run test:unit` - ユニットテストのみを実行します
- `npm run test:integration` - 統合テストのみを実行します
- `npm run test:watch` - ウォッチモードでテストを実行します (開発中)
- `npm run test:coverage` - カバレッジレポート付きでテストを実行します
- `npm run test:ui` - ブラウザでテスト結果を表示します
- `npm test tests/unit/server/basic.test.ts` - 特定のファイルのテストを実行します
- `npm test button` - パターンマッチングでテストを実行します
- `npm test -- --reporter=verbose` - 詳細なログ付きでテストを実行します

### 重要: 統合サーバー設計
- **統合ポート設定**: 開発中、単一の Express サーバーがフロントエンドとバックエンドの両方をポート 5000 で提供します。
- **個別の起動なし**: フロントエンドとバックエンドを個別に起動するコマンドはありません。
- **ビルド出力**: フロントエンドは `dist/public/` に、バックエンドは `dist/index.js` に出力されます。

### 既知の問題 (2025年1月現在)
TypeScript のチェックは現在、以下のフォーム値の型エラーで失敗します:
- `client/src/pages/weekly-report.tsx` - Textarea コンポーネントが `null` 値を受け取る
- `server/routes.ts` - User オブジェクトのプロパティアクセスに関する問題

**回避策**: フォームフィールドには `value={field.value ?? ""}` パターンを使用してください。

## アーキテクチャ概要

### 技術スタック (2025年1月現在)
- **フロントエンド**: React 18 + TypeScript + Vite + TailwindCSS + Wouter (ルーティング)
- **バックエンド**: Express + TypeScript + Drizzle ORM + PostgreSQL
- **認証**: Passport.js セッションベース認証 + 自動フォールバック (PostgreSQL → MemoryStore)
- **UI**: Shadcn/ui コンポーネント (Radix UI プリミティブ) - 48以上のコンポーネントが利用可能
- **状態管理**: TanStack Query (React Query v5.60.5)
- **AI連携**: 5つのプロバイダーを完全にサポート (OpenAI, Ollama, Google Gemini, Groq, OpenRouter)
- **フォーム処理**: React Hook Form + Zod バリデーション
- **スタイリング**: TailwindCSS + Tailwind Animate + class-variance-authority
- **テスト**: Vitest 3.2.4 + React Testing Library + MSW + Supertest + Happy DOM (51テスト)
- **WebSocket**: リアルタイム通信 (ws v8.18.0)
- **ロギング**: Winston + daily-rotate-file (AI固有のロギング)

### プロジェクト構造
```
TaskTrackr/
├── client/src/           # React フロントエンド
│   ├── components/       # 再利用可能な React コンポーネント
│   │   ├── ui/          # Shadcn/ui コンポーネント (48以上のコンポーネント)
│   │   ├── ai-analysis-result.tsx      # AI分析結果表示
│   │   ├── case-selector-modal.tsx     # 案件選択モーダル
│   │   ├── previous-report-tooltip.tsx # 前回レポート比較機能
│   │   └── search-bar.tsx              # 全文検索機能
│   ├── pages/           # ルートコンポーネント (Wouter ルーティング)
│   ├── lib/             # ユーティリティと認証ヘルパー
│   │   ├── auth.tsx     # 認証コンテキスト
│   │   ├── queryClient.ts # APIリクエスト共通処理
│   │   └── utils.ts     # ユーティリティ関数
│   ├── hooks/           # カスタム React フック
│   │   ├── use-ai-analysis.ts # AI分析フック
│   │   └── use-toast.ts       # トースト通知フック
│   └── utils/           # その他のユーティリティ
├── server/              # Express バックエンド
│   ├── routes.ts        # APIルート定義
│   ├── storage.ts       # データベース操作 (Drizzle ORM)
│   ├── ai-service.ts    # AIプロバイダー抽象化
│   ├── ai-logger.ts     # AIインタラクションログ
│   ├── ai-routes.ts     # AI固有のルート
│   ├── auth.ts          # Passport.js 認証設定
│   ├── config.ts        # 設定バリデーション
│   ├── db.ts            # データベース接続設定
│   ├── migrations/      # データベースマイグレーションファイル
│   └── prompts/         # AIプロンプトテンプレート
│       ├── config/      # 設定プロンプト
│       ├── core/        # コアプロンプト
│       └── reports/     # レポートプロンプト
├── shared/              # 共有 TypeScript 型定義
│   └── schema.ts        # Drizzle ORM スキーマ定義
├── tests/               # テストファイル
│   ├── unit/           # ユニットテスト
│   │   ├── client/     # フロントエンドテスト
│   │   └── server/     # バックエンドテスト
│   ├── integration/    # 統合テスト
│   ├── __fixtures__/   # テストデータ
│   ├── __mocks__/      # MSW モック
│   ├── utils/          # テストユーティリティ
│   └── setup.ts        # テスト環境設定
├── .claude/             # Claude Code 知識管理 (プロジェクト知識管理)
│   ├── context.md       # プロジェクトの背景
│   ├── project-knowledge.md # 技術知識
│   └── common-patterns.md   # 共通パターン
```

### データベーススキーマ
Drizzle ORM によって管理される主要なエンティティ:
- **users** - 認証とロールベースアクセス (管理者/一般)
- **projects** - 詳細な追跡フィールドを持つ高レベルのプロジェクト情報
- **cases** - プロジェクト内の特定の案件/タスク
- **weeklyReports** - 案件にリンクされた包括的な週次報告
- **managerMeetings** - プロジェクトにリンクされた会議議事録と記録
- **weeklyReportMeetings** - 週次報告にリンクされた会議記録
- **systemSettings** - アプリケーション設定

### 重要なアーキテクチャパターン

#### APIクライアントパターン
全ての API 呼び出しは `client/src/lib/queryClient.ts` の `apiRequest(url, { method, data? })` を使用します:
- セッションクッキーのために常に `credentials: "include"` を含みます
- 詳細なロギングで 401 エラーを処理します
- `throwIfResNotOk` エラーハンドリングで型付きレスポンスを返します

#### 認証フロー
- Passport.js ベースのセッション認証で PostgreSQL セッションストアを使用します
- Neon.tech との互換性のために MemoryStore にフォールバックします
- `isAuthenticated` および `isAdmin` ミドルウェアがルートを保護します
- `client/src/lib/auth.tsx` の認証コンテキストがユーザーの状態を管理します

#### データベースアクセスパターン
全てのデータベース操作は `server/storage.ts` を介して実行されます。これには以下が含まれます:
- `withRetry()` 関数による自動リトライロジック
- コネクションプーリングとエラーハンドリング
- Drizzle ORM の一貫したインターフェース抽象化
- ソフトデリートパターン (isDeleted フラグ)

#### AIサービスアーキテクチャ
`server/ai-service.ts` の抽象 `AIService` クラスは複数のプロバイダーをサポートします:
- OpenAI, Ollama, Google Gemini, Groq, OpenRouter の実装
- `ai-logger.ts` を介した包括的なロギング
- コンテンツクリーニング (`<think>` タグ、マークダウンブロックを削除)
- トークン使用量の追跡とリクエストIDの生成
- `getDynamicAIConfig()` を介した動的設定

#### フォーム処理パターン
- React Hook Form + Zod バリデーションが全体で使用されています
- `drizzle-zod` を使用した `shared/schema.ts` の共有スキーマ
- 既知の問題: フォームは非null値を期待しますが、DBフィールドはnull許容です
- 週次報告のデバウンスされた自動保存機能

### 主要機能
- プロジェクト、案件、レポート全体にわたる**全文検索**とサジェスト機能
- テキスト要約とリアルタイム分析のための**AI連携**
- **ロールベースのアクセス制御** (管理者/一般ユーザー)
- PostgreSQL ストレージによる**セッション管理**
- React Hook Form + Zod バリデーションによる**包括的なフォーム処理**
- 週次報告編集時の**前回レポート比較ツールチップ**
- プロジェクトベースのフィルタリングと履歴機能を持つ**案件選択モーダル**

## 環境設定

必須の環境変数:
```env
# Database
DATABASE_URL=postgres://user:pass@localhost:5432/tasktrackr

# Session
SESSION_SECRET=your-session-secret

# AI Provider
AI_PROVIDER=openai  # or "ollama", "gemini", "groq", "openrouter"
AI_LOG_LEVEL=info   # debug, info, warn, error (本番環境では自動的に warn に設定されます)
AI_LOG_CONSOLE=true # 本番環境では自動的に false に設定されます
AI_LOG_FILE=false   # true に設定するとファイルロギングが有効になります
AI_LOG_MASK_SENSITIVE=true  # 機密データのマスキングを有効にします

# OpenAI (使用する場合)
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o-mini
OPENAI_MAX_TOKENS=10000
OPENAI_TEMPERATURE=0.7

# Ollama (使用する場合)
OLLAMA_BASE_URL=http://localhost:11434/
OLLAMA_MODEL=qwen3:latest

# Gemini (使用する場合)
GEMINI_API_KEY=your-key
GEMINI_MODEL=gemini-2.5-flash

# Groq (使用する場合)
GROQ_API_KEY=your-key
GROQ_MODEL=llama-3.1-70b-versatile

# OpenRouter (使用する場合)
OPENROUTER_API_KEY=sk-or-your-key
OPENROUTER_MODEL=anthropic/claude-3.5-sonnet  # or "anthropic/claude-sonnet-4", "google/gemini-2.0-flash-001", "google/gemini-2.5-flash", "google/gemini-2.5-pro"
OPENROUTER_MAX_TOKENS=4000
OPENROUTER_TEMPERATURE=0.7

# 開発環境設定
PORT=3000
NODE_ENV=development
```

## 開発パターン

### 新しいデータベースフィールドの追加
1.  `shared/schema.ts` でスキーマを更新します
2.  `npm run db:push` を実行して変更を適用します
3.  必要に応じて TypeScript の型とフォームを更新します
4.  コンポーネントで null 許容フィールドを適切に処理します

### 新しいAPIルートの追加
1.  `server/routes.ts` にルートハンドラを追加します
2.  `server/storage.ts` に対応するストレージメソッドを追加します
3.  保護のために `isAuthenticated`/`isAdmin` ミドルウェアを使用します
4.  データ取得のためにフロントエンドのフック/クエリを更新します

### コンポーネント開発
- `client/src/components/ui/` の Shadcn/ui コンポーネントを使用します
- `client/src/components/` の既存のパターンに従います
- 適切な TypeScript の型付けとエラーハンドリングを実装します
- 履歴データを持つフォームフィールドには PreviousReportTooltip を使用します

### AI連携
- 新しい AI 機能には抽象的な AIService パターンを使用します
- `aiLogger` を介して全ての AI インタラクションをログに記録します
- `cleanThinkTags` メソッドでコンテンツをクリーンアップします
- 設定を介してプロバイダーの切り替えを処理します

### フォーム開発パターン
```typescript
// React Hook Form + Zod Validation
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertProjectSchema } from "@shared/schema";

const form = useForm<z.infer<typeof insertProjectSchema>>({
  resolver: zodResolver(insertProjectSchema),
  defaultValues: {
    name: "",
    overview: "",
    // null 値の処理: value={field.value ?? ""}
  },
});
```

## 特別な設定

### データベース互換性
- **Neon.tech サポート**: PostgreSQL セッションが失敗した場合、MemoryStore に自動的にフォールバックします
- **接続リトライロジック**: ストレージ操作での接続失敗を適切に処理します
- **マイグレーションシステム**: スキーマのバージョン管理に Drizzle Kit を使用します

### ビルド設定
- **ハイブリッドビルドシステム**: フロントエンドは Vite、バックエンドは ESBuild でビルドされます
- **パスエイリアス**: クライアントコードには `@/`、共有型には `@shared/` を使用します
- **開発サーバー**: 単一の `npm run dev` コマンドでフロントエンドとバックエンドの両方を実行します
- **出力**: フロントエンドは `dist/public/` に、バックエンドは `dist/index.js` に出力されます
- **TypeScript 設定**: インクリメンタルビルドと `tsBuildInfoFile` による高速コンパイル
- **モジュール解決**: `allowImportingTsExtensions` が有効なバンドラーメソッド

### 認証機能
- **初期ユーザー作成**: 初回実行時に管理者ユーザーが自動的にセットアップされます (admin/password)
- **セッションデバッグ**: セッションのトラブルシューティングのための開発ミドルウェア
- **ロールベースミドルウェア**: API ルートの `isAuthenticated` および `isAdmin` ガード

## 重要な実装ノート

### フォームの null 値処理
既知の TypeScript の問題: データベースフィールドは null 許容ですが、React コンポーネントは非 null 値を期待します。TextArea には `value={field.value ?? ""}` パターンを使用してください。

### APIリクエストパターン
常に `apiRequest(url, { method: "GET"|"POST"|"PUT"|"DELETE", data? })` を使用してください - `fetch` を直接呼び出さないでください。

### AI分析連携
週次報告フィールドは、最初の編集時のみ、フォーカスが外れたときに AI 分析を自動的にトリガーします。それ以降の編集では、ボタンを介した手動での再生成が必要です。`analyzeField(fieldName, content, originalContent?, previousReportContent?)` パターンを使用してください。`useAIAnalysis` フックの `hasRunAnalysis` フラグは最初の実行を追跡します。

### 前回レポートデータ
履歴比較には週次報告クエリの `latestReport` を使用します。レポートは、案件と日付の関係に基づいて `/api/weekly-reports/previous/:caseId` エンドポイントを介して取得されます。

### 設定キー名の整合性
リアルタイム分析設定は `REALTIME_PROVIDER` キーを使用します (`REALTIME_AI_PROVIDER` ではありません)。画面表示、DB ストレージ、サーバーロード全体で整合性を確保してください。

### AIロギング機能
AI サービスログは本番環境で自動的に最適化されます:
- ログレベルは自動的に WARNING に設定されます
- コンソールロギングは自動的に無効になります
- 大きなレスポンスボディは 1000 文字に切り詰められます
- API キーは自動的にマスキングされます (OpenAI, Groq, Gemini, OpenRouter をサポート)
- リクエストデータはキャッシュされ、レスポンス/エラーログで再利用されます

### ストリーミングサポート
一部の AI プロバイダーでリアルタイムストリーミングをサポートします:
- **Gemini**: `generateStreamResponse` メソッドでストリーミングをサポート
- **OpenAI**: デフォルトでストリーミング機能を提供
- フロントエンドの `streamingSupportedProviders` 配列で管理されます

### 管理者確認メール機能
週次報告が作成されると、管理者向けの確認メールが自動的に生成されます:
- メールコンテンツは `generate-admin-confirmation-email.usecase.ts` で生成されます
- 管理者はレポート詳細ページでメールを確認し、再生成できます
- `/api/weekly-reports/:id/regenerate-admin-email` エンドポイントを介して再生成します

## デバッグとトラブルシューティング

### よくある問題と解決策

#### 1. TypeScript 型エラー
```bash
# 型チェックを実行
npm run check

# 既知の問題:
# - client/src/pages/weekly-report.tsx の TextArea null 値エラー
# - server/routes.ts の User オブジェクトプロパティアクセス
```

#### 2. データベース接続エラー
```bash
# スキーマをプッシュ
npm run db:push

# 接続を確認
# DATABASE_URL 環境変数を検証
# PostgreSQL/Neon.tech への接続ステータスを確認
```

#### 3. AI機能のデバッグ
```bash
# AIログを確認
# 環境変数で AI_LOG_LEVEL=debug を設定
# AI_LOG_CONSOLE=true でコンソール出力を有効にする

# プロバイダー固有のトラブルシューティング:
# - OpenAI: APIキーと使用制限を確認
# - Ollama: ローカルサーバーのステータスを確認
# - Gemini: APIキーと地域制限を確認
# - Groq: APIキーとレート制限を確認
```

#### 4. セッション認証エラー
```bash
# セッションストレージを確認
# PostgreSQL セッションテーブルのステータスを確認
# MemoryStore フォールバック動作を検証
```

### 開発サーバーの再起動手順
```bash
# 完全な再起動 (推奨)
npm run dev

# 注意: 個別の起動コマンドは存在しません
# npm run dev は localhost:5000 で統合サーバーを起動します
```

### 開発ポート設定
- **開発サーバー**: `localhost:5000` - 統合サーバー (フロントエンド + バックエンド)
- **本番サーバー**: `PORT` 環境変数で指定 (デフォルト 5000)
- **データベース**: PostgreSQL 標準ポート 5432 または Neon.tech

### パフォーマンス監視
- React Query DevTools を使用してキャッシュステータスを確認
- ブラウザのネットワークタブで API 呼び出しを監視
- `ai-logger.ts` で AI 分析処理の応答時間を確認
- データベースクエリのパフォーマンスを監視

## 知識管理と継続的改善

### 知識記録場所
- **.claude/context.md** - プロジェクトの背景と制約情報
- **.claude/project-knowledge.md** - 技術的な洞察と実装パターン
- **.claude/project-improvements.md** - 改善履歴と教訓
- **.claude/common-patterns.md** - 頻繁に使用されるコマンドとパターン
- **.claude/debug-log.md** - 重要なデバッグ記録

### 継続的改善プロセス
1.  **新しい技術パターンの発見** → `.claude/project-knowledge.md` に記録
2.  **問題解決手順** → `.claude/debug-log.md` に記録
3.  **改善された実装** → `.claude/project-improvements.md` に記録
4.  **頻繁に使用されるコマンド** → `.claude/common-patterns.md` に記録

## テストとデプロイ

### 初期ユーザー作成
初回実行時に管理者ユーザーが自動的に作成されます:
- **ユーザー名**: `admin`
- **パスワード**: `password`

### テスト実行
包括的なテストインフラが構築されています:

#### 基本テスト実行
```bash
npm test                    # 全てのテストを実行 (51テスト)
npm run test:unit          # ユニットテスト (26テスト)
npm run test:integration   # 統合テスト (25テスト)
npm run test:watch         # ウォッチモード (開発中)
npm run test:coverage      # カバレッジレポートを生成
```

#### 個別テスト実行
```bash
npm test tests/unit/server/basic.test.ts    # 特定のファイル
npm test button                             # パターンマッチ
npm test -- --reporter=verbose             # 詳細ログ
```

#### テスト環境
- **テストフレームワーク**: Vitest 3.2.4
- **React テスト**: React Testing Library 16.3.0
- **モック**: MSW (Mock Service Worker)
- **カバレッジ**: @vitest/coverage-v8
- **現在のカバレッジ**: 1.06% (基盤構築完了)

#### CI/CD連携
- GitHub Actions による自動テスト実行
- Node.js 18.x, 20.x マトリクステスト
- PostgreSQL データベースサービス
- Codecov カバレッジレポート

### 品質チェック
```bash
npm run check    # TypeScript 型チェック
npm run build    # ビルドエラーチェック
npm test         # 全てのテストを実行
```

## セキュリティとベストプラクティス

### 認証とセッション管理
- セッションベース認証に Passport.js を採用
- PostgreSQL セッションストアを使用 (Neon.tech 環境では MemoryStore にフォールバック)
- セッション有効期限とクッキー設定の適切な管理
- 本番環境では初期管理者アカウント (admin/password) を変更する必要があります

### データベースセキュリティ
- クエリインジェクションからの保護のための Drizzle ORM
- 適切なバリデーション (Zod) による入力検証
- ソフトデリートパターン (isDeleted フラグ) によるデータ保護

### AI連携セキュリティ
- 環境変数管理と API キーの自動マスキング
- プロンプトインジェクションからの保護
- AI レスポンスのコンテンツクリーニング (`<think>` タグを削除)

## パフォーマンス最適化ガイド

### フロントエンド最適化
- React Query による適切なキャッシュ戦略 (2-5分)
- 適切なコンポーネント分割とレンダリング最適化
- 大規模データセットの検索制限 (20件) とページネーション

### バックエンド最適化
- データベースクエリの最適化 (最小限の必要なフィールドの取得)
- N+1 問題の解決 (バッチデータ取得)
- 並列 AI 処理による応答時間の短縮 (30-50% 改善)

## テスト開発パターン

### 新しいテストの作成
1.  **ユニットテスト**: `tests/unit/[client|server]/component.test.ts`
2.  **統合テスト**: `tests/integration/feature.test.ts`
3.  **テストデータ**: `tests/__fixtures__/testData.ts` に追加
4.  **モック**: `tests/__mocks__/handlers.ts` に MSW ハンドラを追加

### テストのベストプラクティス
- React Testing Library の `render()` を使用したコンポーネントテスト
- `userEvent.setup()` を使用したユーザーインタラクション
- `vi.mock()` を使用した外部依存関係のモック
- `expect().toBeInTheDocument()` を使用した DOM 要素の存在アサート
- `waitFor()` を使用した非同期操作の適切な待機

### テスト環境設定
- `.env.test`: テスト用の環境変数
- `tests/setup.ts`: グローバルテスト設定
- `vitest.config.ts`: Vitest 設定とエイリアス
- `tests/utils/testUtils.tsx`: カスタムレンダー関数

詳細については `TESTING.md` を参照してください。
