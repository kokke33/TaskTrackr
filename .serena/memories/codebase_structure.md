# TaskTrackr コードベース構造

## ディレクトリ構成
```
TaskTrackr/
├── client/src/           # Reactフロントエンド
│   ├── components/       # 再利用可能なReactコンポーネント
│   │   ├── ui/          # Shadcn/uiコンポーネント（48+）
│   │   ├── ai-analysis-result.tsx      # AI分析結果表示
│   │   ├── case-selector-modal.tsx     # 案件選択モーダル
│   │   ├── previous-report-tooltip.tsx # 前回レポート比較機能
│   │   └── search-bar.tsx              # 全文検索機能
│   ├── pages/           # ページコンポーネント（Wouterルーティング）
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
│   ├── prompts/         # AIプロンプトテンプレート
│   ├── ai-providers/    # AIプロバイダー実装
│   └── use-cases/       # ビジネスロジック

├── shared/              # 共有TypeScript型定義
│   ├── schema.ts        # Drizzle ORMスキーマ定義
│   └── ai-constants.ts  # AI設定の共有定数

├── tests/               # テストファイル
│   ├── unit/           # ユニットテスト（26件）
│   │   ├── client/     # フロントエンドテスト
│   │   └── server/     # バックエンドテスト
│   ├── integration/    # 統合テスト（25件）
│   ├── __fixtures__/   # テストデータ
│   ├── __mocks__/      # MSWモック
│   ├── utils/          # テストユーティリティ
│   └── setup.ts        # テスト環境設定

├── .claude/             # Claude Code 知識管理
│   ├── context.md       # プロジェクトコンテキスト
│   ├── project-knowledge.md # 技術知識
│   └── common-patterns.md   # 共通パターン
```

## 重要なファイル
- **CLAUDE.md** - Claude Code用プロジェクト設定とガイダンス
- **package.json** - 依存関係とスクリプト定義
- **tsconfig.json** - TypeScript設定（パスエイリアス含む）
- **vitest.config.ts** - テスト設定
- **drizzle.config.ts** - データベース設定
- **.env.example** - 環境変数テンプレート

## データベーススキーマ主要テーブル
- **users** - 認証と役割ベースアクセス
- **projects** - プロジェクト情報
- **cases** - 案件情報
- **weeklyReports** - 週次報告書
- **managerMeetings** - 管理者会議記録
- **systemSettings** - システム設定