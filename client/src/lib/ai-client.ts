import { useState } from 'react';

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

export interface TaskAnalysis {
  priority: 'low' | 'medium' | 'high';
  estimatedHours: number;
  tags: string[];
}

export interface AIStatus {
  provider: string;
  status: string;
  timestamp: string;
}

class AIClient {
  private baseUrl = '/api/ai';

  /**
   * AI チャット機能
   * @param messages 会話履歴
   * @returns AI応答
   */
  async chat(messages: AIMessage[]): Promise<AIResponse> {
    const response = await fetch(`${this.baseUrl}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ messages }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    if (!result.success) {
      throw new Error(result.error || 'AI request failed');
    }

    return result.data;
  }

  /**
   * テキスト要約機能
   * @param text 要約対象のテキスト
   * @returns 要約結果
   */
  async summarize(text: string): Promise<string> {
    if (text.length < 10) {
      throw new Error('Text must be at least 10 characters long');
    }

    const response = await fetch(`${this.baseUrl}/summarize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ text }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    if (!result.success) {
      throw new Error(result.error || 'Summarization failed');
    }

    return result.data.summary;
  }

  /**
   * タスク分析機能（損害保険システム開発用）
   * @param taskDescription タスクの説明
   * @returns 分析結果（優先度、見積時間、タグ）
   */
  async analyzeTask(taskDescription: string): Promise<TaskAnalysis> {
    if (taskDescription.length < 5) {
      throw new Error('Task description must be at least 5 characters long');
    }

    const response = await fetch(`${this.baseUrl}/analyze-task`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ taskDescription }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    if (!result.success) {
      throw new Error(result.error || 'Task analysis failed');
    }

    return result.data;
  }

  /**
   * AIプロバイダーステータス確認
   * @returns プロバイダー情報
   */
  async getStatus(): Promise<AIStatus> {
    const response = await fetch(`${this.baseUrl}/status`, {
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    if (!result.success) {
      throw new Error(result.error || 'Status check failed');
    }

    return result.data;
  }

  /**
   * 損害保険業界特化の案件分析
   * @param projectDescription 案件の説明
   * @returns 業界特化分析結果
   */
  async analyzeInsuranceProject(projectDescription: string): Promise<AIResponse> {
    const systemPrompt = `あなたは損害保険システム開発のエキスパートです。
以下の観点で案件を分析してください：

1. 技術的難易度（A-D評価）
2. リスク要因の特定
3. 必要なスキルセット
4. 見積工数（人月）
5. 開発スケジュール案
6. 注意すべき法規制・業界標準

現場として以下があります：
- MSAD_NEC_共同損サ
- NOSL_日新火災_契約管理  
- タタ_AIG_保守
- アクセンチュア_損ジャ_未来革新３期
- IBM_医療福祉機構_退職共済

分析は簡潔で実用的に提供してください。`;

    return this.chat([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: projectDescription }
    ]);
  }

  /**
   * 週報自動生成支援
   * @param weeklyData 週の作業データ
   * @returns 週報案
   */
  async generateWeeklyReport(weeklyData: {
    projects: string[];
    tasks: string[];
    achievements: string[];
    issues: string[];
    nextWeekPlan: string[];
  }): Promise<string> {
    const prompt = `以下の情報から山村課長の週報を作成してください：

【担当プロジェクト】
${weeklyData.projects.join('\n')}

【今週の主要タスク】
${weeklyData.tasks.join('\n')}

【今週の成果】
${weeklyData.achievements.join('\n')}

【課題・問題点】
${weeklyData.issues.join('\n')}

【来週の予定】
${weeklyData.nextWeekPlan.join('\n')}

システムソリューション７部１Gの課長として、上司や関係者に報告する形式で週報を作成してください。`;

    const result = await this.chat([
      { role: 'system', content: 'あなたは損害保険システム開発のプロジェクト管理者です。簡潔で分かりやすい週報を作成してください。' },
      { role: 'user', content: prompt }
    ]);

    return result.content;
  }
}

// シングルトンインスタンス
export const aiClient = new AIClient();

// React Hook for AI operations
export function useAI() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const executeAI = async <T>(operation: () => Promise<T>): Promise<T | null> => {
    setIsLoading(true);
    setError(null);
    
    try {
      const result = await operation();
      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      console.error('AI operation failed:', err);
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  return {
    isLoading,
    error,
    executeAI,
    clearError: () => setError(null),
  };
}
