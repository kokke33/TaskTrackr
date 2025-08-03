# TaskTrackr プロジェクト概要

## プロジェクトの目的
TaskTrackrは、プロジェクト・案件・週次報告を一元管理し、AIによる分析・議事録生成・性能最適化を備えたフルスタック TypeScript アプリケーションです。

## 主要機能
- **プロジェクト・案件・週次報告の統合管理**
- **フルテキスト検索**（プロジェクト、案件、週次報告横断検索）
- **ロールベースアクセス制御**（管理者/一般ユーザー）
- **リアルタイム自動保存**
- **AI機能**: 週次報告のAI分析、議事録自動生成、管理者編集時の並列AI処理
- **モーダルダイアログ式案件選択**（大量案件でも見切れない）
- **レスポンシブデザイン対応**

## 技術スタック概要
- **フロントエンド**: React 18 + TypeScript + Vite + TailwindCSS + Wouter（ルーティング）
- **UI コンポーネント**: Shadcn/ui (Radix UI 48+コンポーネント)
- **状態管理**: TanStack Query (React Query)
- **バックエンド**: Node.js + Express + TypeScript
- **ORM**: Drizzle ORM + Drizzle Kit
- **データベース**: PostgreSQL (Neon.tech対応)
- **認証**: Passport.js + express-session
- **AI統合**: 5つのプロバイダー（OpenAI、Ollama、Google Gemini、Groq、OpenRouter）
- **バリデーション**: Zod + React Hook Form
- **テスト**: Vitest 3.2.4 + React Testing Library + MSW + 51件のテスト

## 最新の改善点（v2.3.0 - 2025/1/30）
- AIプロバイダー拡張完了（5つのプロバイダー対応）
- 会議議事録機能追加
- リアルタイム分析機能
- プロンプト管理システム
- 知識管理システム（.claude/ディレクトリ）
- WebSocket通信によるリアルタイム機能
- テストインフラ整備（51件のテスト基盤）
- 管理者確認メール機能