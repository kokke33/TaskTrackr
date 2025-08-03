# TaskTrackr 推奨コマンド一覧

## 基本開発コマンド
- `npm run dev` - 開発サーバー起動（統合サーバー: localhost:5000）
- `npm run build` - 本番ビルド（Viteフロントエンド + ESBuildバックエンド）
- `npm start` - 本番サーバー起動
- `npm run check` - TypeScript型チェック
- `npm run db:push` - Drizzle Kitを使用してデータベーススキーマ変更をプッシュ

## テストコマンド
- `npm test` - 全テスト実行（ユニット + 統合テスト、51件）
- `npm run test:unit` - ユニットテストのみ実行（26件）
- `npm run test:integration` - 統合テストのみ実行（25件）
- `npm run test:watch` - ウォッチモード（開発時）
- `npm run test:coverage` - カバレッジレポート付きテスト実行
- `npm run test:ui` - ブラウザでテスト結果表示

## 特定テスト実行例
- `npm test tests/unit/server/basic.test.ts` - 特定ファイルのテスト実行
- `npm test button` - パターンマッチによるテスト実行
- `npm test -- --reporter=verbose` - 詳細ログ付きテスト実行

## データベース関連
- `npx drizzle-kit push` - データベーススキーマの手動プッシュ
- `tsx server/index.ts` - サーバーの直接実行（デバッグ用）

## 重要な注意事項
- **統合サーバー設計**: 開発時は単一のExpressサーバーがポート5000でフロントエンドとバックエンドの両方を配信
- **個別起動不可**: フロントエンドとバックエンドを個別に起動するコマンドは存在しない
- **初期ユーザー**: 初回起動時に管理者ユーザー（admin/password）が自動作成される

## Linux システムコマンド
- `ls` - ファイル・ディレクトリ一覧表示
- `cd` - ディレクトリ移動
- `grep` - テキスト検索
- `find` - ファイル検索
- `git` - バージョン管理

## トラブルシューティング
- 型エラー発生時: `npm run check` で確認
- データベース接続エラー: 環境変数 `DATABASE_URL` を確認
- AI機能デバッグ: 環境変数 `AI_LOG_LEVEL=debug` に設定