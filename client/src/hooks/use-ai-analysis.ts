import { useState, useCallback, useRef } from "react";
import { useAuth } from "@/lib/auth";

interface ConversationMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface AIAnalysisState {
  [fieldName: string]: {
    analysis: string | null;
    isLoading: boolean;
    error: string | null;
    previousContent?: string; // 前回の内容を保存
    hasRunAnalysis?: boolean; // 初回分析が実行されたかどうか
    conversations?: ConversationMessage[]; // 会話履歴
    isConversationLoading?: boolean; // 会話ローディング状態
  };
}

export function useAIAnalysis() {
  const [analysisState, setAnalysisState] = useState<AIAnalysisState>({});
  const debounceTimeouts = useRef<{ [fieldName: string]: NodeJS.Timeout }>({});
  const { checkAuth } = useAuth();

  const analyzeField = useCallback(async (fieldName: string, content: string, originalContent?: string, previousReportContent?: string, forceAnalysis: boolean = false) => {
    if (!content || content.trim().length < 10) {
      return;
    }

    const currentState = analysisState[fieldName];
    
    // 初回分析チェック: 同じ内容で分析が実行済みで強制実行でない場合はスキップ
    if (currentState?.hasRunAnalysis && currentState?.previousContent === content && !forceAnalysis) {
      console.log(`${fieldName}: 同じ内容で分析済みのため自動実行をスキップ`);
      return;
    }

    // デバウンス: 既存のタイマーをクリア
    if (debounceTimeouts.current[fieldName]) {
      clearTimeout(debounceTimeouts.current[fieldName]);
    }

    // 再生成の場合は即座に実行、それ以外は0.1秒後に実行
    const delay = forceAnalysis ? 0 : 100;
    debounceTimeouts.current[fieldName] = setTimeout(async () => {
      try {
        // ローディング状態に設定
        setAnalysisState(prev => ({
          ...prev,
          [fieldName]: {
            analysis: prev[fieldName]?.analysis || null,
            isLoading: true,
            error: null,
            previousContent: prev[fieldName]?.previousContent,
          },
        }));

        // セッション設定があるかチェックして適切なエンドポイントを使用
        let endpoint = "/api/ai/analyze-text";
        try {
          const sessionResponse = await fetch("/api/session-ai-settings", {
            credentials: "include",
          });
          if (sessionResponse.ok) {
            const sessionSettings = await sessionResponse.json();
            if (sessionSettings.realtimeProvider) {
              endpoint = "/api/ai/analyze-text-trial";
            }
          }
        } catch (error) {
          console.log("セッション設定チェック中にエラー:", error);
          // エラーの場合は通常のエンドポイントを使用
        }

        const response = await fetch(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            content,
            fieldType: fieldName,
            originalContent,
            previousReportContent,
          }),
          credentials: "include",
        });

        if (!response.ok) {
          // 401エラー（認証切れ）の特別処理
          if (response.status === 401) {
            try {
              await checkAuth();
            } catch (authError) {
              console.error("認証確認エラー:", authError);
            }
            throw new Error("セッションが期限切れです。ページを更新して再ログインしてください。");
          }
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        
        if (!data.success) {
          throw new Error(data.error || "AI分析に失敗しました");
        }

        // 成功時の状態更新（前回の内容も保存、新しい分析時は会話をクリア）
        setAnalysisState(prev => ({
          ...prev,
          [fieldName]: {
            analysis: data.data || "分析結果がありません",
            isLoading: false,
            error: null,
            previousContent: content, // 現在の内容を前回の内容として保存
            hasRunAnalysis: true, // 初回分析完了フラグを設定
            conversations: [], // 新しい分析時は会話履歴をクリア
            isConversationLoading: false,
          },
        }));

      } catch (error) {
        console.error("AI analysis error:", error);
        
        // エラー時の状態更新
        setAnalysisState(prev => ({
          ...prev,
          [fieldName]: {
            analysis: prev[fieldName]?.analysis || null,
            isLoading: false,
            error: error instanceof Error ? error.message : "AI分析中にエラーが発生しました",
            previousContent: prev[fieldName]?.previousContent,
            conversations: prev[fieldName]?.conversations || [],
            isConversationLoading: false,
          },
        }));
      }
    }, delay);
  }, [analysisState, checkAuth]);

  const clearAnalysis = useCallback((fieldName: string) => {
    // タイマーをクリア
    if (debounceTimeouts.current[fieldName]) {
      clearTimeout(debounceTimeouts.current[fieldName]);
      delete debounceTimeouts.current[fieldName];
    }

    // 状態をクリア
    setAnalysisState(prev => {
      const newState = { ...prev };
      delete newState[fieldName];
      return newState;
    });
  }, []);

  const getAnalysisState = useCallback((fieldName: string) => {
    return analysisState[fieldName] || {
      analysis: null,
      isLoading: false,
      error: null,
      previousContent: undefined,
      hasRunAnalysis: false,
      conversations: [],
      isConversationLoading: false,
    };
  }, [analysisState]);

  const regenerateAnalysis = useCallback((fieldName: string, content: string, originalContent?: string, previousReportContent?: string) => {
    console.log("regenerateAnalysis called:", { fieldName, contentLength: content?.length, originalContent, previousReportContent });
    
    // 既存の分析をクリアしてから再生成（hasRunAnalysisフラグは保持）
    setAnalysisState(prev => ({
      ...prev,
      [fieldName]: {
        analysis: null,
        isLoading: false,
        error: null,
        previousContent: prev[fieldName]?.previousContent,
        hasRunAnalysis: prev[fieldName]?.hasRunAnalysis || false,
      },
    }));

    // 強制的に分析を実行
    analyzeField(fieldName, content, originalContent, previousReportContent, true);
  }, [analyzeField]);

  const sendMessage = useCallback(async (fieldName: string, message: string) => {
    const currentState = analysisState[fieldName];
    if (!currentState?.analysis) {
      return; // 分析結果がない場合は会話不可
    }

    // ローディング状態に設定
    setAnalysisState(prev => ({
      ...prev,
      [fieldName]: {
        ...prev[fieldName],
        isConversationLoading: true,
      },
    }));

    try {
      // ユーザーメッセージを追加
      const userMessage: ConversationMessage = {
        id: Date.now().toString(),
        role: 'user',
        content: String(message),
        timestamp: new Date(),
      };

      setAnalysisState(prev => ({
        ...prev,
        [fieldName]: {
          ...prev[fieldName],
          conversations: [...(prev[fieldName]?.conversations || []), userMessage],
        },
      }));

      // AI会話APIを呼び出し
      const response = await fetch("/api/ai/conversation", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          fieldName,
          message,
          analysis: currentState.analysis,
          conversations: currentState.conversations || [],
        }),
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      
      // デバッグログ追加
      console.log('AI conversation response:', {
        success: data.success,
        data: data.data,
        dataType: typeof data.data,
        fullResponse: data
      });
      console.log('data.data content:', JSON.stringify(data.data, null, 2));
      
      if (!data.success) {
        throw new Error(data.error || "会話に失敗しました");
      }

      // AIの回答を追加
      const assistantMessage: ConversationMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: String(data.data || "回答を取得できませんでした"),
        timestamp: new Date(),
      };

      setAnalysisState(prev => ({
        ...prev,
        [fieldName]: {
          ...prev[fieldName],
          conversations: [...(prev[fieldName]?.conversations || []), assistantMessage],
          isConversationLoading: false,
        },
      }));

    } catch (error) {
      console.error("Conversation error:", error);
      
      // エラーメッセージを追加
      const errorMessage: ConversationMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: String(`エラーが発生しました: ${error instanceof Error ? error.message : '不明なエラー'}`),
        timestamp: new Date(),
      };

      setAnalysisState(prev => ({
        ...prev,
        [fieldName]: {
          ...prev[fieldName],
          conversations: [...(prev[fieldName]?.conversations || []), errorMessage],
          isConversationLoading: false,
        },
      }));
    }
  }, [analysisState, checkAuth]);

  const clearConversations = useCallback((fieldName: string) => {
    setAnalysisState(prev => ({
      ...prev,
      [fieldName]: {
        ...prev[fieldName],
        conversations: [],
      },
    }));
  }, []);

  return {
    analyzeField,
    clearAnalysis,
    getAnalysisState,
    regenerateAnalysis,
    sendMessage,
    clearConversations,
  };
}