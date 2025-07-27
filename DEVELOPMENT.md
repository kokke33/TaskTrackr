# TaskTrackr 開発者ガイド

## 📚 目次
1. [開発環境セットアップ](#開発環境セットアップ)
2. [アーキテクチャ概要](#アーキテクチャ概要)
3. [開発ワークフロー](#開発ワークフロー)
4. [コーディング規約](#コーディング規約)
5. [テスト戦略](#テスト戦略)
6. [デバッグ・トラブルシューティング](#デバッグトラブルシューティング)
7. [パフォーマンス最適化](#パフォーマンス最適化)
8. [セキュリティ考慮事項](#セキュリティ考慮事項)
9. [デプロイメント](#デプロイメント)
10. [監視・ログ](#監視ログ)

---

## 開発環境セットアップ

### 📋 前提条件
```bash
# バージョン確認
node --version    # v20.x以降
npm --version     # v9.x以降
psql --version    # PostgreSQL 15以降
```

### 🚀 初期セットアップ

#### 1. リポジトリクローン
```bash
git clone https://github.com/your-org/TaskTrackr.git
cd TaskTrackr
```

#### 2. 依存関係インストール
```bash
npm install
```

#### 3. 環境変数設定
```bash
cp .env.example .env
# .envファイルを編集（詳細はREADME.md参照）
```

#### 4. データベース初期化
```bash
# PostgreSQLサーバー起動確認
pg_ctl status

# スキーマプッシュ
npm run db:push
```

#### 5. 開発サーバー起動
```bash
npm run dev
# http://localhost:5000 でアクセス
```

### 🛠️ 推奨開発ツール

#### VSCode拡張機能
```json
{
  "recommendations": [
    "bradlc.vscode-tailwindcss",
    "esbenp.prettier-vscode",
    "ms-vscode.vscode-typescript-next",
    "bradlc.vscode-tailwindcss",
    "ms-playwright.playwright",
    "vitest.explorer"
  ]
}
```

#### 設定ファイル
```json
// .vscode/settings.json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "typescript.preferences.importModuleSpecifier": "relative",
  "tailwindCSS.includeLanguages": {
    "typescript": "javascript",
    "typescriptreact": "javascript"
  }
}
```

---

## アーキテクチャ概要

### 🏗️ システム構成

```
┌─────────────────┐    HTTP/WebSocket    ┌──────────────────┐
│   Frontend      │ ◄─────────────────► │   Backend        │
│   React + Vite  │                     │   Express + TS   │
└─────────────────┘                     └──────────────────┘
         │                                        │
         │                                        │
    ┌─────────┐                            ┌──────────────┐
    │ Browser │                            │ PostgreSQL   │
    │ Storage │                            │ Database     │
    └─────────┘                            └──────────────┘
                                                   │
                                           ┌──────────────┐
                                           │ AI Services  │
                                           │ Multi-provider│
                                           └──────────────┘
```

### 📁 ディレクトリ構造詳細

```
TaskTrackr/
├── client/src/              # React フロントエンド
│   ├── components/          # 再利用可能コンポーネント
│   │   ├── ui/             # shadcn/ui プリミティブ
│   │   └── weekly-report/  # 週次レポート専用コンポーネント
│   ├── pages/              # ページレベルコンポーネント
│   ├── hooks/              # カスタムReactフック
│   ├── contexts/           # React Context (WebSocket等)
│   ├── lib/                # ユーティリティ・設定
│   └── utils/              # 純粋関数・ヘルパー
├── server/                 # Express バックエンド
│   ├── ai-providers/       # AI プロバイダー実装
│   ├── prompts/            # AI プロンプトテンプレート
│   ├── use-cases/          # ビジネスロジック層
│   ├── migrations/         # データベースマイグレーション
│   ├── routes.ts           # API ルート定義
│   ├── storage.ts          # データアクセス層
│   ├── ai-service.ts       # AI サービス抽象化
│   └── config.ts           # 設定管理
├── shared/                 # フロント・バック共有
│   ├── schema.ts           # Drizzle スキーマ定義
│   ├── ai-constants.ts     # AI設定定数
│   └── logger.ts           # 共通ログユーティリティ
├── tests/                  # テストファイル
│   ├── unit/               # ユニットテスト
│   ├── integration/        # 統合テスト
│   └── e2e/                # E2Eテスト（将来）
└── .claude/                # Claude Code 知識管理
```

### 🔄 データフロー

#### 1. リクエストフロー
```
Client Request → Express Router → Middleware → Route Handler
                                      ↓
Storage Layer ← Business Logic ← Validation
      ↓
Database/External API → Response → Client
```

#### 2. AI処理フロー
```
User Input → AI Service Abstract → Provider-Specific Implementation
                                            ↓
External AI API ← Prompt Template ← Context Preparation
      ↓
Response Processing → Content Cleaning → Client Display
```

---

## 開発ワークフロー

### 🌟 Git ワークフロー

#### ブランチ戦略
```
main          ◄─── Production ready
├── develop   ◄─── Integration branch
│   ├── feature/user-management
│   ├── feature/ai-improvement
│   └── bugfix/login-issue
└── hotfix/   ◄─── Critical production fixes
```

#### コミットメッセージ規約
```bash
# 形式: <type>(<scope>): <description>
# 例:
feat(auth): ユーザーロール管理機能を追加
fix(api): 週次レポート保存時のバリデーションエラーを修正
docs(readme): AI設定手順を更新
test(unit): Button コンポーネントのテストを追加
refactor(storage): クエリ最適化とN+1問題解決
perf(ui): レンダリング最適化で応答速度30%向上
```

#### プルリクエスト手順
1. **機能ブランチ作成**
   ```bash
   git checkout -b feature/new-feature develop
   ```

2. **開発・テスト**
   ```bash
   npm run test
   npm run check  # TypeScript型チェック
   npm run build  # ビルド確認
   ```

3. **プルリクエスト作成**
   - 変更内容の詳細説明
   - テスト結果の記載
   - スクリーンショット（UI変更の場合）
   - 関連Issue番号

4. **レビュー対応**
   - コードレビューでの指摘対応
   - CI/CDチェック通過確認

### 🔄 開発サイクル

#### 日常開発フロー
```bash
# 1. 最新develop取得
git checkout develop
git pull origin develop

# 2. 機能ブランチ作成
git checkout -b feature/your-feature

# 3. 開発環境起動
npm run dev

# 4. 開発・テスト
# ... コーディング ...
npm run test:watch  # テスト監視

# 5. コミット
git add .
git commit -m "feat: 新機能実装"

# 6. プッシュ・PR作成
git push origin feature/your-feature
```

---

## コーディング規約

### 📝 TypeScript規約

#### 命名規則
```typescript
// ファイル名: kebab-case
case-selector-modal.tsx
weekly-report-form.ts

// 変数・関数: camelCase
const userName = 'admin';
function getUserInfo() { }

// 型・インターフェース・クラス: PascalCase
interface UserInfo { }
type WeeklyReportStatus = 'draft' | 'submitted';
class AIService { }

// 定数: UPPER_SNAKE_CASE
const MAX_RETRY_COUNT = 3;
const AI_PROVIDERS = ['openai', 'gemini'] as const;
```

#### インポート順序
```typescript
// 1. React/外部ライブラリ
import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';

// 2. UI コンポーネント
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';

// 3. 内部コンポーネント
import CaseSelectorModal from '@/components/case-selector-modal';

// 4. フック・ユーティリティ
import { useAuth } from '@/lib/auth';
import { cn } from '@/lib/utils';

// 5. 型定義
import type { Case, WeeklyReport } from '@shared/schema';
```

#### 型定義のベストプラクティス
```typescript
// ✅ 良い例: 明確な型定義
interface WeeklyReportFormData {
  caseId: number;
  weekStartDate: string;
  progressSummary: string;
  tasksCompleted?: string;  // オプショナル
}

// ✅ 良い例: Union型の活用
type AIProvider = 'openai' | 'gemini' | 'groq' | 'ollama' | 'openrouter';

// ✅ 良い例: Generics活用
interface ApiResponse<T> {
  data: T;
  success: boolean;
  error?: string;
}

// ❌ 悪い例: any の使用
function processData(data: any): any {
  return data;
}
```

### 🎨 React/JSX規約

#### コンポーネント設計
```typescript
// ✅ 良い例: プロップス型定義と分離
interface CaseSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (case_: Case) => void;
  cases: Case[];
  selectedCaseId?: number;
}

export default function CaseSelectorModal({
  isOpen,
  onClose,
  onSelect,
  cases,
  selectedCaseId
}: CaseSelectorModalProps) {
  // コンポーネント実装
}
```

#### フック使用パターン
```typescript
// ✅ 良い例: カスタムフック分離
function useWeeklyReportForm(initialData?: Partial<WeeklyReport>) {
  const [data, setData] = useState<WeeklyReportFormData>(() => ({
    caseId: initialData?.caseId ?? 0,
    weekStartDate: initialData?.weekStartDate ?? '',
    progressSummary: initialData?.progressSummary ?? '',
  }));

  const updateField = useCallback((field: keyof WeeklyReportFormData, value: string | number) => {
    setData(prev => ({ ...prev, [field]: value }));
  }, []);

  return { data, updateField };
}
```

### 🎯 CSS/スタイリング規約

#### Tailwind CSS パターン
```typescript
// ✅ 良い例: cn()ユーティリティでのクラス結合
import { cn } from '@/lib/utils';

const buttonVariants = {
  primary: 'bg-blue-600 hover:bg-blue-700 text-white',
  secondary: 'bg-gray-100 hover:bg-gray-200 text-gray-900',
  danger: 'bg-red-600 hover:bg-red-700 text-white'
};

function Button({ variant = 'primary', className, ...props }) {
  return (
    <button
      className={cn(
        'px-4 py-2 rounded-md font-medium transition-colors',
        buttonVariants[variant],
        className
      )}
      {...props}
    />
  );
}
```

### 🔒 セキュリティ規約

#### 入力値検証
```typescript
// ✅ 良い例: Zodによる型安全な検証
import { z } from 'zod';

const weeklyReportSchema = z.object({
  caseId: z.number().positive(),
  weekStartDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  progressSummary: z.string().min(1).max(2000),
});

function validateWeeklyReport(data: unknown) {
  return weeklyReportSchema.safeParse(data);
}
```

#### 機密情報処理
```typescript
// ✅ 良い例: 環境変数からの安全な読み込み
const aiConfig = {
  provider: process.env.AI_PROVIDER!,
  apiKey: process.env.OPENAI_API_KEY!, // サーバーサイドのみ
};

// ❌ 悪い例: クライアントサイドでAPIキー露出
const OPENAI_KEY = 'sk-...'; // 絶対に避ける
```

---

## テスト戦略

### 🧪 テスト構成

#### テストピラミッド
```
        ┌─────────────┐
        │   E2E Tests │  ← 少数、重要なユーザージャーニー
        └─────────────┘
      ┌─────────────────┐
      │ Integration Tests│  ← API・DB統合テスト
      └─────────────────┘
  ┌─────────────────────────┐
  │     Unit Tests          │  ← 大多数、高速実行
  └─────────────────────────┘
```

#### テストファイル命名
```
src/components/Button.tsx        → tests/unit/client/components/Button.test.tsx
server/routes.ts                 → tests/integration/api.test.ts
server/storage.ts               → tests/unit/server/storage.test.ts
```

### 🔬 ユニットテスト

#### Reactコンポーネントテスト
```typescript
import { describe, it, expect } from 'vitest';
import { render, screen, userEvent } from '../../../utils/testUtils';
import { Button } from '@/components/ui/button';

describe('Button Component', () => {
  it('should render button with text', () => {
    render(<Button>Click me</Button>);
    
    const button = screen.getByRole('button', { name: /click me/i });
    expect(button).toBeInTheDocument();
  });

  it('should handle click events', async () => {
    const user = userEvent.setup();
    const handleClick = vi.fn();
    
    render(<Button onClick={handleClick}>Click me</Button>);
    
    const button = screen.getByRole('button');
    await user.click(button);
    
    expect(handleClick).toHaveBeenCalledOnce();
  });

  it('should render different variants', () => {
    const { rerender } = render(<Button variant="default">Default</Button>);
    
    let button = screen.getByRole('button');
    expect(button).toHaveClass('bg-primary');
    
    rerender(<Button variant="destructive">Destructive</Button>);
    button = screen.getByRole('button');
    expect(button).toHaveClass('bg-destructive');
  });
});
```

#### カスタムフックテスト
```typescript
import { renderHook, act } from '@testing-library/react';
import { useWeeklyReportForm } from '@/hooks/use-weekly-report-form';

describe('useWeeklyReportForm', () => {
  it('should initialize with default values', () => {
    const { result } = renderHook(() => useWeeklyReportForm());
    
    expect(result.current.data.caseId).toBe(0);
    expect(result.current.data.progressSummary).toBe('');
  });

  it('should update field values', () => {
    const { result } = renderHook(() => useWeeklyReportForm());
    
    act(() => {
      result.current.updateField('progressSummary', 'Updated progress');
    });
    
    expect(result.current.data.progressSummary).toBe('Updated progress');
  });
});
```

### 🔗 統合テスト

#### API統合テスト
```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../../server/index';
import { storage } from '../../server/storage';

describe('Weekly Reports API', () => {
  beforeEach(async () => {
    // テストデータセットアップ
    await storage.createTestUser({ id: 1, username: 'testuser' });
  });

  it('should create weekly report', async () => {
    const reportData = {
      caseId: 1,
      weekStartDate: '2024-01-01',
      progressSummary: 'Test progress'
    };

    const response = await request(app)
      .post('/api/weekly-reports')
      .send(reportData)
      .expect(201);

    expect(response.body.progressSummary).toBe('Test progress');
  });

  it('should validate required fields', async () => {
    const invalidData = {
      weekStartDate: '2024-01-01'
      // caseId missing
    };

    await request(app)
      .post('/api/weekly-reports')
      .send(invalidData)
      .expect(400);
  });
});
```

### 🎭 E2Eテスト（将来実装）

#### Playwright設定
```typescript
// playwright.config.ts
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  use: {
    baseURL: 'http://localhost:5000',
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
  ],
});
```

#### E2Eテスト例
```typescript
import { test, expect } from '@playwright/test';

test('weekly report creation flow', async ({ page }) => {
  // ログイン
  await page.goto('/login');
  await page.fill('[name="username"]', 'admin');
  await page.fill('[name="password"]', 'password');
  await page.click('button[type="submit"]');

  // 週次レポート作成
  await page.goto('/weekly-report');
  await page.click('text=新規作成');
  
  // 案件選択
  await page.click('text=案件を選択');
  await page.click('text=テスト案件');
  
  // フォーム入力
  await page.fill('[name="progressSummary"]', 'E2Eテストの進捗');
  await page.fill('[name="tasksCompleted"]', '基本テスト完了');
  
  // 保存確認
  await page.click('text=保存');
  await expect(page.locator('text=保存しました')).toBeVisible();
});
```

---

## デバッグ・トラブルシューティング

### 🐛 デバッグ手法

#### フロントエンドデバッグ
```typescript
// React Query DevTools
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';

function App() {
  return (
    <>
      <YourApp />
      {process.env.NODE_ENV === 'development' && (
        <ReactQueryDevtools initialIsOpen={false} />
      )}
    </>
  );
}

// カスタムログ関数
import { devLog } from '@shared/logger';

function MyComponent() {
  devLog('Component rendered', { props, state });
  
  return <div>Content</div>;
}
```

#### バックエンドデバッグ
```typescript
// 構造化ログ
import { createLogger } from '@shared/logger';
const logger = createLogger('WeeklyReportService');

async function createWeeklyReport(data: WeeklyReportFormData) {
  logger.info('Creating weekly report', { 
    caseId: data.caseId, 
    userId: req.user?.id 
  });
  
  try {
    const result = await storage.createWeeklyReport(data);
    logger.info('Weekly report created successfully', { id: result.id });
    return result;
  } catch (error) {
    logger.error('Failed to create weekly report', { error, data });
    throw error;
  }
}
```

### 📊 パフォーマンス監視

#### React監視
```typescript
import { Profiler } from 'react';

function onRenderCallback(id: string, phase: 'mount' | 'update', actualDuration: number) {
  if (actualDuration > 16) { // 60FPS threshold
    console.warn(`Slow render: ${id} took ${actualDuration}ms`);
  }
}

<Profiler id="WeeklyReportForm" onRender={onRenderCallback}>
  <WeeklyReportForm />
</Profiler>
```

#### API監視
```typescript
// Express middleware
app.use((req, res, next) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    if (duration > 1000) {
      logger.warn('Slow API response', {
        method: req.method,
        url: req.url,
        duration
      });
    }
  });
  
  next();
});
```

### 🔍 よくある問題と解決方法

#### TypeScript型エラー
```typescript
// 問題: Property 'user' does not exist on type 'Request'
// 解決: 型拡張
declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

// 問題: Object is possibly 'null'
// 解決: 適切なガード
if (user?.id) {
  // safe to use user.id
}
```

#### React Hook依存配列
```typescript
// 問題: useEffect無限ループ
useEffect(() => {
  fetchData(config); // configがオブジェクトで毎回新しい参照
}, [config]);

// 解決: useMemoまたは適切な依存関係
const stableConfig = useMemo(() => config, [config.id, config.type]);
useEffect(() => {
  fetchData(stableConfig);
}, [stableConfig]);
```

---

## パフォーマンス最適化

### ⚡ フロントエンド最適化

#### React最適化
```typescript
// メモ化によるレンダリング最適化
const ExpensiveComponent = memo(({ data }: { data: ComplexData }) => {
  const processedData = useMemo(() => {
    return expensiveDataProcessing(data);
  }, [data.id, data.lastUpdated]); // 必要最小限の依存関係

  return <div>{processedData.result}</div>;
});

// 仮想化による大量データ処理
import { FixedSizeList as List } from 'react-window';

function LargeList({ items }: { items: any[] }) {
  const Row = ({ index, style }: { index: number; style: any }) => (
    <div style={style}>
      {items[index].name}
    </div>
  );

  return (
    <List
      height={400}
      itemCount={items.length}
      itemSize={35}
    >
      {Row}
    </List>
  );
}
```

#### バンドル最適化
```typescript
// Code splitting
const AdminPanel = lazy(() => import('./AdminPanel'));
const WeeklyReportDetail = lazy(() => import('./WeeklyReportDetail'));

// Tree shaking対応
export { Button } from './Button';  // ✅ Named export
export default Button;              // ❌ Default export は避ける
```

### 🚀 バックエンド最適化

#### データベースクエリ最適化
```typescript
// N+1問題の解決
async function getWeeklyReportsWithCases() {
  // ❌ N+1 problem
  const reports = await storage.getAllWeeklyReports();
  for (const report of reports) {
    report.case = await storage.getCaseById(report.caseId);
  }

  // ✅ 一括取得
  const reports = await db
    .select()
    .from(weeklyReports)
    .leftJoin(cases, eq(weeklyReports.caseId, cases.id));
}

// インデックス活用
await db
  .select()
  .from(weeklyReports)
  .where(
    and(
      eq(weeklyReports.caseId, caseId),  // インデックス使用
      gte(weeklyReports.createdAt, startDate)
    )
  )
  .orderBy(desc(weeklyReports.createdAt))  // インデックス使用
  .limit(20);
```

#### キャッシュ戦略
```typescript
// Redis キャッシュ（将来実装）
class CacheService {
  private redis = new Redis(process.env.REDIS_URL);

  async get<T>(key: string): Promise<T | null> {
    const cached = await this.redis.get(key);
    return cached ? JSON.parse(cached) : null;
  }

  async set(key: string, value: any, ttl: number = 300) {
    await this.redis.setex(key, ttl, JSON.stringify(value));
  }
}

// アプリケーションレベルキャッシュ
const projectCache = new Map<number, Project>();

async function getCachedProject(id: number): Promise<Project> {
  if (projectCache.has(id)) {
    return projectCache.get(id)!;
  }

  const project = await storage.getProjectById(id);
  projectCache.set(id, project);
  return project;
}
```

### 📊 監視指標

#### Core Web Vitals
- **LCP (Largest Contentful Paint)**: < 2.5秒
- **FID (First Input Delay)**: < 100ms
- **CLS (Cumulative Layout Shift)**: < 0.1

#### API パフォーマンス
- **応答時間**: 95%ile < 500ms
- **スループット**: > 100 req/sec
- **エラー率**: < 0.1%

---

## セキュリティ考慮事項

### 🔐 認証・認可

#### セッション管理
```typescript
// 安全なセッション設定
app.use(session({
  secret: process.env.SESSION_SECRET!,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production', // HTTPS必須
    httpOnly: true,                                 // XSS対策
    maxAge: 24 * 60 * 60 * 1000,                   // 24時間
    sameSite: 'strict'                              // CSRF対策
  },
  store: new PostgreSQLStore(/* ... */)
}));
```

#### 入力値検証
```typescript
// 全てのAPIエンドポイントで検証実施
app.post('/api/weekly-reports', isAuthenticated, async (req, res) => {
  const validation = insertWeeklyReportSchema.safeParse(req.body);
  
  if (!validation.success) {
    return res.status(400).json({
      error: 'Validation failed',
      details: validation.error.format()
    });
  }

  // 処理続行
  const result = await storage.createWeeklyReport(validation.data);
  res.json(result);
});
```

### 🛡️ データ保護

#### 機密情報の取り扱い
```typescript
// 環境変数による機密情報管理
const aiConfig = {
  openai: {
    apiKey: process.env.OPENAI_API_KEY!,     // サーバーサイドのみ
    model: process.env.OPENAI_MODEL || 'gpt-4o-mini'
  }
};

// ログでの機密情報マスク
function maskSensitiveData(data: any): any {
  const masked = { ...data };
  if (masked.apiKey) {
    masked.apiKey = masked.apiKey.substring(0, 8) + '***';
  }
  return masked;
}
```

#### SQL インジェクション対策
```typescript
// Drizzle ORMによる自動エスケープ
const reports = await db
  .select()
  .from(weeklyReports)
  .where(eq(weeklyReports.id, reportId));  // 自動的にエスケープ

// 生SQLが必要な場合（推奨されない）
const results = await db.execute(
  sql`SELECT * FROM weekly_reports WHERE created_by = ${userId}`
);
```

### 🔍 セキュリティ監査

#### 依存関係スキャン
```bash
# 脆弱性チェック
npm audit
npm audit fix

# 継続的監視
npm install --save-dev audit-ci
```

#### コードセキュリティ
```typescript
// ESLint セキュリティルール
module.exports = {
  extends: [
    'plugin:security/recommended'
  ],
  rules: {
    'security/detect-object-injection': 'error',
    'security/detect-non-literal-regexp': 'error',
    'security/detect-unsafe-regex': 'error'
  }
};
```

---

## デプロイメント

### 🚀 本番ビルド

#### ビルドプロセス
```bash
# フロントエンド最適化ビルド
npm run build:client  # Vite production build

# バックエンド最適化ビルド  
npm run build:server  # ESBuild compilation

# 全体ビルド
npm run build
```

#### 環境別設定
```typescript
// config/production.ts
export const productionConfig = {
  database: {
    url: process.env.DATABASE_URL!,
    ssl: { rejectUnauthorized: false }  // Neon.tech対応
  },
  session: {
    secure: true,                       // HTTPS必須
    sameSite: 'strict' as const
  },
  logging: {
    level: 'warn',                      // 本番では警告以上のみ
    console: false                      // ファイルログのみ
  }
};
```

### ☁️ デプロイメント戦略

#### Docker化（推奨）
```dockerfile
# Dockerfile
FROM node:20-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json

EXPOSE 3000
CMD ["npm", "start"]
```

#### CI/CD パイプライン
```yaml
# .github/workflows/deploy.yml
name: Deploy to Production

on:
  push:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '20'
      - run: npm ci
      - run: npm run test
      - run: npm run build

  deploy:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - name: Deploy to production
        run: |
          # デプロイスクリプト実行
          ./scripts/deploy.sh
```

### 🔄 ヘルスチェック

#### アプリケーションヘルス
```typescript
// /api/health エンドポイント
app.get('/api/health', async (req, res) => {
  const health = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version,
    checks: {
      database: await checkDatabase(),
      ai_service: await checkAIService(),
      memory: process.memoryUsage(),
      uptime: process.uptime()
    }
  };

  const allChecksOk = Object.values(health.checks)
    .every(check => check.status === 'ok');

  res.status(allChecksOk ? 200 : 503).json(health);
});
```

---

## 監視・ログ

### 📊 ログ戦略

#### 構造化ログ
```typescript
import { createLogger } from '@shared/logger';

const logger = createLogger('UserService');

// 構造化ログ出力
logger.info('User login attempt', {
  userId: user.id,
  username: user.username,
  ipAddress: req.ip,
  userAgent: req.get('User-Agent')
});

logger.error('Database connection failed', {
  error: error.message,
  stack: error.stack,
  query: sanitizedQuery,
  retryCount: 3
});
```

#### ログレベル設定
```typescript
// 環境別ログレベル
const logLevels = {
  development: 'debug',
  test: 'warn',
  production: 'error'
};

const logger = createLogger('App', {
  level: logLevels[process.env.NODE_ENV] || 'info'
});
```

### 📈 メトリクス監視

#### アプリケーションメトリクス
```typescript
// カスタムメトリクス収集
class MetricsCollector {
  private metrics = new Map<string, number>();

  increment(key: string, value: number = 1) {
    this.metrics.set(key, (this.metrics.get(key) || 0) + value);
  }

  gauge(key: string, value: number) {
    this.metrics.set(key, value);
  }

  getMetrics() {
    return Object.fromEntries(this.metrics);
  }
}

// 使用例
const metrics = new MetricsCollector();

app.use((req, res, next) => {
  metrics.increment('http.requests.total');
  metrics.increment(`http.requests.${req.method.toLowerCase()}`);
  next();
});
```

### 🚨 アラート設定

#### エラー監視
```typescript
// 重要エラーの通知
process.on('uncaughtException', (error) => {
  logger.fatal('Uncaught exception', { error });
  // アラート送信
  notificationService.sendAlert({
    level: 'critical',
    message: 'Application crashed',
    error: error.message
  });
  process.exit(1);
});

// API エラー率監視
let errorCount = 0;
let requestCount = 0;

setInterval(() => {
  const errorRate = requestCount > 0 ? errorCount / requestCount : 0;
  
  if (errorRate > 0.05) { // 5%を超える場合
    notificationService.sendAlert({
      level: 'warning',
      message: `High error rate: ${(errorRate * 100).toFixed(2)}%`
    });
  }
  
  errorCount = 0;
  requestCount = 0;
}, 60000); // 1分間隔
```

---

## 継続的改善

### 📊 パフォーマンス分析

#### 定期レビュー項目
- **コードメトリクス**: 複雑度、テストカバレッジ、重複コード
- **パフォーマンス**: 応答時間、メモリ使用量、エラー率
- **セキュリティ**: 脆弱性スキャン、依存関係更新
- **ユーザビリティ**: ユーザーフィードバック、使用状況分析

#### 改善プロセス
1. **問題特定**: メトリクス・ログ・ユーザーフィードバック分析
2. **原因分析**: 根本原因の特定と影響範囲の評価
3. **解決策検討**: 複数の解決策の比較検討
4. **実装・テスト**: 段階的な実装とA/Bテスト
5. **効果測定**: 改善効果の定量的な評価

### 🔄 技術的負債管理

#### 負債の分類と対応
```typescript
// TODO: 技術的負債の追跡
/**
 * TECH_DEBT: レガシーAPI形式の段階的移行
 * Priority: Medium
 * Effort: 2-3 sprints
 * Impact: API一貫性向上、メンテナンス性改善
 */
function legacyApiEndpoint() {
  // 新しいAPI形式への移行が必要
}

/**
 * PERFORMANCE: N+1クエリ問題
 * Priority: High  
 * Effort: 1 sprint
 * Impact: 50%パフォーマンス改善見込み
 */
async function getReportsWithDetails() {
  // 一括取得クエリへの書き換えが必要
}
```

---

このドキュメントは開発チームの知識共有と品質向上を目的としています。新機能開発や技術改善の際は、このガイドラインに従って実装してください。

不明な点や改善提案がありましたら、開発チームのSlackチャンネルまたはGitHub Issuesでお知らせください。