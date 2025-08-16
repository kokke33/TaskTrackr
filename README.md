# TaskTrackr

プロジェクト・案件・週次報告を一元管理し、AIによる分析・議事録生成・性能最適化を備えた **フルスタック TypeScript** アプリケーションです。  
React + Vite + TailwindCSS のモダンフロントエンドと、Express + Drizzle ORM + PostgreSQL のバックエンドで構成され、**5つのAIプロバイダー**（OpenAI / Ollama / Google Gemini / Groq / OpenRouter）を切り替えて利用できます。

---

## 目次
1. [主な機能](#主な機能)  
2. [最新の改善点](#最新の改善点)
3. [技術スタック](#技術スタック)  
4. [前提条件](#前提条件)  
5. [インストール](#インストール)  
6. [環境変数](#環境変数)  
7. [データベース初期化](#データベース初期化)  
8. [開発サーバ起動](#開発サーバ起動)  
9. [ビルド & 本番起動](#ビルド--本番起動)  
10. [AI 機能の使い方](#ai-機能の使い方)  
11. [ディレクトリ構成](#ディレクトリ構成)  
12. [セキュリティ・ベストプラクティス](#セキュリティベストプラクティス)
13. [パフォーマンス最適化ガイド](#パフォーマンス最適化ガイド)
14. [パフォーマンス](#パフォーマンス)
15. [ライセンス](#ライセンス)
16. [サポート](#サポート)  

---

## 主な機能

### 🎯 コア機能
- **プロジェクト・案件・週次報告の統合管理**
- **フルテキスト検索**（プロジェクト、案件、週次報告横断検索）
- **ロールベースアクセス制御**（管理者/一般ユーザー）
- **リアルタイム自動保存**

### 🤖 AI機能
- **週次報告のAI分析**（進捗確認・課題抽出・改善提案）
- **議事録自動生成**（週次報告確認会議）
- **管理者確認メール自動生成**（週次報告作成時に詳細確認メール作成）
- **管理者編集時の並列AI処理**（処理時間30-50%短縮）
- **リアルタイムストリーミング分析**（Gemini・OpenAI対応）
- **月次サマリー自動生成**
- **5つのAIプロバイダー切り替え**（動的構成管理・包括的ログシステム）

### 🎨 UI/UX改善
- **モーダルダイアログ式案件選択**（大量案件でも見切れない）
- **プロジェクト別・最近使用・全案件のタブ表示**
- **リアルタイム検索・フィルタリング機能**
- **レスポンシブデザイン対応**

### ⚡ パフォーマンス最適化
- **軽量版API**（週次報告・プロジェクト一覧の高速化）
- **適切なキャッシュ戦略**（React Query最適化）
- **データベースクエリ最適化**（検索制限・インデックス活用）
- **N+1問題解決**（月次サマリー生成の一括処理）

---

## 最新の改善点

### 🚀 v2.4.0 (2025/1/30) - テストインフラ・AI機能完全版
- **テストインフラ完備**: Vitest 3.2.4基盤の51テスト（ユニット26 + 統合25）実行環境
- **AI機能強化**: 管理者確認メール自動生成、ストリーミング対応（Gemini、OpenAI）
- **WebSocket通信**: リアルタイム機能とパフォーマンス監視の実装
- **ログシステム**: Winston + daily-rotate-fileによる包括的AI操作ログ
- **統合サーバー設計**: Express単一サーバーでフロントエンド・バックエンド統合運用

### 🚀 v2.3.0 (2025/1/30)
- **AIプロバイダー拡張完了**: 5つのAIプロバイダー対応（OpenAI、Ollama、Google Gemini、Groq、OpenRouter）
- **会議議事録機能**: 週次レポート専用の会議議事録管理機能を追加
- **リアルタイム分析**: フィールド別AI分析の設定とカスタマイズ機能
- **プロンプト管理**: 構造化されたプロンプトテンプレート管理システム
- **知識管理システム**: `.claude/`ディレクトリによる継続的な知識蓄積システム
- **WebSocket通信**: リアルタイム機能とパフォーマンス監視
- **テストインフラ**: Vitest 3.2.4基盤構築
- **管理者確認メール**: AI生成による詳細確認メール機能

### 🔧 技術改善
- **検索機能**: プロジェクト・案件検索に20件制限追加
- **データベース**: 軽量版クエリで必要最小限のフィールドのみ取得
- **エラーハンドリング**: 認証チェック時のブラウザログエラー解消
- **LocalStorage活用**: 最近使用した案件の履歴管理

---

## 技術スタック

| レイヤ | 使用技術 |
| ------ | -------- |
| **フロントエンド** | React 18, TypeScript, Vite, TailwindCSS, Wouter (ルーティング) |
| **UI コンポーネント** | Shadcn/ui (Radix UI 48+コンポーネント), Lucide React |
| **状態管理** | TanStack Query (React Query v5.60.5) |
| **バックエンド** | Node.js, Express, TypeScript |
| **ORM** | Drizzle ORM + Drizzle Kit |
| **データベース** | PostgreSQL (Neon.tech対応) |
| **認証** | Passport.js + express-session (PostgreSQL ↔ MemoryStore自動切替) |
| **AI統合** | OpenAI, Ollama, Google Gemini, Groq, OpenRouter (5プロバイダー) |
| **バリデーション** | Zod + React Hook Form |
| **WebSocket** | ws v8.18.0 (リアルタイム通信) |
| **ログシステム** | Winston + daily-rotate-file (AI専用ログ) |
| **テスト** | Vitest 3.2.4, React Testing Library, MSW, Supertest, Happy DOM |
| **開発ツール** | ESLint, TypeScript, TSX |

---

## 前提条件
- **Node.js v20.x 以降**  
- **npm v9.x** (or `pnpm`, `yarn`)  
- **PostgreSQL 15 以降** または **Neon.tech**アカウント
- AI機能を使う場合（いずれか1つ以上）  
  - **OpenAI API キー**
  - **Ollama ローカルサーバー**
  - **Google Gemini API キー**
  - **Groq API キー**
  - **OpenRouter API キー**

---

## インストール

```bash
git clone https://github.com/your-org/TaskTrackr.git
cd TaskTrackr
cp .env.example .env          # 環境変数を設定
npm install                   # 依存パッケージをインストール
```

---

## 環境変数

`.env` ファイルに以下の設定を行ってください：

```env
# Database
DATABASE_URL=postgres://user:pass@localhost:5432/tasktrackr
# または Neon.tech の場合
DATABASE_URL=postgresql://user:pass@host.neon.tech/dbname?sslmode=require

# Session
SESSION_SECRET=your-session-secret-here

# AI Provider (5つから選択)
AI_PROVIDER=gemini              # "openai", "ollama", "gemini", "groq", "openrouter"
REALTIME_PROVIDER=gemini        # リアルタイム分析用プロバイダー（注：設定キー名はREALTIME_PROVIDER）
AI_LOG_LEVEL=info
AI_LOG_CONSOLE=true
AI_LOG_FILE=false               # ファイルログを有効にする場合はtrue
AI_LOG_MASK_SENSITIVE=true      # 機密データのマスク化

# OpenAI Configuration (AI_PROVIDER=openai の場合)
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o-mini
OPENAI_MAX_TOKENS=10000
OPENAI_TEMPERATURE=0.7

# Ollama Configuration (AI_PROVIDER=ollama の場合)  
OLLAMA_BASE_URL=http://localhost:11434/
OLLAMA_MODEL=qwen3:latest

# Gemini Configuration (AI_PROVIDER=gemini の場合)
GEMINI_API_KEY=your-key
GEMINI_MODEL=gemini-2.5-flash   # または gemini-2.5-pro

# Groq Configuration (AI_PROVIDER=groq の場合)
GROQ_API_KEY=your-key
GROQ_MODEL=llama-3.3-70b-versatile

# OpenRouter Configuration (AI_PROVIDER=openrouter の場合)
OPENROUTER_API_KEY=sk-or-your-key
OPENROUTER_MODEL=anthropic/claude-3.5-sonnet
OPENROUTER_MAX_TOKENS=4000
OPENROUTER_TEMPERATURE=0.7

# Server Configuration
PORT=5000
NODE_ENV=development
```

---

## データベース初期化

### 自動初期化（推奨）

サーバー起動時に自動的にデータベースとスキーマが作成されます：

1. **データベースが存在しない場合**: 自動的に作成
2. **テーブルが存在しない場合**: 必要なテーブルとインデックスを自動作成
3. **初期ユーザー**: 管理者と一般ユーザーを自動作成

```bash
npm run dev  # 初回起動で全て自動設定
```

### 手動初期化（開発者向け）

```bash
# スキーマをデータベースにプッシュ
npm run db:push

# または手動でマイグレーション
npx drizzle-kit push
```

---

## 開発サーバ起動

```bash
# 統合開発サーバー（唯一の起動方法）
npm run dev                    # http://localhost:5000

# 注意：個別起動コマンドは存在しません
# npm run dev で統合サーバーが localhost:5000 で起動
```

### 初期ユーザー

初回起動時に以下のユーザーが自動作成されます：

#### 管理者アカウント
- **ユーザー名**: `admin`
- **パスワード**: `adminpassword`（本番では必ず変更）
- **権限**: 管理者（システム全体の管理機能・AI設定・全プロジェクト管理が可能）

#### 一般ユーザーアカウント
- **ユーザー名**: `ss7-1`
- **パスワード**: `ss7-1weeklyreport`
- **権限**: 一般ユーザー（週次報告の作成・編集・AI分析が可能）

> **セキュリティ注意**: 本番環境では必ずパスワードを変更してください。

---

## ビルド & 本番起動

```bash
# ビルド
npm run build                 # client → dist/, server → ESBuild

# 本番起動
npm start                     # NODE_ENV=production
```

---

## AI 機能の使い方

### エンドポイント

| メソッド | エンドポイント | 説明 |
|---------|---------------|------|
| `POST` | `/ai/summarize` | 文章要約・分析 |
| `POST` | `/ai/chat` | 汎用チャット |

### 自動AI機能

- **週次報告作成・編集時**: 自動でAI分析を実行（初回編集時のみ自動、以降は手動再生成）
- **管理者編集時**: AI分析と議事録生成を並列実行（処理時間30-50%短縮）
- **管理者確認メール**: 週次報告作成時に自動生成、レポート詳細画面で再生成可能
- **リアルタイムストリーミング**: Gemini・OpenAI使用時にリアルタイム分析結果表示
- **月次サマリー**: プロジェクト全体の進捗を要約（N+1問題解決済み）

### AI設定切り替え

環境変数 `AI_PROVIDER` で5つのプロバイダーを切り替え可能：

```env
AI_PROVIDER=openai      # OpenAI GPT使用
AI_PROVIDER=ollama      # ローカルOllama使用
AI_PROVIDER=gemini      # Google Gemini使用
AI_PROVIDER=groq        # Groq使用
AI_PROVIDER=openrouter  # OpenRouter使用
```

システム設定画面からもリアルタイムで切り替え可能です。

---

## ディレクトリ構成

```
TaskTrackr/
├── client/src/           # React フロントエンド
│   ├── components/       # UIコンポーネント
│   │   ├── ui/          # Shadcn/ui コンポーネント
│   │   └── case-selector-modal.tsx  # モーダル式案件選択
│   ├── pages/           # ページコンポーネント (Wouter ルーティング)
│   ├── lib/             # ユーティリティとauth設定
│   └── hooks/           # カスタムReactフック
├── server/              # Express バックエンド
│   ├── routes.ts        # API ルート定義
│   ├── storage.ts       # データベース操作 (Drizzle ORM + リトライロジック)
│   ├── ai-service.ts    # AI プロバイダー抽象化
│   ├── ai-logger.ts     # AI インタラクション ログ (Winston + daily-rotate)
│   ├── ai-routes.ts     # AI専用ルート
│   ├── auth.ts          # Passport.js 認証設定
│   ├── config.ts        # 設定バリデーション + 動的AI設定
│   ├── db.ts            # データベース接続設定
│   ├── websocket.ts     # WebSocket通信 (ws v8.18.0)
│   ├── ai-providers/    # AI プロバイダー実装 (5プロバイダー)
│   ├── prompts/         # AI プロンプトテンプレート
│   │   ├── config/      # 設定プロンプト
│   │   ├── core/        # コアプロンプト
│   │   └── reports/     # レポートプロンプト
│   ├── use-cases/       # ビジネスロジック
│   └── migrations/      # データベース マイグレーション
├── shared/              # 共通TypeScript型定義
│   ├── schema.ts        # Drizzle ORM スキーマ定義
│   └── ai-constants.ts  # AI設定の共有定数
├── tests/               # テストファイル
│   ├── unit/           # ユニットテスト
│   │   ├── client/     # フロントエンドテスト
│   │   └── server/     # バックエンドテスト
│   ├── integration/    # 統合テスト
│   ├── __fixtures__/   # テストデータ
│   ├── __mocks__/      # MSWモック
│   ├── utils/          # テストユーティリティ
│   └── setup.ts        # テスト環境設定
├── .claude/             # Claude Code 知識管理
│   ├── context.md       # プロジェクトコンテキスト
│   ├── project-knowledge.md # 技術知識
│   ├── project-improvements.md # 改善履歴と教訓
│   ├── common-patterns.md   # 共通パターン
│   └── debug-log.md     # 重要なデバッグ記録
├── CLAUDE.md           # Claude Code用プロジェクト設定
├── .env.example        # 環境変数テンプレート
└── package.json        # プロジェクト設定

### アーキテクチャの重要な特徴

#### 統合サーバー設計
- **単一ポート運用**: 開発・本番共にExpressサーバー単体でフロントエンド・バックエンド統合配信
- **ビルド戦略**: Viteでフロントエンド（→`dist/public/`）、ESBuildでバックエンド（→`dist/index.js`）
- **セッション管理**: PostgreSQL ↔ MemoryStore自動切替（Neon.tech互換性）

#### データベース設計
- **Drizzle ORM**: スキーマファースト設計＋自動リトライロジック
- **自動初期化**: スキーマ・初期ユーザー・必要テーブルの完全自動セットアップ
- **ソフトデリート**: isDeletedフラグによる論理削除パターン

### 既知の問題（2025年1月時点）

#### TypeScript型エラー
以下のフォームバリュー型エラーが現在発生中：
- `client/src/pages/weekly-report.tsx` - Textareaコンポーネントが`null`値を受信
- `server/routes.ts` - Userオブジェクトプロパティアクセスの問題

**回避策**: フォームフィールドで`value={field.value ?? ""}`パターンを使用

#### 解決方法
- `npm run check`でTypeScript型チェック実行
- データベースフィールドはnullable定義だが、Reactコンポーネントは非null期待値の不整合

---

## セキュリティ・ベストプラクティス

### 認証・セッション管理
- **Passport.js基盤**: セッションベース認証とPostgreSQLセッションストア採用
- **自動フォールバック**: Neon.tech環境でのMemoryStore自動切替機能
- **セッション有効期限**: 適切なCookie設定とセッション期限管理
- **初期管理者アカウント**: 本番環境では必ずパスワード変更（admin/adminpassword → 強力なパスワード）

### データベースセキュリティ
- **クエリインジェクション対策**: Drizzle ORMによる自動的な保護機能
- **入力値検証**: Zodによる適切なバリデーション処理
- **ソフトデリート**: isDeletedフラグによるデータ保護パターン

### AI統合セキュリティ
- **環境変数管理**: APIキーの適切な管理と自動マスク化機能
- **プロンプトインジェクション対策**: AI応答のコンテンツクリーニング（`<think>`タグ除去）
- **ログ保護**: 機密データの自動マスク化とログレベル管理

---

## パフォーマンス最適化ガイド

### フロントエンド最適化
- **適切なキャッシュ戦略**: React Queryによる2-5分間のインテリジェントキャッシュ
- **コンポーネント分割**: 適切なレンダリング最適化とコンポーネント分離
- **検索制限**: 大規模データセットでのページネーション（20件制限）

### バックエンド最適化
- **データベースクエリ最適化**: 必要最小限フィールドの取得（軽量版API）
- **N+1問題解決**: バッチデータ取得による問題解決
- **AI処理の並列化**: 管理者編集時の並列AI処理による30-50%の処理時間短縮

---

## パフォーマンス

### 最適化された機能

- **軽量版API**: デフォルトで必要最小限のデータのみ転送
- **適切なキャッシュ**: React Queryで2-5分間のインテリジェントキャッシュ
- **並列AI処理**: 管理者編集時の処理時間を30-50%短縮
- **検索制限**: 大量データでもレスポンシブな検索（20件制限）
- **データベース最適化**: インデックス活用とN+1問題解決

### 開発コマンド

#### 基本開発コマンド
```bash
npm run dev               # 統合開発サーバー起動 (localhost:5000)
npm run build             # 本番ビルド (Vite + ESBuild)
npm start                 # 本番サーバー起動
npm run check             # TypeScript 型チェック
npm run db:push           # データベース スキーマ更新 (Drizzle Kit)
tsx server/index.ts       # サーバー直接実行 (デバッグ用)
```

#### テストコマンド
```bash
npm test                         # 全テスト実行（51件）
npm run test:unit               # ユニットテスト（26件）
npm run test:integration        # 統合テスト（25件）
npm run test:watch              # ウォッチモード (開発時)
npm run test:coverage           # カバレッジレポート生成
npm run test:ui                 # ブラウザでテスト結果表示

# 特定のテスト実行
npm test tests/unit/server/basic.test.ts  # 特定ファイル
npm test button                           # パターンマッチング
npm test -- --reporter=verbose           # 詳細ログ付き実行
```

#### 重要：統合サーバー設計
- **統一ポート設定**: 開発時は単一のExpressサーバーがポート5000でフロントエンド・バックエンド両方を配信
- **個別起動なし**: フロントエンドとバックエンドを個別に起動するコマンドは存在しません
- **ビルド出力**: フロントエンドは `dist/public/`、バックエンドは `dist/index.js` に出力

---

## ライセンス

MIT License

---

## サポート

技術的な質問や機能要求は、GitHubのIssuesまでお気軽にお寄せください。