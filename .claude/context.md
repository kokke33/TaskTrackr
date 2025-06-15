# プロジェクトコンテキスト

## プロジェクト名
TaskTrackr - タスク・プロジェクト管理システム

## 技術スタック
- **フロントエンド**: React 18 + TypeScript + Vite + TailwindCSS + Wouter（ルーティング）
- **バックエンド**: Express + TypeScript + Drizzle ORM + PostgreSQL
- **認証**: Passport.js（セッションベース認証）
- **UI**: Shadcn/ui コンポーネント（Radix UIプリミティブ）
- **状態管理**: TanStack Query（React Query）
- **AI統合**: OpenAI API / Ollama（設定可能なプロバイダー）

## プロジェクトの目標
- 包括的なタスクとプロジェクト管理システムの構築
- AI統合による文書要約と分析機能の提供
- 役割ベースのアクセス制御（管理者/一般ユーザー）
- 全文検索機能によるプロジェクト、ケース、レポートの検索
- 詳細な週次レポート機能と進捗追跡

## 主要な制約

### アーキテクチャ制約
- モノリシック構成（単一リポジトリでフロントエンドとバックエンドを管理）
- セッションベース認証（JWTではなく）
- PostgreSQL依存（Neon.tech互換性要件）

### 技術的制約
- TypeScript型エラーが既知の問題として存在（フォームの null 値処理）
- Drizzle ORMによるデータベーススキーマ管理必須
- Express.jsベースのRESTful API構造

### 運用制約
- 開発環境: `npm run dev`でフロントエンドとバックエンドを同時起動
- 本番環境: ビルドプロセスでVite（フロントエンド）+ ESBuild（バックエンド）
- データベースマイグレーション: Drizzle Kitを使用

## 技術選択の理由

### React + Wouter
- 軽量なルーティングライブラリとしてWouterを選択
- React Router の代替として、より軽量でシンプルな実装を重視

### Drizzle ORM
- 型安全性を重視したORM選択
- PostgreSQLとの親和性
- マイグレーション管理の簡素化

### TanStack Query
- サーバー状態管理の最適化
- キャッシュ戦略の改善
- APIデータ取得の効率化

### Shadcn/ui
- 一貫したデザインシステム
- Radix UIベースの高品質コンポーネント
- カスタマイズ性とメンテナンス性のバランス

## 環境設定要件
- Node.js環境
- PostgreSQL データベース
- AI プロバイダー（OpenAI または Ollama）
- セッション用シークレットキー

## 開発チーム構成
- 個人開発プロジェクト
- Claude Code による開発支援
- 日本語でのコミュニケーション必須