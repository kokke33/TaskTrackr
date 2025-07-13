import { useState, useCallback, useRef } from "react";

interface AIAnalysisState {
  [fieldName: string]: {
    analysis: string | null;
    isLoading: boolean;
    error: string | null;
    previousContent?: string; // 前回の内容を保存
  };
}

export function useAIAnalysis() {
  const [analysisState, setAnalysisState] = useState<AIAnalysisState>({});
  const debounceTimeouts = useRef<{ [fieldName: string]: NodeJS.Timeout }>({});

  const analyzeField = useCallback(async (fieldName: string, content: string, originalContent?: string, previousReportContent?: string) => {
    if (!content || content.trim().length < 10) {
      return;
    }

    // デバウンス: 既存のタイマーをクリア
    if (debounceTimeouts.current[fieldName]) {
      clearTimeout(debounceTimeouts.current[fieldName]);
    }

    // 新しいタイマーを設定（0.1秒後に実行）
    debounceTimeouts.current[fieldName] = setTimeout(async () => {
      try {
        const currentState = analysisState[fieldName];
        const previousContent = currentState?.previousContent;
        
        // 変更点を検出
        let changeAnalysis = "";
        if (originalContent && originalContent !== content) {
          changeAnalysis = `\n\n【元の内容からの変更点】\n元の内容:\n${originalContent}\n\n現在の内容:\n${content}`;
        } else if (previousContent && previousContent !== content) {
          changeAnalysis = `\n\n【前回からの変更点】\n前回の内容:\n${previousContent}\n\n現在の内容:\n${content}`;
        }
        
        // 前回報告との比較を追加（編集モードでは比較対象を変更）
        console.log("前回報告比較チェック:", {
          fieldName,
          hasPreviousReportContent: !!previousReportContent,
          previousReportContent,
          content,
          originalContent,
          // 編集モードでは originalContent（現在保存されているデータ）と previousReportContent を比較
          comparisonTarget: originalContent || content,
          isContentDifferent: previousReportContent !== (originalContent || content)
        });
        
        // 編集モードでは原則として前回報告との比較を表示
        // 常に現在の入力内容と前回報告を比較する
        const comparisonTarget = content;
        let hasPreviousReportComparison = false;
        let isContentUnchanged = false;
        
        if (previousReportContent && previousReportContent.trim() !== "") {
          let reportComparison = "";
          hasPreviousReportComparison = true;
          
          // 文字列比較の詳細なデバッグ情報を出力
          const normalizedPrevious = previousReportContent.trim().replace(/\s+/g, ' ');
          const normalizedCurrent = comparisonTarget.trim().replace(/\s+/g, ' ');
          const areEqual = normalizedPrevious === normalizedCurrent;
          
          console.log("文字列比較デバッグ:", {
            fieldName,
            previousLength: previousReportContent.length,
            currentLength: comparisonTarget.length,
            normalizedPreviousLength: normalizedPrevious.length,
            normalizedCurrentLength: normalizedCurrent.length,
            areEqual,
            strictEqual: previousReportContent === comparisonTarget,
            // 最初の50文字を比較
            previousStart: previousReportContent.substring(0, 50),
            currentStart: comparisonTarget.substring(0, 50),
            // 最後の50文字を比較
            previousEnd: previousReportContent.substring(previousReportContent.length - 50),
            currentEnd: comparisonTarget.substring(comparisonTarget.length - 50)
          });
          
          // 正規化された内容で比較
          if (!areEqual) {
            reportComparison = `\n\n【前回報告との比較】\n前回報告の内容:\n${previousReportContent}\n\n今回報告の内容:\n${comparisonTarget}`;
          } else {
            // 内容が同じ場合は更新不足のリスクとして扱う
            isContentUnchanged = true;
            reportComparison = `\n\n【前回報告との比較】\n前回報告の内容:\n${previousReportContent}\n\n今回報告の内容:\n${comparisonTarget}\n\n⚠️ 重要: 前回報告と全く同じ内容です。進捗や状況に変化がない場合でも、現在の状況を改めて記載することが重要です。`;
          }
          changeAnalysis += reportComparison;
          console.log("前回報告比較セクション追加:", reportComparison);
        }

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

        const analysisText = `週次報告の「${fieldName}」フィールドの内容を分析してください。\n\n内容:\n${content}${changeAnalysis}\n\n以下の観点から分析してください：\n- 内容の妥当性\n- 潜在的なリスクや課題\n- 改善提案\n- 追加で考慮すべき点${changeAnalysis ? "\n- 変更点の影響評価" : ""}${hasPreviousReportComparison ? "\n- 前回報告からの進捗状況" : ""}${isContentUnchanged ? "\n- ⚠️ 重要: 前回報告から内容が変更されていません。これは以下のリスクを示している可能性があります：\n  • 進捗が停滞している\n  • 報告内容の更新を怠っている\n  • 状況認識が不十分\n  • 継続的な改善活動が行われていない\n  このような状況を改善するための具体的な提案を行ってください。" : ""}`;

        console.log("AI分析プロンプト生成:", {
          fieldName,
          hasChangeAnalysis: !!changeAnalysis,
          analysisTextLength: analysisText.length,
          includesPreviousReport: analysisText.includes("【前回報告との比較】"),
          isContentUnchanged,
          hasPreviousReportComparison
        });

        const response = await fetch("/api/ai/analyze-text", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            text: analysisText,
          }),
          credentials: "include",
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        
        if (!data.success) {
          throw new Error(data.error || "AI分析に失敗しました");
        }

        // 成功時の状態更新（前回の内容も保存）
        setAnalysisState(prev => ({
          ...prev,
          [fieldName]: {
            analysis: data.data || "分析結果がありません",
            isLoading: false,
            error: null,
            previousContent: content, // 現在の内容を前回の内容として保存
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
          },
        }));
      }
    }, 100);
  }, [analysisState]);

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
    };
  }, [analysisState]);

  return {
    analyzeField,
    clearAnalysis,
    getAnalysisState,
  };
}