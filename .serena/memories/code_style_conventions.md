# TaskTrackr コードスタイルと規約

## TypeScript規約
- **厳密型チェック**: strict mode有効
- **型定義**: すべての関数とプロパティに適切な型注釈
- **import/export**: ES modules形式を使用
- **パスエイリアス**: 
  - `@/` - client/src/へのエイリアス
  - `@shared/` - shared/へのエイリアス

## ファイル命名規約
- **React コンポーネント**: PascalCase (`UserProfile.tsx`)
- **ページコンポーネント**: kebab-case (`weekly-report.tsx`)
- **ユーティリティ**: camelCase (`queryClient.ts`)
- **テストファイル**: `*.test.ts` または `*.spec.ts`
- **設定ファイル**: kebab-case (`vitest.config.ts`)

## React コンポーネント規約
- **関数コンポーネント**: アロー関数形式を推奨
- **Props型定義**: interfaceまたはtype aliasで明示的に定義
- **Export**: デフォルトエクスポート使用
- **Hooks**: カスタムフックは `use-` プレフィックス

## データベース規約
- **テーブル名**: 複数形 (`users`, `projects`)
- **カラム名**: スネークケース (`created_at`, `is_deleted`)
- **プライマリキー**: `id` (serial)
- **タイムスタンプ**: `createdAt`, `updatedAt` (camelCase in TypeScript)
- **ソフト削除**: `isDeleted` boolean フラグ使用

## API設計規約
- **RESTful**: 標準的なHTTPメソッド使用
- **レスポンス形式**: JSON
- **エラーハンドリング**: 適切なHTTPステータスコード
- **認証**: セッションベース認証（Passport.js）

## フォーム処理規約
- **バリデーション**: Zod + React Hook Form
- **null値対応**: `value={field.value ?? ""}` パターン使用
- **自動保存**: デバウンス付きで実装

## テスト規約
- **ファイル配置**: `tests/` ディレクトリ内
- **ユニットテスト**: `tests/unit/` 以下
- **統合テスト**: `tests/integration/` 以下
- **モック**: MSWを使用してAPIモック
- **アサーション**: `@testing-library/jest-dom` を使用

## ログ規約
- **Winston**: サーバーサイドログ
- **ログレベル**: debug, info, warn, error
- **AI専用ログ**: `ai-logger.ts` で管理
- **本番環境**: 自動的にログレベル最適化

## 環境設定規約
- **環境変数**: `.env` ファイルで管理
- **設定バリデーション**: Zodで型安全性確保
- **プロバイダー切り替え**: 環境変数による動的設定

## コメント・ドキュメント規約
- **JSDoc**: 複雑な関数には適用
- **inline コメント**: 複雑なロジックに説明追加
- **README**: 各機能モジュールに対応するドキュメント
- **型定義**: 明確な型名と説明