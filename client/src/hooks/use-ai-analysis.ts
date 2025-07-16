import { useState, useCallback, useRef } from "react";
import { useAuth } from "@/lib/auth";

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
  const { checkAuth } = useAuth();

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

        // フィールド固有のレイアウトチェック項目を追加
        const getLayoutRequirements = (fieldName: string) => {
          switch (fieldName) {
            case "今週の作業内容":
              return "\n- 必須レイアウトの確認：\n  • ■主な作業\n  • ■計画との差異（遅延・前倒し等）\n  • ■リスク評価\n    評価: 大・中・小\n    理由: [具体的な理由]\n  上記の構成で記載されているかを確認し、不足している項目があれば指摘してください。";
            case "遅延・問題点の詳細":
              return "\n- 必須レイアウトの確認：\n  • 具体的な遅延・問題点の詳細説明\n  • 影響範囲と対応状況\n  • 今後の対応計画\n  上記の内容が具体的に記載されているかを確認し、不足している項目があれば指摘してください。";
            case "課題・問題点":
              return "\n- 必須レイアウトの確認：\n  • ■内容\n  • ■深刻度\n    評価: 大・中・小\n    理由: [具体的な理由]\n  • ■対応状況\n  上記の構成で記載されているかを確認し、不足している項目があれば指摘してください。";
            case "変更内容の詳細":
              return "\n- 必須レイアウトの確認：\n  • ■変更された内容\n  • ■変更理由と影響\n  • ■リスク評価\n    評価: 大・中・低\n    理由: [具体的な理由]\n  上記の構成で記載されているかを確認し、不足している項目があれば指摘してください。";
            case "来週の作業予定":
              return "\n- 必須レイアウトの確認：\n  • ■作業予定\n  • ■想定される懸念\n  • ■リスク評価\n    評価: 大・中・小\n    理由: [具体的な理由]\n  上記の構成で記載されているかを確認し、不足している項目があれば指摘してください。";
            case "支援・判断の要望事項":
              return "\n- 必須レイアウトの確認：\n  • 具体的な支援要請内容\n  • 判断が必要な事項\n  • 緊急度と理由\n  上記の内容が具体的に記載されているかを確認し、不足している項目があれば指摘してください。";
            case "リソース懸念事項":
              return "\n- 必須レイアウトの確認：\n  • 具体的なリソース懸念の詳細説明\n  • 影響範囲と対応状況\n  • 今後の対応計画\n  上記の内容が具体的に記載されているかを確認し、不足している項目があれば指摘してください。";
            case "顧客懸念事項":
              return "\n- 必須レイアウトの確認：\n  • 具体的な顧客状況の詳細説明\n  • 顧客満足度や評価\n  • 改善点や対応計画\n  上記の内容が具体的に記載されているかを確認し、不足している項目があれば指摘してください。";
            case "環境懸念事項":
              return "\n- 必須レイアウトの確認：\n  • 具体的な環境状況の詳細説明\n  • 影響範囲と対応状況\n  • 今後の対応計画\n  上記の内容が具体的に記載されているかを確認し、不足している項目があれば指摘してください。";
            case "コスト懸念事項":
              return "\n- 必須レイアウトの確認：\n  • 具体的なコスト状況の詳細説明\n  • 予算との差異分析\n  • 今後の見込みと対策\n  上記の内容が具体的に記載されているかを確認し、不足している項目があれば指摘してください。";
            case "知識・スキル懸念事項":
              return "\n- 必須レイアウトの確認：\n  • 具体的なスキル状況の詳細説明\n  • 影響範囲と対応状況\n  • 今後の対応計画\n  上記の内容が具体的に記載されているかを確認し、不足している項目があれば指摘してください。";
            case "教育懸念事項":
              return "\n- 必須レイアウトの確認：\n  • 具体的な教育状況の詳細説明\n  • 影響範囲と対応状況\n  • 今後の対応計画\n  上記の内容が具体的に記載されているかを確認し、不足している項目があれば指摘してください。";
            case "緊急課題の詳細":
              return "\n- 必須レイアウトの確認：\n  • 具体的な緊急課題の詳細説明\n  • 緊急度と影響範囲\n  • 対応計画とタイムライン\n  上記の内容が具体的に記載されているかを確認し、不足している項目があれば指摘してください。";
            case "営業チャンス・顧客ニーズ":
              return "\n- 必須レイアウトの確認：\n  • ■顧客からの新たな要望、関心事\n  • ■今後の商談可能性\n  • ■市場動向・競合情報\n  上記の構成で記載されているかを確認し、不足している項目があれば指摘してください。";
            case "新たなリスク（総合分析）":
              return "\n- 必須レイアウトの確認：\n  • リスクの概要と対策が組み合わさった総合的な分析\n  • リスクの優先度と対応策の妥当性\n  • 実行可能性と効果的な対策\n  上記の内容が具体的に記載されているかを確認し、不足している項目があれば指摘してください。";
            case "品質（総合分析）":
              return "\n- 必須レイアウトの確認：\n  • 品質懸念事項とテスト進捗の総合的な分析\n  • 品質リスクと対応策の妥当性\n  • 品質確保のための実行計画\n  上記の内容が具体的に記載されているかを確認し、不足している項目があれば指摘してください。";
            default:
              return "";
          }
        };

        const layoutRequirements = getLayoutRequirements(fieldName);
        
        const analysisText = `週次報告の「${fieldName}」フィールドの内容を分析してください。\n\n内容:\n${content}${changeAnalysis}\n\n以下の観点から分析してください：\n- 内容の妥当性\n- 潜在的なリスクや課題\n- 改善提案\n- 追加で考慮すべき点${changeAnalysis ? "\n- 変更点の影響評価" : ""}${hasPreviousReportComparison ? "\n- 前回報告からの進捗状況" : ""}${layoutRequirements}${isContentUnchanged ? "\n- ⚠️ 重要: 前回報告から内容が変更されていません。これは以下のリスクを示している可能性があります：\n  • 進捗が停滞している\n  • 報告内容の更新を怠っている\n  • 状況認識が不十分\n  • 継続的な改善活動が行われていない\n  このような状況を改善するための具体的な提案を行ってください。" : ""}`;

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
          // 401エラー（認証切れ）の特別処理
          if (response.status === 401) {
            console.log("セッション期限切れ検出、認証状態を確認中...");
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
    };
  }, [analysisState]);

  return {
    analyzeField,
    clearAnalysis,
    getAnalysisState,
  };
}