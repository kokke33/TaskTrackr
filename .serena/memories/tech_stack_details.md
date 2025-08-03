# TaskTrackr 技術スタック詳細

## フロントエンド技術
- **React 18** - メインフレームワーク
- **TypeScript** - 型安全性
- **Vite** - 高速ビルドツール
- **TailwindCSS** - ユーティリティファーストCSS
- **Wouter** - 軽量ルーティング
- **Shadcn/ui** - Radix UIベースの48+コンポーネント
- **TanStack Query (React Query)** - サーバー状態管理
- **React Hook Form + Zod** - フォーム処理とバリデーション

## バックエンド技術
- **Node.js v20.x** - ランタイム
- **Express** - Webフレームワーク
- **TypeScript** - 型安全性
- **Drizzle ORM** - タイプセーフORM
- **PostgreSQL** - メインデータベース（Neon.tech対応）
- **Passport.js** - 認証ライブラリ
- **express-session** - セッション管理
- **Winston** - ログ管理

## AI統合技術
- **OpenAI API** - GPTモデル
- **Ollama** - ローカルLLM
- **Google Gemini** - Google AI
- **Groq** - 高速推論
- **OpenRouter** - マルチプロバイダーアクセス

## 開発・テストツール
- **Vitest 3.2.4** - テストフレームワーク
- **React Testing Library** - Reactコンポーネントテスト
- **MSW (Mock Service Worker)** - APIモッキング
- **Happy DOM** - DOM環境シミュレーション
- **ESBuild** - バックエンドビルド
- **TSX** - TypeScript実行環境

## ビルド・デプロイ
- **統合サーバー構成** - 開発時は単一ポート5000で運用
- **ハイブリッドビルド** - フロントエンド（Vite）+ バックエンド（ESBuild）
- **本番最適化** - 環境変数による自動設定切り替え

## データベース設計
- **Drizzle ORM** - スキーマ定義とマイグレーション
- **PostgreSQL** - ACID準拠、高性能
- **セッション管理** - PostgreSQLセッションストア（MemoryStoreフォールバック）
- **ソフト削除** - isDeletedフラグによるデータ保護