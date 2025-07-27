# Testing Guide - TaskTrackr

## 🧪 テストインフラ概要

TaskTrackrプロジェクトには包括的なテストインフラが構築されています。

### 技術スタック
- **テストフレームワーク**: Vitest 3.2.4
- **Reactテスト**: React Testing Library 16.3.0
- **DOM環境**: Happy DOM 18.0.1
- **モッキング**: MSW 2.10.4 (Mock Service Worker)
- **APIテスト**: Supertest 7.1.4
- **カバレッジ**: @vitest/coverage-v8 3.2.4

## 📁 ディレクトリ構造

```
tests/
├── unit/                    # ユニットテスト
│   ├── client/             # フロントエンドテスト
│   │   ├── components/     # Reactコンポーネント
│   │   │   └── ui/        # UIコンポーネント
│   │   └── utils.test.tsx  # ユーティリティ関数
│   └── server/             # バックエンドテスト
│       ├── basic.test.ts   # 基本機能
│       └── config.test.ts  # 設定管理
├── integration/            # 統合テスト
│   ├── api.test.ts        # APIエンドポイント
│   └── database.test.ts   # データベース操作
├── e2e/                   # E2Eテスト（将来拡張用）
├── __fixtures__/          # テストデータ
│   └── testData.ts        # モックデータ
├── __mocks__/             # モック定義
│   └── handlers.ts        # MSWハンドラー
├── utils/                 # テストユーティリティ
│   └── testUtils.tsx      # テストヘルパー関数
└── setup.ts              # テスト環境設定
```

## 🚀 テスト実行コマンド

### 基本実行

```bash
# 全テスト実行
npm test

# ユニットテストのみ
npm run test:unit

# 統合テストのみ
npm run test:integration

# ウォッチモード（開発時）
npm run test:watch

# カバレッジレポート付き
npm run test:coverage

# テストUI（ブラウザで結果表示）
npm run test:ui
```

### 個別実行

```bash
# 特定のファイル
npm test tests/unit/server/basic.test.ts

# パターンマッチ
npm test button

# 特定のテストケース
npm test -- --reporter=verbose
```

## 📊 現在のテスト状況

### ✅ 実行可能なテスト

- **ユニットテスト**: 26件 ✅ 全て成功
- **統合テスト**: 25件 ✅ 全て成功
- **カバレッジ**: 1.06% （初期設定済み）

### 🧪 テスト例

#### ユニットテスト
- サーバー設定検証
- ユーティリティ関数
- UIコンポーネント（Button）

#### 統合テスト
- データベース操作
- API エンドポイント

## 🔧 設定ファイル

### vitest.config.ts
```typescript
export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: "happy-dom",
    setupFiles: ["./tests/setup.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "client", "src"),
      "@shared": path.resolve(__dirname, "shared"),
    },
  },
});
```

### 環境変数 (.env.test)
```env
NODE_ENV=test
DATABASE_URL=postgresql://test:test@localhost:5432/tasktrackr_test
SESSION_SECRET=test_session_secret
AI_PROVIDER=test
```

## 🎯 テスト品質目標

| 項目 | 現在 | 目標 |
|------|------|------|
| テストカバレッジ | 1.06% | 80%+ |
| ユニットテスト | 26件 | 200件+ |
| 統合テスト | 25件 | 100件+ |
| E2Eテスト | 0件 | 20件+ |

## 📈 今後の拡張計画

### Phase 1: 基本機能テスト
- 認証システムテスト
- データベース操作テスト
- 基本UIコンポーネントテスト

### Phase 2: 機能テスト拡張
- プロジェクト管理機能
- 週次レポート機能
- AI統合機能

### Phase 3: E2Eテスト導入
- Playwright導入
- ユーザーシナリオテスト
- ブラウザ間互換性テスト

### Phase 4: パフォーマンステスト
- 負荷テスト
- レスポンス時間測定
- メモリ使用量監視

## 🐛 テスト時の注意点

### 既知の制限事項
- セキュリティ脆弱性が5件残存（非クリティカル）
- 現在のカバレッジは1.06%（テストインフラ構築完了段階）
- 実際のデータベース接続テストは未実装

### トラブルシューティング

```bash
# テストが失敗する場合
npm test -- --reporter=verbose

# キャッシュクリア
npm test -- --run --clearCache

# 特定の環境でテスト
NODE_ENV=test npm test
```

## 🔗 CI/CD統合

GitHub Actionsワークフローが設定済み：
- プルリクエスト時の自動テスト実行
- Node.js 18.x, 20.x でのマトリックステスト
- PostgreSQLデータベースサービス
- テストカバレッジレポート（Codecov連携）

## 📚 参考リンク

- [Vitest Documentation](https://vitest.dev/)
- [React Testing Library](https://testing-library.com/docs/react-testing-library/intro/)
- [MSW Documentation](https://mswjs.io/)
- [Happy DOM](https://github.com/capricorn86/happy-dom)

---

**注意**: このテストインフラは現在基盤が完成した段階です。今後、実際の機能に対応したテストケースを段階的に追加していく必要があります。