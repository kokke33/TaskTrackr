# TaskTrackr プロジェクトコンテキスト

## プロジェクト概要
TaskTrackerは、プロジェクト・案件・週次報告を一元管理し、AIによる分析・議事録生成・性能最適化を備えたフルスタック TypeScript アプリケーションです。

## 技術スタック (2025年1月最新)
- **フロントエンド**: React 18 + TypeScript + Vite + TailwindCSS + Wouter（ルーティング）
- **バックエンド**: Express + TypeScript + Drizzle ORM + PostgreSQL
- **認証**: Passport.js（セッションベース認証）+ 自動フォールバック
- **UI**: Shadcn/ui（48+コンポーネント利用可能）+ Radix UIプリミティブ
- **状態管理**: TanStack Query（React Query v5.60.5）
- **AI統合**: 5つのプロバイダー対応（OpenAI, Ollama, Gemini, Groq, OpenRouter）
- **WebSocket**: リアルタイム機能（ws v8.18.0）
- **テスト**: Vitest 3.2.4 + React Testing Library + MSW + Supertest

## プロジェクトの目標
- 包括的なタスクとプロジェクト管理システムの構築
- AI統合による文書要約と分析機能の提供
- 役割ベースのアクセス制御（管理者/一般ユーザー）
- 全文検索機能によるプロジェクト、ケース、レポートの検索
- 詳細な週次レポート機能と進捗追跡

## 主要な制約

### アーキテクチャ制約
- **統合サーバー設計**: フロント・バックエンドを個別起動するコマンドは存在しない
- **セッションベース認証**: JWTではなく、PostgreSQL→MemoryStoreの自動フォールバック
- **PostgreSQL依存**: Neon.tech互換性 + 接続リトライロジック実装済み

### 技術的制約
- **TypeScript型エラー**: フォームのnull値ハンドリング（既知の問題）
  - `client/src/pages/weekly-report.tsx`のTextarea対応
  - `server/routes.ts`のユーザーオブジェクトアクセス
- **Drizzle ORM**: スキーマ管理とマイグレーション必須
- **RESTful API**: Express.js + 軽量版API実装

### 運用制約
- **開発環境**: `npm run dev`で統合サーバー起動（ポート5000）
- **本番環境**: Vite（フロント→dist/public/）+ ESBuild（バック→dist/index.js）
- **データベース**: `npm run db:push`でDrizzle Kitマイグレーション
- **テスト**: 51件のテスト（現在カバレッジ1.06%、基盤構築完了）

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

## 現在の主要機能（2025年1月時点）

### コア機能
- **プロジェクト・案件・週次報告の統合管理**
- **フルテキスト検索**（20件制限で高速化）
- **ロールベースアクセス制御**（管理者/一般ユーザー）
- **リアルタイム自動保存** + WebSocket通信

### AI機能（5プロバイダー対応）
- **週次報告のAI分析**（フィールド別分析、リアルタイム設定）
- **議事録自動生成**（管理者確認メール含む）
- **管理者編集時の並列AI処理**（30-50%高速化）
- **ストリーミング対応**（Gemini、OpenAI）

### UI/UX改善
- **モーダル式案件選択**（プロジェクト別・最近使用・全案件タブ）
- **前回レポート比較ツールチップ**
- **レスポンシブデザイン**（TailwindCSS + Shadcn/ui）

### パフォーマンス最適化
- **軽量版API**（必要最小限フィールドのみ転送）
- **React Query最適化**（2-5分間キャッシュ）
- **N+1問題解決**（一括データ取得）
- **データベースインデックス最適化**

## 環境設定要件
- **Node.js**: v20.x以降（TypeScript 5.6.3）
- **データベース**: PostgreSQL 15以降またはNeon.tech
- **AI プロバイダー**: 以下から1つ以上
  - OpenAI（GPT-4o-mini推奨）
  - Google Gemini（2.5-Flash推奨）
  - Groq（Llama-3.3-70B）
  - Ollama（ローカル実行）
  - OpenRouter（Claude-3.5-Sonnet）
- **セッション用シークレットキー**
- **ログ設定**: AI_LOG_LEVEL（debug/info/warn/error）

## 開発チーム構成
- **個人開発プロジェクト**
- **Claude Code による開発支援**
- **日本語でのコミュニケーション必須**
- **継続的知識管理**（`.claude/`ディレクトリシステム）