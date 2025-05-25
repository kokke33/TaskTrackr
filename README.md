# TaskTrackr

タスク・案件・週次報告を一元管理し、AI で記述支援や要約まで行える **フルスタック TypeScript** アプリケーションです。  
React + Vite + TailwindCSS の軽量フロントと、Express + Drizzle ORM + PostgreSQL のバックエンドで構成され、OpenAI / Ollama いずれかの LLM を切り替えて利用できます。

---

## 目次
1. [主な機能](#主な機能)  
2. [技術スタック](#技術スタック)  
3. [前提条件](#前提条件)  
4. [インストール](#インストール)  
5. [環境変数](#環境変数)  
6. [データベース初期化](#データベース初期化)  
7. [開発サーバ起動](#開発サーバ起動)  
8. [ビルド & 本番起動](#ビルド--本番起動)  
9. [AI 機能の使い方](#ai-機能の使い方)  
10. [ディレクトリ構成](#ディレクトリ構成)  
11. [ライセンス](#ライセンス)  

---

## 主な機能
- **案件／プロジェクト／週次報告 CRUD**  
- **AI 連携**  
  - 報告書や議事録の要約・トークン試算  
  - 入力チェック／バリデーションエラーの日本語化  
- **フルテキスト検索**（`/search`）  
- **認証／セッション管理**（Passport + express-session）  
- **リアルタイムプレビュー**：変更を即座に WebSocket 配信  

---

## 技術スタック
| レイヤ | 使用技術 |
| ------ | -------- |
| フロント | React 18 / TypeScript / Vite / TailwindCSS / Wouter |
| バックエンド | Node.js / Express / Drizzle ORM / Zod |
| DB | PostgreSQL |
| AI | OpenAI GPT-3.5/4, Ollama (Llama2 ほか) |
| 開発サポート | ESLint, Prettier, ts-node, Vitest |

---

## 前提条件
- **Node.js v20.x 以降**  
- **npm v9.x** (or `pnpm`, `yarn`)  
- **PostgreSQL 15 以降**  
- AI を使う場合  
  - OpenAI API キー **または** Ollama ローカルサーバ

---

## インストール
```bash
git clone https://github.com/your-org/TaskTrackr.git
cd TaskTrackr
cp .env.example .env          # 必要項目を編集
npm install                   # 依存パッケージを取得

```

----------

## 環境変数

`.env.example` にすべての項目がコメント付きで用意されています。最低限次を設定してください。

```env
# AI
AI_PROVIDER=openai            # or "ollama"
OPENAI_API_KEY=sk-...
# Database
DATABASE_URL=postgres://user:pass@localhost:5432/tasktrackr
# Session
SESSION_SECRET=some-random-string

```

----------

## データベース初期化

```bash
npx drizzle-kit push          # テーブルを自動生成
# もしくは
npm run db:migrate

```

----------

## 開発サーバ起動

ターミナルを 2 つ開いて実行します。

```bash
# ① バックエンド
npm run dev:server            # http://localhost:3000

# ② フロントエンド
npm run dev:client            # http://localhost:5173

```

ルートスクリプト `npm run dev` で **concurrently** まとめ起動も可能です。

----------

## ビルド & 本番起動

```bash
npm run build                 # client → dist/, server → tsx ビルド
npm start                     # NODE_ENV=production で起動

```

Docker でのデプロイ例は `attached_assets/docker-compose.yml` を参照してください（存在する場合）。

----------

## AI 機能の使い方

-   詳細は `AI_INTEGRATION_GUIDE.md` と `AI_LOGGING_GUIDE.md` を参照

-   主要エンドポイント

    メソッド

    エンドポイント

    説明

    `POST`

    `/ai/summarize`

    文章要約

    `POST`

    `/ai/chat`

    汎用チャット (システム・ユーザプロンプト指定可)


----------

## ディレクトリ構成

```
TaskTrackr/
├─ client/            # React フロント
│  ├─ src/
│  │  ├─ pages/       # .../weekly-report-list.tsx 等
│  │  └─ components/
├─ server/            # Express API
│  ├─ routes.ts
│  ├─ db.ts           # Drizzle ORM 設定
│  └─ migrations.ts
├─ shared/            # 共通型定義・ユーティリティ
├─ .env.example
├─ package.json
└─ tsconfig.json

```

