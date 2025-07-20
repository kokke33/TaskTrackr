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
12. [パフォーマンス](#パフォーマンス)
13. [ライセンス](#ライセンス)  

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
- **管理者編集時の並列AI処理**（処理時間30-50%短縮）
- **月次サマリー自動生成**

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

### 🚀 v2.2.0 (2025/1/20)
- **AIプロバイダー拡張**: 5つのAIプロバイダー対応（OpenAI、Ollama、Google Gemini、Groq、OpenRouter）
- **会議議事録機能**: 週次レポート専用の会議議事録管理機能を追加
- **リアルタイム分析**: フィールド別AI分析の設定とカスタマイズ機能
- **プロンプト管理**: 構造化されたプロンプトテンプレート管理システム
- **知識管理**: `.claude/`ディレクトリによる継続的な知識蓄積システム

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
| **状態管理** | TanStack Query (React Query) |
| **バックエンド** | Node.js, Express, TypeScript |
| **ORM** | Drizzle ORM + Drizzle Kit |
| **データベース** | PostgreSQL (Neon.tech対応) |
| **認証** | Passport.js + express-session |
| **AI統合** | OpenAI, Ollama, Google Gemini, Groq, OpenRouter |
| **バリデーション** | Zod + React Hook Form |
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
REALTIME_PROVIDER=gemini        # リアルタイム分析用プロバイダー
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
PORT=3000
NODE_ENV=development
```

---

## データベース初期化

```bash
# スキーマをデータベースにプッシュ
npm run db:push

# または手動でマイグレーション
npx drizzle-kit push
```

---

## 開発サーバ起動

```bash
# 統合開発サーバー（推奨）
npm run dev                    # http://localhost:5000

# 個別起動の場合
npm run dev:server            # バックエンド: http://localhost:3000  
npm run dev:client            # フロントエンド: http://localhost:5173
```

### 初期ユーザー

初回起動時に管理者ユーザーが自動作成されます：
- **ユーザー名**: `admin`
- **パスワード**: `password`

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

- **週次報告作成・編集時**: 自動でAI分析を実行
- **管理者編集時**: AI分析と議事録生成を並列実行
- **月次サマリー**: プロジェクト全体の進捗を要約

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
│   ├── storage.ts       # データベース操作 (Drizzle ORM)
│   ├── ai-service.ts    # AI プロバイダー抽象化
│   ├── ai-logger.ts     # AI インタラクション ログ
│   ├── ai-routes.ts     # AI専用ルート
│   ├── auth.ts          # Passport.js 認証設定
│   ├── config.ts        # 設定バリデーション
│   ├── ai-providers/    # AI プロバイダー実装
│   ├── prompts/         # AI プロンプトテンプレート
│   ├── use-cases/       # ビジネスロジック
│   └── migrations/      # データベース マイグレーション
├── shared/              # 共通TypeScript型定義
│   ├── schema.ts        # Drizzle ORM スキーマ定義
│   └── ai-constants.ts  # AI設定の共有定数
├── .claude/             # Claude Code 知識管理
│   ├── context.md       # プロジェクトコンテキスト
│   ├── project-knowledge.md # 技術知識
│   └── common-patterns.md   # 共通パターン
├── CLAUDE.md           # Claude Code用プロジェクト設定
├── .env.example        # 環境変数テンプレート
└── package.json        # プロジェクト設定
```

---

## パフォーマンス

### 最適化された機能

- **軽量版API**: デフォルトで必要最小限のデータのみ転送
- **適切なキャッシュ**: React Queryで2-5分間のインテリジェントキャッシュ
- **並列AI処理**: 管理者編集時の処理時間を30-50%短縮
- **検索制限**: 大量データでもレスポンシブな検索（20件制限）
- **データベース最適化**: インデックス活用とN+1問題解決

### 開発コマンド

```bash
npm run dev               # 統合開発サーバー起動
npm run build             # 本番ビルド (Vite + ESBuild)
npm run start             # 本番サーバー起動
npm run check             # TypeScript 型チェック
npm run db:push           # データベース スキーマ更新
```

---

## ライセンス

MIT License

---

## サポート

技術的な質問や機能要求は、GitHubのIssuesまでお気軽にお寄せください。