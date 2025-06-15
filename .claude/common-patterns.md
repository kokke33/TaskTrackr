# よく使うコマンドパターン

## 開発環境の起動・管理

### 開発サーバーの起動
```bash
# フロントエンド・バックエンド同時起動
npm run dev

# 本番環境での起動
npm run build && npm start

# TypeScript型チェック
npm run check
```

### データベース操作
```bash
# スキーマ変更の適用
npm run db:push

# データベース接続確認
psql $DATABASE_URL -c "\dt"
```

## よく使うファイル検索パターン

### コンポーネント関連の検索
```bash
# 特定のコンポーネントファイルを探す
find client/src/components -name "*.tsx" | grep -i "button"

# UIコンポーネントの一覧
ls client/src/components/ui/

# ページコンポーネントの確認
ls client/src/pages/
```

### API・サーバー関連の検索
```bash
# API ルートの確認
grep -r "app\." server/routes.ts

# データベーススキーマの確認
cat shared/schema.ts | grep -A 5 "export const"

# 環境変数の確認
grep -r "process.env" server/
```

## デバッグ・ログ確認パターン

### ログファイルの確認
```bash
# 開発サーバーのログ確認
tail -f logs/development.log

# AIサービスのログ確認
grep "AI_" logs/*.log

# エラーログの抽出
grep -i "error" logs/*.log | tail -20
```

### プロセス・ポート確認
```bash
# 開発サーバーのポート使用確認
lsof -i :3000

# Node.jsプロセスの確認
ps aux | grep node
```

## Git操作パターン

### 開発フロー
```bash
# 新機能ブランチの作成
git checkout -b feature/新機能名

# 変更の確認
git status
git diff

# コミット
git add .
git commit -m "feat: 新機能の説明"

# メインブランチへのマージ
git checkout main
git merge feature/新機能名
```

### トラブルシューティング
```bash
# 変更の取り消し
git checkout -- ファイル名

# 最新コミットの修正
git commit --amend

# 特定のコミットの確認
git show コミットハッシュ
```

## テスト・品質チェックパターン

### TypeScript チェック
```bash
# 型エラーの確認
npm run check 2>&1 | grep "error TS"

# 特定ファイルの型チェック
npx tsc --noEmit client/src/pages/project-form.tsx
```

### コード品質
```bash
# ESLint実行（設定されている場合）
npx eslint client/src/**/*.{ts,tsx}

# Prettier実行（設定されている場合）
npx prettier --check client/src/**/*.{ts,tsx}
```

## AI機能のテストパターン

### AI サービスの動作確認
```bash
# OpenAI APIキーの確認
echo $OPENAI_API_KEY | cut -c1-10

# Ollama サービスの確認
curl http://localhost:11434/api/tags

# AI ログの確認
tail -f logs/ai-service.log
```

### API エンドポイントのテスト
```bash
# 要約機能のテスト
curl -X POST http://localhost:3000/ai/summarize \
  -H "Content-Type: application/json" \
  -d '{"text":"テスト用のテキスト"}'

# チャット機能のテスト
curl -X POST http://localhost:3000/ai/chat \
  -H "Content-Type: application/json" \
  -d '{"message":"Hello"}'
```

## データベース管理パターン

### スキーマ確認
```bash
# テーブル一覧の確認
psql $DATABASE_URL -c "\dt"

# 特定テーブルの構造確認
psql $DATABASE_URL -c "\d projects"

# データ件数の確認
psql $DATABASE_URL -c "SELECT COUNT(*) FROM projects;"
```

### バックアップ・復元
```bash
# データベースバックアップ
pg_dump $DATABASE_URL > backup_$(date +%Y%m%d).sql

# バックアップから復元
psql $DATABASE_URL < backup_20240101.sql
```

## 環境設定パターン

### 環境変数の設定確認
```bash
# 必要な環境変数の確認
env | grep -E "(DATABASE_URL|SESSION_SECRET|AI_|OPENAI_|OLLAMA_)"

# .env ファイルの例
cat << EOF > .env.example
DATABASE_URL=postgres://user:pass@localhost:5432/tasktrackr
SESSION_SECRET=your-session-secret
AI_PROVIDER=openai
OPENAI_API_KEY=sk-your-key
EOF
```

### 依存関係の管理
```bash
# パッケージ更新の確認
npm outdated

# セキュリティ脆弱性の確認
npm audit

# 依存関係のインストール
npm install

# 開発依存関係の追加
npm install --save-dev @types/新しいライブラリ
```

## パフォーマンス監視パターン

### ビルドサイズの確認
```bash
# ビルド結果の確認
npm run build
du -sh dist/

# バンドルサイズの分析（設定されている場合）
npx vite-bundle-analyzer
```

### メモリ・CPU使用量の監視
```bash
# Node.jsプロセスのリソース使用量
top -p $(pgrep -f "node.*server")

# ディスク使用量の確認
df -h
du -sh node_modules/
```

## トラブルシューティング用コマンド集

### よくある問題の解決
```bash
# node_modules の再インストール
rm -rf node_modules package-lock.json
npm install

# ポート競合の解決
killall node
lsof -ti:3000 | xargs kill -9

# TypeScript キャッシュのクリア
rm -rf node_modules/.cache
```

### ログ収集
```bash
# システム情報の収集
uname -a > system_info.txt
node --version >> system_info.txt
npm --version >> system_info.txt

# 現在の設定状況の確認
env | grep -v "SECRET\|KEY\|PASSWORD" > current_env.txt
```