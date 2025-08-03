# TaskTrackr 開発パターンとベストプラクティス

## APIクライアントパターン
### 必須: 統一されたAPIリクエスト処理
```typescript
// client/src/lib/queryClient.ts の apiRequest を必ず使用
import { apiRequest } from "@/lib/queryClient";

// 正しい使用方法
const response = await apiRequest('/api/projects', {
  method: 'POST',
  data: projectData
});

// 間違い: fetchを直接使用しない
// const response = await fetch('/api/projects', {...});
```

### APIリクエストの特徴
- セッションクッキーのために常に`credentials: "include"`を含む
- 詳細ログ付きで401エラーを処理
- `throwIfResNotOk`エラーハンドリングで型付きレスポンスを返す

## 認証フローパターン
### セッションベース認証の実装
```typescript
// server/auth.ts のPassport.js設定を使用
// PostgreSQLセッションストア使用（Neon.tech環境ではMemoryStoreにフォールバック）

// 認証ミドルウェアの使用
app.get('/api/protected', isAuthenticated, (req, res) => {
  // 認証済みユーザーのみアクセス可能
});

app.get('/api/admin', isAdmin, (req, res) => {
  // 管理者のみアクセス可能
});
```

## データベースアクセスパターン
### Drizzle ORMによる型安全なデータベース操作
```typescript
// server/storage.ts の統一インターフェースを使用
import { withRetry } from './storage';

// 自動リトライロジック付きのデータベース操作
const result = await withRetry(async () => {
  return await db.select().from(projects).where(eq(projects.id, id));
});
```

### 重要な特徴
- `withRetry()`関数による自動リトライロジック
- コネクションプーリングとエラーハンドリング
- ソフト削除パターン（isDeletedフラグ）

## フォームハンドリングパターン
### React Hook Form + Zod バリデーション
```typescript
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertProjectSchema } from "@shared/schema";

const form = useForm<z.infer<typeof insertProjectSchema>>({
  resolver: zodResolver(insertProjectSchema),
  defaultValues: {
    name: "",
    overview: "",
    // 重要: null値対応
    description: "", // value={field.value ?? ""} パターンを使用
  },
});
```

### 既知の問題と対処法
- データベースフィールドはnullableだがReactコンポーネントは非null値を期待
- TextAreaには`value={field.value ?? ""}`パターンを使用

## AI統合パターン
### AIサービスの抽象化
```typescript
// server/ai-service.ts の抽象AIServiceクラスを使用
import { AIService } from './ai-service';

// プロバイダー固有の実装
const aiService = AIService.getInstance();
const response = await aiService.generateResponse(prompt, context);

// ログ出力（ai-logger.ts経由）
aiLogger.info('AI analysis completed', { 
  requestId, 
  provider: config.AI_PROVIDER,
  tokenUsage 
});
```

### AI機能の特徴
- 5つのプロバイダー対応（OpenAI、Ollama、Google Gemini、Groq、OpenRouter）
- コンテンツクリーニング（`<think>`タグ除去）
- 包括的ログ機能
- 動的設定切り替え

## コンポーネント開発パターン
### Shadcn/uiコンポーネントの活用
```typescript
// client/src/components/ui/ の48+コンポーネントを使用
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Form } from "@/components/ui/form";

// 既存パターンに従った実装
// client/src/components/ の既存コンポーネントを参考
```

## 状態管理パターン
### TanStack Query（React Query）の活用
```typescript
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

const { data, isLoading, error } = useQuery({
  queryKey: ['projects'],
  queryFn: () => apiRequest('/api/projects'),
  staleTime: 5 * 60 * 1000, // 5分間キャッシュ
});
```

## テスト開発パターン
### ユニットテストの作成
```typescript
// tests/unit/[client|server]/component.test.ts
import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';

test('コンポーネントの基本動作', async () => {
  const user = userEvent.setup();
  render(<Component />);
  
  const button = screen.getByRole('button');
  await user.click(button);
  
  expect(screen.getByText('期待される文字')).toBeInTheDocument();
});
```

### MSWによるAPIモック
```typescript
// tests/__mocks__/handlers.ts でAPIハンドラー定義
import { http, HttpResponse } from 'msw';

export const handlers = [
  http.get('/api/projects', () => {
    return HttpResponse.json([
      { id: 1, name: 'テストプロジェクト' }
    ]);
  })
];
```

## エラーハンドリングパターン
### 統一されたエラー処理
```typescript
// フロントエンド
try {
  const result = await apiRequest('/api/data');
} catch (error) {
  console.error('API Error:', error);
  toast.error('データの取得に失敗しました');
}

// バックエンド
app.get('/api/data', async (req, res) => {
  try {
    const data = await storage.getData();
    res.json(data);
  } catch (error) {
    console.error('Storage Error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});
```

## パフォーマンス最適化パターン
### 軽量版APIの使用
```typescript
// 必要最小限のフィールドのみ取得
const projects = await apiRequest('/api/projects?fields=id,name,overview');

// React Queryによる適切なキャッシュ戦略
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 2 * 60 * 1000, // 2分間
      cacheTime: 5 * 60 * 1000, // 5分間
    },
  },
});
```