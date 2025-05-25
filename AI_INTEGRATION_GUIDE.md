# TaskTrackr AI機能統合手順書

山村さん、以下の手順でOpenAI/Ollama対応を完了してください。

## 1. 環境変数ファイルの作成

`.env`ファイルをプロジェクトルートに作成してください：

```env
# AI Configuration
AI_PROVIDER=ollama

# OpenAI Configuration
OPENAI_API_KEY=sk-proj-your-openai-api-key-here
OPENAI_MODEL=gpt-3.5-turbo
OPENAI_MAX_TOKENS=1000
OPENAI_TEMPERATURE=0.7

# Ollama Configuration (山村さんの設定)
OLLAMA_BASE_URL=http://172.20.100.49:11434/
OLLAMA_MODEL=llama2
OLLAMA_MAX_TOKENS=1000
OLLAMA_TEMPERATURE=0.7

# 既存の設定...
DATABASE_URL=your_database_url_here
SESSION_SECRET=your_session_secret_here
PORT=3000
NODE_ENV=development
```

## 2. server/index.ts の更新

既存の `server/index.ts` ファイルに以下を追加してください：

```typescript
// imports の追加
import { validateAIConfig } from './config.js';
import { aiRoutes } from './ai-routes.js';

// 設定検証の追加（アプリ起動時）
try {
  validateAIConfig();
  console.log('✅ AI configuration validated successfully');
} catch (error) {
  console.error('❌ AI configuration error:', error.message);
  process.exit(1);
}

// ルートの追加（既存のルート設定後）
app.use(aiRoutes);
```

## 3. フロントエンド用AIクライアントの作成

`client/src/lib/ai-client.ts` を作成してください：

```typescript
export interface AIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface AIResponse {
  content: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

class AIClient {
  private baseUrl = '/api/ai';

  async chat(messages: AIMessage[]): Promise<AIResponse> {
    const response = await fetch(`${this.baseUrl}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages }),
    });

    const result = await response.json();
    if (!result.success) {
      throw new Error(result.error || 'AI request failed');
    }

    return result.data;
  }

  async summarize(text: string): Promise<string> {
    const response = await fetch(`${this.baseUrl}/summarize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    });

    const result = await response.json();
    if (!result.success) {
      throw new Error(result.error || 'Summarization failed');
    }

    return result.data.summary;
  }

  async analyzeTask(taskDescription: string): Promise<{
    priority: 'low' | 'medium' | 'high';
    estimatedHours: number;
    tags: string[];
  }> {
    const response = await fetch(`${this.baseUrl}/analyze-task`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ taskDescription }),
    });

    const result = await response.json();
    if (!result.success) {
      throw new Error(result.error || 'Task analysis failed');
    }

    return result.data;
  }

  async getStatus(): Promise<{
    provider: string;
    status: string;
    timestamp: string;
  }> {
    const response = await fetch(`${this.baseUrl}/status`);
    const result = await response.json();
    
    if (!result.success) {
      throw new Error(result.error || 'Status check failed');
    }

    return result.data;
  }
}

export const aiClient = new AIClient();
```

## 4. 使用例 - タスク分析機能

タスク作成フォームでAI分析を使用する例：

```typescript
import { aiClient } from '../lib/ai-client';

// タスク作成時の自動分析
const handleTaskAnalysis = async (description: string) => {
  try {
    const analysis = await aiClient.analyzeTask(description);
    
    // フォームに分析結果を反映
    setFormData(prev => ({
      ...prev,
      priority: analysis.priority,
      estimatedHours: analysis.estimatedHours,
      tags: analysis.tags,
    }));
  } catch (error) {
    console.error('Task analysis failed:', error);
  }
};
```

## 5. 動作確認

1. サーバーを起動：`npm run dev`
2. AIプロバイダーステータス確認：`curl http://localhost:3000/api/ai/status`
3. タスク分析テスト：
   ```bash
   curl -X POST http://localhost:3000/api/ai/analyze-task \
     -H "Content-Type: application/json" \
     -d '{"taskDescription": "MSAD_NEC_共同損サのシステム要件定義書を作成する"}'
   ```

## 6. Ollamaモデルの推奨設定

損害保険システム開発に適したモデル：

- `llama2:7b-chat` - 日本語対応、軽量
- `codellama:7b-instruct` - コード解析用
- `mistral:7b-instruct` - 高精度な分析

モデルのインストール：
```bash
ollama pull llama2:7b-chat
ollama pull codellama:7b-instruct
```

## トラブルシューティング

### Ollama接続エラー
- Ollamaサーバーが起動しているか確認
- ファイアウォール設定でポート11434が開いているか確認
- `curl http://172.20.100.49:11434/api/tags` でモデル一覧取得テスト

### OpenAI接続エラー
- APIキーが正しいか確認
- 使用量制限に達していないか確認

これで山村さんのタスク管理システムでローカルAIとクラウドAIの両方を使用できるようになります！
