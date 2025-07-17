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

  const analyzeField = useCallback(async (fieldName: string, content: string, originalContent?: string, previousReportContent?: string, forceAnalysis: boolean = false) => {
    if (!content || content.trim().length < 10) {
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
        const currentState = analysisState[fieldName];
        const previousContent = currentState?.previousContent;
        
        // 変更点を検出
        let changeAnalysis = "";
        if (originalContent && originalContent !== content) {
          changeAnalysis = `\n\n【元の内容からの変更点】\n元の内容:\n${originalContent}\n\n現在の内容:\n${content}`;
        } else if (previousContent && previousContent !== content) {
          changeAnalysis = `\n\n【前回からの変更点】\n前回の内容:\n${previousContent}\n\n現在の内容:\n${content}`;
        }
        
        // 前回報告との比較（レイアウト改善の参考として使用）
        let isContentUnchanged = false;
        
        if (previousReportContent && previousReportContent.trim() !== "") {
          // 正規化された内容で比較
          const normalizedPrevious = previousReportContent.trim().replace(/\s+/g, ' ');
          const normalizedCurrent = content.trim().replace(/\s+/g, ' ');
          const areEqual = normalizedPrevious === normalizedCurrent;
          
          if (areEqual) {
            // 内容が同じ場合は更新不足のリスクとして扱う
            isContentUnchanged = true;
            changeAnalysis += `\n\n【前回報告との比較】\n前回報告の内容:\n${previousReportContent}\n\n今回報告の内容:\n${content}\n\n⚠️ 重要: 前回報告と全く同じ内容です。進捗や状況に変化がない場合でも、現在の状況を改めて記載することが重要です。`;
          } else {
            changeAnalysis += `\n\n【前回報告との比較】\n前回報告の内容:\n${previousReportContent}\n\n今回報告の内容:\n${content}`;
          }
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

        // フィールド固有のレイアウト要件と記載例を定義
        const getLayoutRequirements = (fieldName: string) => {
          switch (fieldName) {
            case "今週の作業内容":
              return "\n\n【必須レイアウト】\n■主な作業\n■計画との差異（遅延・前倒し等）\n■リスク評価\n  評価: 大・中・小\n  理由: [具体的な理由]\n\n【記載例】\n■主な作業\n・システム設計書の作成（完了率80%）\n・API実装（ユーザー認証機能完了）\n・単体テスト実施（10件中8件完了）\n\n■計画との差異\n・設計書レビューで仕様変更が発生し、1日遅延\n・API実装は想定より効率化でき、半日前倒し\n\n■リスク評価\n  評価: 中\n  理由: 設計変更により結合テスト開始が遅れる可能性";
            case "遅延・問題点の詳細":
              return "\n\n【必須レイアウト】\n・具体的な遅延・問題点の詳細説明\n・影響範囲と対応状況\n・今後の対応計画\n\n【記載例】\n・データベース接続処理で予期しないエラーが発生\n・影響範囲：ユーザー登録機能全般、テスト工程にも影響\n・対応状況：原因特定済み、修正コード実装中\n・今後の対応：明日中に修正完了予定、追加テスト2日間";
            case "課題・問題点":
              return "\n\n【必須レイアウト】\n■内容\n■深刻度\n  評価: 大・中・小\n  理由: [具体的な理由]\n■対応状況\n\n【記載例】\n■内容\n・外部APIのレスポンス時間が想定より遅く、ユーザビリティに影響\n\n■深刻度\n  評価: 中\n  理由: ユーザー体験の悪化により、顧客満足度低下の可能性\n\n■対応状況\n・キャッシュ機能の実装を検討中\n・来週までに対応策を決定し、実装開始予定";
            case "変更内容の詳細":
              return "\n\n【必須レイアウト】\n■変更された内容\n■変更理由と影響\n■リスク評価\n  評価: 大・中・小\n  理由: [具体的な理由]\n\n【記載例】\n■変更された内容\n・ユーザー認証方式をセッション方式からJWT方式に変更\n\n■変更理由と影響\n・セキュリティ強化とスケーラビリティ向上のため\n・フロントエンド側の認証処理も合わせて変更が必要\n\n■リスク評価\n  評価: 中\n  理由: 既存機能への影響範囲が広く、テスト工数増加";
            case "来週の作業予定":
              return "\n\n【必須レイアウト】\n■作業予定\n■想定される懸念\n■リスク評価\n  評価: 大・中・小\n  理由: [具体的な理由]\n\n【記載例】\n■作業予定\n・結合テストの実施（3日間）\n・性能テストの準備と実行（2日間）\n・バグ修正と再テスト\n\n■想定される懸念\n・外部システムとの連携テストで不具合発生の可能性\n・性能要件を満たさない場合の対応時間確保\n\n■リスク評価\n  評価: 中\n  理由: テスト工程は不確定要素が多く、スケジュール調整が必要になる可能性";
            case "支援・判断の要望事項":
              return "\n\n【必須レイアウト】\n・具体的な支援要請内容\n・判断が必要な事項\n・緊急度と理由\n\n【記載例】\n・データベース設計のレビュー支援をお願いします\n・外部API選定について技術的判断が必要（A社 vs B社）\n・緊急度：高（来週火曜日までに決定が必要、開発スケジュールへの影響大）";
            case "リソース懸念事項":
              return "\n\n【必須レイアウト】\n・具体的なリソース懸念の詳細説明\n・影響範囲と対応状況\n・今後の対応計画\n\n【記載例】\n・テスト専任者の不足により、テスト工程に遅延リスク\n・影響範囲：結合テスト、性能テスト、受入テスト全般\n・対応状況：他プロジェクトからの応援要請を検討中\n・今後の対応：来週月曜日までに人員配置を確定";
            case "顧客懸念事項":
              return "\n\n【必須レイアウト】\n・具体的な顧客状況の詳細説明\n・顧客満足度や評価\n・改善点や対応計画\n\n【記載例】\n・顧客からUI/UXについて「操作が分かりにくい」との指摘\n・顧客満足度：現在7/10、目標8/10以上\n・改善点：ナビゲーション改善、ヘルプ機能強化\n・対応計画：来週UI改修着手、2週間後にユーザビリティテスト実施";
            case "環境懸念事項":
              return "\n\n【必須レイアウト】\n・具体的な環境状況の詳細説明\n・影響範囲と対応状況\n・今後の対応計画\n\n【記載例】\n・開発環境のサーバー不安定により、作業効率低下\n・影響範囲：開発チーム全体、テスト環境にも波及\n・対応状況：インフラチームと連携し、原因調査中\n・今後の対応：今週中にサーバー交換、来週から正常稼働予定";
            case "コスト懸念事項":
              return "\n\n【必須レイアウト】\n・具体的なコスト状況の詳細説明\n・予算との差異分析\n・今後の見込みと対策\n\n【記載例】\n・クラウドサービス利用料が予算を20%超過\n・予算との差異：月額50万円の予算に対し、実績60万円\n・原因：データ転送量が想定より多い\n・今後の見込み：現状維持なら月10万円オーバー継続\n・対策：データ圧縮機能実装、不要なデータ転送削減";
            case "知識・スキル懸念事項":
              return "\n\n【必須レイアウト】\n・具体的なスキル状況の詳細説明\n・影響範囲と対応状況\n・今後の対応計画\n\n【記載例】\n・新技術（React）の習得が不十分で、開発効率低下\n・影響範囲：フロントエンド開発全般、品質リスクも存在\n・対応状況：オンライン研修受講中、先輩エンジニアからのレビュー強化\n・今後の対応：来週まで集中学習、実装は段階的にレベルアップ";
            case "教育懸念事項":
              return "\n\n【必須レイアウト】\n・具体的な教育状況の詳細説明\n・影響範囲と対応状況\n・今後の対応計画\n\n【記載例】\n・新入社員の技術習得が計画より遅れ気味\n・影響範囲：チーム全体の生産性、教育担当者の負荷増\n・対応状況：個別指導時間を増やし、基礎学習を強化\n・今後の対応：来月から実践的な小規模タスクを担当、段階的にスキルアップ";
            case "緊急課題の詳細":
              return "\n\n【必須レイアウト】\n・具体的な緊急課題の詳細説明\n・緊急度と影響範囲\n・対応計画とタイムライン\n\n【記載例】\n・本番環境でデータ整合性エラーが発生\n・緊急度：最高（サービス停止リスク）\n・影響範囲：全ユーザー、データ信頼性に関わる問題\n・対応計画：今日中に原因特定、明日朝までに修正適用\n・タイムライン：調査完了→修正実装→テスト→本番適用";
            case "営業チャンス・顧客ニーズ":
              return "\n\n【必須レイアウト】\n■顧客からの新たな要望、関心事\n■今後の商談可能性\n■市場動向・競合情報\n\n【記載例】\n■顧客からの新たな要望、関心事\n・モバイルアプリ版の開発要望\n・AI機能の追加への関心\n・セキュリティ強化の要求\n\n■今後の商談可能性\n・追加開発案件：確度70%、来月提案予定\n・保守契約延長：確度90%、条件交渉中\n\n■市場動向・競合情報\n・競合他社がAI機能を標準搭載開始\n・市場全体でセキュリティ要求レベルが向上";
            case "新たなリスク（総合分析）":
              return "\n\n【必須レイアウト】\n・リスクの概要と対策が組み合わさった総合的な分析\n・リスクの優先度と対応策の妥当性\n・実行可能性と効果的な対策\n\n【記載例】\n・技術的リスク：新フレームワーク採用による学習コスト増\n・スケジュールリスク：外部連携システムの仕様変更\n・品質リスク：テスト工程の短縮による品質低下\n・優先度：技術的リスク（高）、スケジュールリスク（中）、品質リスク（高）\n・対応策：技術研修強化、外部ベンダーとの定期MTG、テスト自動化推進\n・実行可能性：研修は実施済み、MTG体制構築中、自動化ツール導入検討";
            case "品質（総合分析）":
              return "\n\n【必須レイアウト】\n・品質懸念事項とテスト進捗の総合的な分析\n・品質リスクと対応策の妥当性\n・品質確保のための実行計画\n\n【記載例】\n・品質懸念：コードレビュー時間不足による潜在バグ\n・テスト進捗：単体テスト80%完了、結合テスト未着手\n・品質リスク：リリース後のバグ発生率増加、顧客満足度低下\n・対応策：レビュー体制強化、テスト工程前倒し、品質チェックリスト活用\n・実行計画：来週からペアプログラミング導入、テスト自動化率向上";
            default:
              return "";
          }
        };

        const layoutRequirements = getLayoutRequirements(fieldName);
        
        const analysisText = `週次報告の「${fieldName}」フィールドの記載内容を正しいレイアウトで改善してください。\n\n現在の記載内容:\n${content}${changeAnalysis}\n\n【分析目的】\n正しいレイアウトで記載内容のレベルを上げることが目的です。\n\n【分析指示】\n1. 現在の記載内容が正しいレイアウトに準拠しているかチェックしてください\n2. レイアウトに問題がある場合は、正しいレイアウトでの記載例を提示してください\n3. 記載内容のレベルアップのため、より具体的で有用な内容への改善提案を行ってください${layoutRequirements}${isContentUnchanged ? "\n\n⚠️ 前回報告から内容が変更されていません。レイアウトを維持しつつ、最新の状況を反映した内容に更新してください。" : ""}`;

        if (process.env.NODE_ENV === 'development') {
          console.log("AI分析プロンプト生成:", {
            fieldName,
            analysisTextLength: analysisText.length,
            isContentUnchanged
          });
        }

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
            text: analysisText,
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
    };
  }, [analysisState]);

  const regenerateAnalysis = useCallback((fieldName: string, content: string, originalContent?: string, previousReportContent?: string) => {
    console.log("regenerateAnalysis called:", { fieldName, contentLength: content?.length, originalContent, previousReportContent });
    
    // 既存の分析をクリアしてから再生成
    setAnalysisState(prev => ({
      ...prev,
      [fieldName]: {
        analysis: null,
        isLoading: false,
        error: null,
        previousContent: prev[fieldName]?.previousContent,
      },
    }));

    // 強制的に分析を実行
    analyzeField(fieldName, content, originalContent, previousReportContent, true);
  }, [analyzeField]);

  return {
    analyzeField,
    clearAnalysis,
    getAnalysisState,
    regenerateAnalysis,
  };
}