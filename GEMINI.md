**GEMINI.md**

## プロジェクト概要

TaskTrackr は、プロジェクト、案件、週次報告の一元管理を目的としたフルスタック TypeScript アプリケーションです。AI による分析、議事録生成、性能最適化といった高度な機能を備えています。

**主要技術スタック:**
*   **フロントエンド:** React 18, TypeScript, Vite, TailwindCSS, Wouter (ルーティング), Shadcn/ui (UI コンポーネント), TanStack Query (状態管理)。
*   **バックエンド:** Node.js, Express, TypeScript, Drizzle ORM, PostgreSQL。
*   **認証:** Passport.js, express-session。
*   **AI 連携:** OpenAI, Ollama, Google Gemini, Groq, OpenRouter をサポート。
*   **バリデーション:** Zod, React Hook Form。
*   **開発ツール:** ESLint, TypeScript, TSX, Vitest。

本アプリケーションは、全文検索、ロールベースのアクセス制御、リアルタイム自動保存といったコア機能を提供します。AI 機能としては、週次報告の分析、会議議事録の自動生成、管理者編集時の並列 AI 処理、月次サマリーの生成などがあります。パフォーマンス最適化にも重点を置いており、軽量 API、キャッシュ戦略、データベースクエリの最適化などが図られています。

## ビルドと実行

本プロジェクトは、依存関係の管理とスクリプトの実行に `npm` を使用しています。

**前提条件:**
*   Node.js v20.x 以降
*   npm v9.x (または pnpm, yarn)
*   PostgreSQL 15 以降 (または Neon.tech アカウント)
*   AI 機能を使用する場合、OpenAI, Ollama, Google Gemini, Groq, OpenRouter のいずれか 1 つ以上の API キー/サーバー。

**インストール:**

```bash
git clone https://github.com/your-org/TaskTrackr.git
cd TaskTrackr
cp .env.example .env          # 環境変数を設定
npm install                   # 依存パッケージをインストール
```

**環境変数:**
`.env.example` に基づいて `.env` ファイルを設定してください。主要な変数には `DATABASE_URL`、`SESSION_SECRET`、`AI_PROVIDER` およびそれぞれの API キー/設定が含まれます。

**データベース初期化:**

```bash
npm run db:push               # スキーマをデータベースにプッシュ
# または手動で:
npx drizzle-kit push
```

**開発サーバー:**
統合開発サーバーは `http://localhost:5000` で動作します。

```bash
npm run dev                   # 統合開発サーバーを起動
```

*初期管理者ユーザー:* 初回起動時に、ユーザー名 `admin`、パスワード `password` の管理者ユーザーが自動的に作成されます。

**本番環境向けビルド:**

```bash
npm run build                 # クライアント (Vite) とサーバー (ESBuild) をビルド
```

**本番環境での実行:**

```bash
npm start                     # 本番サーバーを起動 (NODE_ENV=production)
```

## 開発規約

*   **言語:** プロジェクト全体でフロントエンドとバックエンドの両方に TypeScript が使用されています。
*   **リンティングとフォーマット:** コードの品質と一貫性のために ESLint が使用されています。
*   **テスト:** Vitest がテストフレームワークとして使用されており、ユニットテストと統合テスト用の専用スクリプトがあります。
    *   `npm test`: 全てのテスト (51 件) を実行します。
    *   `npm run test:unit`: ユニットテスト (26 件) を実行します。
    *   `npm run test:integration`: 統合テスト (25 件) を実行します。
    *   `npm run test:coverage`: カバレッジレポートを生成します。
*   **型チェック:** TypeScript の型チェックは `npm run check` で実行できます。
*   **データベースマイグレーション:** Drizzle Kit がデータベーススキーマ管理とマイグレーションに使用されています。
*   **コード構造:** プロジェクトは `client/`、`server/`、`shared/` ディレクトリで明確に役割が分離されています。AI 関連のロジックは `server/ai-service.ts` に抽象化され、特定のプロバイダーは `server/ai-providers/` にあります。プロンプトは `server/prompts/` で管理されます。
*   **パフォーマンス:** 軽量 API、React Query を使用したインテリジェントなキャッシュ、並列 AI 処理、データベースクエリの最適化など、パフォーマンス最適化が重要な側面となっています。
*   **ドキュメント:** `.claude/` ディレクトリや様々な Markdown ファイル (`API.md`, `DEVELOPMENT.md`, `TESTING.md`, `USER_GUIDE.md`) の存在は、内部ドキュメントと知識管理に重点が置かれていることを示しています。