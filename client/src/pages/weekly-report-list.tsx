import { useQuery, useMutation } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { WeeklyReport, Case } from "@shared/schema";
import { Card, CardContent } from "@/components/ui/card";
import { ThemeToggle } from "@/components/theme-toggle";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Copy, List, Plus, ChevronRight, FileText, Loader2, Home, Briefcase, PenSquare, Check, X, ExternalLink, HelpCircle } from "lucide-react";
import { 
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator
} from "@/components/ui/breadcrumb";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useListPerformance } from "@/hooks/use-performance";
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogClose,
  DialogFooter
} from "@/components/ui/dialog";
import { Calendar } from "@/components/ui/calendar";
import { apiRequest, queryClient } from "@/lib/queryClient";
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

// レスポンスの型定義
type MonthlySummaryResponse = {
  projectName: string;
  period: {
    start: string;
    end: string;
  };
  summary: string;
  reportCount: number;
  caseCount: number;
};

// 月次報告書の型定義
type MonthlyReport = {
  id: number;
  projectName: string;
  yearMonth: string;
  caseIds: string | null;
  startDate: string;
  endDate: string;
  content: string;
  aiProvider: string | null;
  createdAt: string;
  updatedAt: string;
};

export default function WeeklyReportList() {
  const { toast } = useToast();
  const [location, setLocation] = useLocation();
  
  // パフォーマンス監視（レポート件数は後で動的に設定）
  const { measureOperation, measureRender } = useListPerformance('WeeklyReportList', 0);
  const [selectedProject, setSelectedProject] = useState<string | null>(null);
  const [selectedCase, setSelectedCase] = useState<number | null>(null);
  const [milestone, setMilestone] = useState<string>("");
  const [isMilestoneEditing, setIsMilestoneEditing] = useState<boolean>(false);
  const [monthlySummary, setMonthlySummary] = useState<string>("");
  const [summaryDialogOpen, setSummaryDialogOpen] = useState<boolean>(false);
  const [dateDialogOpen, setDateDialogOpen] = useState<boolean>(false);
  const [monthlySummaryPeriod, setMonthlySummaryPeriod] = useState<{start: string, end: string} | null>(null);
  const [startDate, setStartDate] = useState<Date | undefined>(undefined);
  const [endDate, setEndDate] = useState<Date | undefined>(undefined);
  const [tempProjectName, setTempProjectName] = useState<string>("");
  const [promptData, setPromptData] = useState<string>("");
  const [selectedCaseIds, setSelectedCaseIds] = useState<number[]>([]);
  const [choiceDialogOpen, setChoiceDialogOpen] = useState<boolean>(false);
  const [existingReport, setExistingReport] = useState<MonthlyReport | null>(null);
  const [selectedChoiceParams, setSelectedChoiceParams] = useState<{ projectName: string, startDate?: string, endDate?: string, caseIds?: number[] } | null>(null);

  // マイルストーン更新のmutation
  const updateMilestoneMutation = useMutation<Case, Error, { caseId: number, milestone: string }>({
    mutationFn: async ({ caseId, milestone }) => {
      return apiRequest<Case>(`/api/cases/${caseId}/milestone`, {
        method: "PATCH",
        data: { milestone }
      });
    },
    onSuccess: (updatedCase) => {
      // 個別の案件キャッシュも更新
      queryClient.invalidateQueries({ queryKey: [`/api/cases/${updatedCase.id}`] });
      // 案件一覧のキャッシュも更新
      queryClient.invalidateQueries({ queryKey: ["/api/cases"] });

      // キャッシュ無効化後、最新データを取得して適用
      setTimeout(() => {
        fetchLatestCaseData(updatedCase.id);
      }, 100);

      toast({duration: 1000,});
      setIsMilestoneEditing(false);
    },
    onError: (error) => {
      console.error("Error updating milestone:", error);
      toast({duration: 1000,});
    }
  });

  // 月次サマリー入力データを取得するmutation
  const monthlySummaryInputMutation = useMutation<{prompt: string}, Error, { projectName: string, startDate?: string, endDate?: string, caseIds?: number[] }>({
    mutationFn: async ({ projectName, startDate, endDate, caseIds }) => {
      let url = `/api/monthly-summary-input/${encodeURIComponent(projectName)}`;

      // クエリパラメータを追加
      const params = new URLSearchParams();
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);

      // 選択された案件IDsがある場合は追加
      if (caseIds && caseIds.length > 0) {
        caseIds.forEach(id => params.append('caseId', id.toString()));
      }

      // クエリパラメータがある場合は追加
      if (params.toString()) {
        url += `?${params.toString()}`;
      }

      return apiRequest<{prompt: string}>(url, { method: "GET" });
    },
    onSuccess: (data) => {
      setPromptData(data.prompt);
    },
    onError: (error) => {
      console.error("Error retrieving monthly summary input data:", error);
      toast({duration: 1000,});
    }
  });

  // 月次サマリーを生成するmutation
  const monthlySummaryMutation = useMutation<MonthlySummaryResponse, Error, { projectName: string, startDate?: string, endDate?: string, caseIds?: number[] }>({
    mutationFn: async ({ projectName, startDate, endDate, caseIds }) => {
      let url = `/api/monthly-summary/${encodeURIComponent(projectName)}`;

      // クエリパラメータを追加
      const params = new URLSearchParams();
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);

      // 選択された案件IDsがある場合は追加
      if (caseIds && caseIds.length > 0) {
        caseIds.forEach(id => params.append('caseId', id.toString()));
      }

      // クエリパラメータがある場合は追加
      if (params.toString()) {
        url += `?${params.toString()}`;
      }

      return apiRequest<MonthlySummaryResponse>(url, { method: "GET" });
    },
    onSuccess: (data) => {
      setMonthlySummary(data.summary);
      if (data.period) {
        setMonthlySummaryPeriod(data.period);
      }
      setSummaryDialogOpen(true);

      // 選択された案件数に関する情報を追加
      const selectedMsg = selectedCaseIds.length > 0 
        ? `選択された${selectedCaseIds.length}件の案件の` 
        : "";

      toast({
        title: "月次報告書の生成が完了しました",
        description: `${selectedMsg}${data.reportCount}件の週次報告から作成しました`,
      });
    },
    onError: (error) => {
      console.error("Error generating monthly summary:", error);
      toast({duration: 1000,});
    }
  });

  // 最新の月次報告書を取得するmutation
  const latestMonthlyReportMutation = useMutation<MonthlyReport, Error, { projectName: string, startDate?: string, endDate?: string, caseIds?: number[] }>({
    mutationFn: async ({ projectName, startDate, endDate, caseIds }) => {
      let url = `/api/monthly-reports/latest/${encodeURIComponent(projectName)}`;
      const params = new URLSearchParams();
      
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);
      if (caseIds && caseIds.length > 0) {
        caseIds.forEach(id => params.append('caseId', id.toString()));
      }
      
      if (params.toString()) {
        url += `?${params.toString()}`;
      }
      
      return await apiRequest(url, { method: "GET" });
    },
    onSuccess: (data) => {
      setExistingReport(data);
      setChoiceDialogOpen(true);
    },
    onError: (error) => {
      // 404エラー（報告書が存在しない）の場合は直接生成
      if (error.message.includes('404')) {
        console.log("No existing report found, proceeding with generation");
        handleGenerateNewReport();
      } else {
        console.error("Error fetching latest monthly report:", error);
        toast({duration: 1000,});
      }
    }
  });

  // URLパラメータから初期値を設定 & リセット機能
  useEffect(() => {
    // ブラウザの場合のみURLSearchParamsを使用
    if (typeof window !== 'undefined') {
      try {
        // URLから直接クエリパラメータを取得
        const url = new URL(window.location.href);
        const projectNameParam = url.searchParams.get('projectName');
        const caseIdParam = url.searchParams.get('caseId');
        const resetParam = url.searchParams.get('reset');

        console.log('URL Params:', { projectNameParam, caseIdParam, resetParam });

        // リセットパラメータがある場合は状態をクリア
        if (resetParam === 'true') {
          setSelectedProject(null);
          setSelectedCase(null);
          // クリーンなURLに更新（ブラウザ履歴を更新せずに）
          window.history.replaceState({}, '', '/reports');
        } else {
          // 通常のパラメータ処理
          if (projectNameParam) {
            setSelectedProject(decodeURIComponent(projectNameParam));
          }

          if (caseIdParam) {
            const caseId = parseInt(caseIdParam);
            if (!isNaN(caseId)) {
              setSelectedCase(caseId);

              // 案件データが読み込まれた後に実行される handleCaseSelect の処理を待つ
              // 実際の処理は handleCaseSelect 内で行われる
            }
          }
        }
      } catch (err) {
        console.error('Error parsing URL parameters:', err);
      }
    }
  }, [location]); // locationを依存配列に入れて、URLが変わったときに再実行

  // すべての週次報告を取得（軽量版）
  const { data: reports, isLoading: isLoadingReports } = useQuery<WeeklyReport[]>({
    queryKey: ["/api/weekly-reports"],
    staleTime: 5 * 60 * 1000, // 5分間キャッシュ
  });

  // すべての案件を取得
  const { data: cases, isLoading: isLoadingCases } = useQuery<Case[]>({
    queryKey: ["/api/cases"],
    staleTime: 10 * 60 * 1000, // 10分間キャッシュ（案件情報は変更頻度が低い）
  });

  // URLパラメータからの初期値設定は既に別のuseEffectで対応済み

  // 選択された案件に紐づく週次報告を取得
  const { data: caseReports, isLoading: isLoadingCaseReports } = useQuery<WeeklyReport[]>({
    queryKey: [`/api/weekly-reports/by-case/${selectedCase}`],
    staleTime: 0,
    enabled: selectedCase !== null,
  });

  // マイルストーン初期化のための参照を保持
  const initialMilestoneSetRef = useRef<boolean>(false);

  // 案件情報をIDでマップ化 - フックの順序を保つためloadingチェックの前に移動
  const caseMap = useMemo(() => 
    new Map(cases?.map(case_ => [case_.id, case_]) || []), 
    [cases]
  );

  // 選択された案件の最新情報を取得する関数（一貫性のために関数定義を上部に移動）
  // ローディング状態のチェックとレンダリング
  const isLoading = isLoadingReports || isLoadingCases || (selectedCase !== null && isLoadingCaseReports);

  const fetchLatestCaseData = useCallback(async (caseId: number) => {
    try {
      // API経由で最新の案件情報を取得
      const latestCaseData = await apiRequest<Case>(`/api/cases/${caseId}`, {
        method: "GET",
      });

      // マイルストーン情報を更新
      setMilestone(latestCaseData.milestone || "");

      console.log("Successfully loaded latest milestone data for case:", caseId);
      return latestCaseData;
    } catch (error) {
      console.error("最新の案件情報取得中にエラーが発生しました:", error);
      // エラーの場合は現在のキャッシュされたデータを使用
      const currentCase = caseMap.get(caseId);
      if (currentCase) {
        setMilestone(currentCase.milestone || "");
      }
      return null;
    }
  }, [caseMap]);

  // マイルストーン取得・更新用のuseEffect
  useEffect(() => {
    // selectedCaseが有効で、casesデータがある場合のみ処理を実行
    if (selectedCase && cases && cases.length > 0) {
      // まず現在のキャッシュから初期値を設定
      const currentCase = caseMap.get(selectedCase);
      if (currentCase) {
        setMilestone(currentCase.milestone || "");
        initialMilestoneSetRef.current = true;
      }

      // API呼び出しを実行
      fetchLatestCaseData(selectedCase);
    }
  }, [selectedCase, cases, caseMap]);

  // プロジェクト名でユニークなリストを作成し、アルファベット順にソート
  const projectNames = Array.from(new Set(cases?.map(case_ => case_.projectName) || []))
    .sort((a, b) => a.localeCompare(b, 'ja'));

  // プロジェクトごとに案件をグループ化
  const projectCasesMap = cases?.reduce((acc, case_) => {
    const projectName = case_.projectName;
    if (!acc[projectName]) {
      acc[projectName] = [];
    }
    acc[projectName].push(case_);
    return acc;
  }, {} as Record<string, Case[]>) ?? {};

  // 初めて画面を開いた時、最初のプロジェクトを選択状態にする
  if (projectNames.length > 0 && selectedProject === null) {
    setSelectedProject(projectNames[0]);
  }

  const copyToClipboard = (report: WeeklyReport) => {
    const case_ = caseMap.get(report.caseId);
    if (!case_) return;

    const progressStatusMap = {
      "on-schedule": "予定通り",
      "slightly-delayed": "少し遅れている",
      "severely-delayed": "大幅に遅れている",
      ahead: "前倒しで進行中",
    };

    const qualityConcernsMap = {
      none: "なし",
      minor: "軽微な懸念あり",
      major: "重大な懸念あり",
    };

    const riskLevelMap = {
      high: "高",
      medium: "中",
      low: "低",
    };

    // マークダウン形式のデータを構築
    const markdownData = `
## 報告基本情報
- **報告期間**: ${report.reportPeriodStart} ～ ${report.reportPeriodEnd}
- **プロジェクト名**: ${case_.projectName}
- **案件名**: ${case_.caseName}
- **報告者名**: ${report.reporterName}

## 今週の進捗
- **作業内容**:
${report.weeklyTasks ? report.weeklyTasks.split('\n').map(line => `  - ${line.trim()}`).filter(line => line.length > 3).join('\n') : ''}
- **進捗率**: ${report.progressRate}%
- **進捗状況**: ${progressStatusMap[report.progressStatus as keyof typeof progressStatusMap] || report.progressStatus}

## 遅延・問題点
- **遅延・問題点の有無**: ${report.delayIssues === "yes" ? "あり" : "なし"}
${report.delayDetails ? `- **遅延・問題点の詳細**:\n  ${report.delayDetails.split('\n').map(line => `  - ${line.trim()}`).filter(line => line.length > 3).join('\n')}` : ''}

## 課題・リスク
- **課題・問題点**:
${report.issues ? report.issues.split('\n').map(line => `  - ${line.trim()}`).filter(line => line.length > 3).join('\n') : ''}
- **新たなリスクの有無**: ${report.newRisks === "yes" ? "あり" : "なし"}
${report.riskSummary ? `- **リスクの概要**:\n  ${report.riskSummary.split('\n').map(line => `  - ${line.trim()}`).filter(line => line.length > 3).join('\n')}` : ''}
${report.riskCountermeasures ? `- **リスク対策**:\n  ${report.riskCountermeasures.split('\n').map(line => `  - ${line.trim()}`).filter(line => line.length > 3).join('\n')}` : ''}
${report.riskLevel ? `- **リスクレベル**: ${riskLevelMap[report.riskLevel as keyof typeof riskLevelMap]}` : ''}

## 品質状況
- **品質懸念事項の有無**: ${qualityConcernsMap[report.qualityConcerns as keyof typeof qualityConcernsMap] || ""}
${report.qualityDetails ? `- **品質懸念事項の詳細**:\n  ${report.qualityDetails.split('\n').map(line => `  - ${line.trim()}`).filter(line => line.length > 3).join('\n')}` : ''}
${report.testProgress ? `- **テスト進捗状況**:\n  ${report.testProgress.split('\n').map(line => `  - ${line.trim()}`).filter(line => line.length > 3).join('\n')}` : ''}

## 変更管理
- **変更の有無**: ${report.changes === "yes" ? "あり" : "なし"}
${report.changeDetails ? `- **変更内容の詳細**:\n  ${report.changeDetails.split('\n').map(line => `  - ${line.trim()}`).filter(line => line.length > 3).join('\n')}` : ''}

## 今後の計画
- **来週の作業予定**:
${report.nextWeekPlan ? report.nextWeekPlan.split('\n').map(line => `  - ${line.trim()}`).filter(line => line.length > 3).join('\n') : ''}
- **支援・判断の要望事項**:
${report.supportRequests ? report.supportRequests.split('\n').map(line => `  - ${line.trim()}`).filter(line => line.length > 3).join('\n') : ''}

## 懸念事項
- **リソースに関する懸念**: ${report.resourceConcerns === "exists" ? "あり" : "なし"}
${report.resourceDetails ? `- **リソースの詳細**:\n  ${report.resourceDetails.split('\n').map(line => `  - ${line.trim()}`).filter(line => line.length > 3).join('\n')}` : ''}
- **顧客に関する懸念**: ${report.customerIssues === "exists" ? "あり" : "なし"}
${report.customerDetails ? `- **顧客の詳細**:\n  ${report.customerDetails.split('\n').map(line => `  - ${line.trim()}`).filter(line => line.length > 3).join('\n')}` : ''}
- **環境に関する懸念**: ${report.environmentIssues === "exists" ? "あり" : "なし"}
${report.environmentDetails ? `- **環境の詳細**:\n  ${report.environmentDetails.split('\n').map(line => `  - ${line.trim()}`).filter(line => line.length > 3).join('\n')}` : ''}
- **コストに関する懸念**: ${report.costIssues === "exists" ? "あり" : "なし"}
${report.costDetails ? `- **コストの詳細**:\n  ${report.costDetails.split('\n').map(line => `  - ${line.trim()}`).filter(line => line.length > 3).join('\n')}` : ''}
- **知識・スキルに関する懸念**: ${report.knowledgeIssues === "exists" ? "あり" : "なし"}
${report.knowledgeDetails ? `- **知識・スキルの詳細**:\n  ${report.knowledgeDetails.split('\n').map(line => `  - ${line.trim()}`).filter(line => line.length > 3).join('\n')}` : ''}
- **教育に関する懸念**: ${report.trainingIssues === "exists" ? "あり" : "なし"}
${report.trainingDetails ? `- **教育の詳細**:\n  ${report.trainingDetails.split('\n').map(line => `  - ${line.trim()}`).filter(line => line.length > 3).join('\n')}` : ''}
- **緊急課題に関する懸念**: ${report.urgentIssues === "exists" ? "あり" : "なし"}
${report.urgentDetails ? `- **緊急課題の詳細**:\n  ${report.urgentDetails.split('\n').map(line => `  - ${line.trim()}`).filter(line => line.length > 3).join('\n')}` : ''}

## ビジネス機会
- **営業チャンス・顧客ニーズ**: ${report.businessOpportunities === "exists" ? "あり" : "なし"}
${report.businessDetails ? `- **営業チャンス・顧客ニーズの詳細**:\n  ${report.businessDetails.split('\n').map(line => `  - ${line.trim()}`).filter(line => line.length > 3).join('\n')}` : ''}
`;

    navigator.clipboard
      .writeText(markdownData)
      .then(() => {
        toast({duration: 1000,});
      })
      .catch(() => {
        toast({duration: 1000,});
      });
  };

  // fetchLatestCaseData関数は上部に移動済み

  // 案件を選択した時の処理
  const handleCaseSelect = (caseId: number) => {
    setSelectedCase(caseId);
    setIsMilestoneEditing(false);

    // 案件選択時に最新の情報を取得
    fetchLatestCaseData(caseId);
  };

  // マイルストーン編集開始
  const startEditingMilestone = () => {
    setIsMilestoneEditing(true);
  };

  // マイルストーン保存
  const saveMilestone = () => {
    if (selectedCase) {
      updateMilestoneMutation.mutate({
        caseId: selectedCase,
        milestone: milestone
      });
    }
  };

  // マイルストーン編集キャンセル
  const cancelEditingMilestone = () => {
    // 選択されている案件のマイルストーンに戻す
    if (selectedCase) {
      const selectedCaseData = caseMap.get(selectedCase);
      if (selectedCaseData) {
        setMilestone(selectedCaseData.milestone || "");
      }
    }
    setIsMilestoneEditing(false);
  };

  // プロジェクトを変更した時に案件選択をリセット
  const handleProjectChange = (projectName: string) => {
    setSelectedProject(projectName);
    setSelectedCase(null);
  };

  // 案件選択をリセットする処理
  const resetCaseSelection = () => {
    setSelectedCase(null);
  };

  // 月次サマリー生成のための日付選択ダイアログを表示
  const showDateDialog = (projectName: string) => {
    // 日付を1ヶ月前に初期化
    const end = new Date();
    const start = new Date();
    start.setMonth(start.getMonth() - 1);

    // 日付を設定
    setEndDate(end);
    setStartDate(start);
    setTempProjectName(projectName);
    // 案件選択をリセット
    setSelectedCaseIds([]);
    setDateDialogOpen(true);
  };

  // 案件の選択状態を切り替える処理
  const toggleCaseSelection = (caseId: number) => {
    setSelectedCaseIds(prev => 
      prev.includes(caseId)
        ? prev.filter(id => id !== caseId)
        : [...prev, caseId]
    );
  };

  // すべての案件を選択/選択解除する処理
  const toggleAllCases = (projectName: string, select: boolean) => {
    if (select) {
      // プロジェクト内のすべての案件IDを取得して選択
      const allProjectCaseIds = (projectCasesMap[projectName] || [])
        .filter(case_ => !case_.isDeleted)
        .map(case_ => case_.id);
      setSelectedCaseIds(allProjectCaseIds);
    } else {
      // 選択解除
      setSelectedCaseIds([]);
    }
  };


  // 既存報告書をチェックして、選択ダイアログまたは直接生成へ
  const generateMonthlySummaryWithDates = () => {
    if (!tempProjectName || !startDate || !endDate) return;

    setDateDialogOpen(false);

    // yyyy-MM-dd形式にフォーマット
    const formatDate = (date: Date) => {
      return date.toISOString().split('T')[0];
    };

    // パラメータを保存
    const params: {
      projectName: string, 
      startDate: string, 
      endDate: string,
      caseIds?: number[]
    } = {
      projectName: tempProjectName,
      startDate: formatDate(startDate),
      endDate: formatDate(endDate)
    };

    // 案件が選択されている場合は追加
    if (selectedCaseIds.length > 0) {
      params.caseIds = selectedCaseIds;
    }

    // パラメータを保存して既存報告書をチェック
    setSelectedChoiceParams(params);
    latestMonthlyReportMutation.mutate(params);
  };

  // 新しい報告書を生成する関数
  const handleGenerateNewReport = () => {
    if (!selectedChoiceParams) return;

    setChoiceDialogOpen(false);
    setMonthlySummary("");
    setMonthlySummaryPeriod(null);

    toast({duration: 1000,});

    monthlySummaryMutation.mutate(selectedChoiceParams);
  };

  // 既存報告書を表示する関数
  const handleShowExistingReport = () => {
    if (!existingReport) return;

    setChoiceDialogOpen(false);
    setMonthlySummary(existingReport.content);
    setMonthlySummaryPeriod({
      start: existingReport.startDate,
      end: existingReport.endDate
    });
    setTempProjectName(existingReport.projectName);
    setSummaryDialogOpen(true);
  };

  // 選択された期間のインプットデータを取得してコピー
  const getAndCopyInputData = () => {
    if (!tempProjectName || !startDate || !endDate) return;

    // yyyy-MM-dd形式にフォーマット
    const formatDate = (date: Date) => {
      return date.toISOString().split('T')[0];
    };

    toast({duration: 1000,});

    console.log("プロジェクト処理開始:", tempProjectName);

    // プロジェクト名はそのまま使用
    const processedProjectName = tempProjectName;

    // 選択された案件IDsがある場合のみ含める
    const params: {
      projectName: string, 
      startDate: string, 
      endDate: string,
      caseIds?: number[]
    } = {
      projectName: processedProjectName,
      startDate: formatDate(startDate),
      endDate: formatDate(endDate)
    };

    // 案件が選択されている場合は追加
    if (selectedCaseIds.length > 0) {
      params.caseIds = selectedCaseIds;
    }

    // インプットデータを取得
    monthlySummaryInputMutation.mutate(params, {
      onSuccess: (data) => {
        // 成功したらクリップボードにコピー
        navigator.clipboard
          .writeText(data.prompt)
          .then(() => {
            const selectedMsg = selectedCaseIds.length > 0 
              ? `（選択された${selectedCaseIds.length}件の案件が対象）` 
              : "";

            console.log("インプットデータ取得完了:", { 
              projectName: params.projectName,
              startDate: params.startDate,
              endDate: params.endDate,
              selectedCaseIds: params.caseIds
            });

            toast({
              title: "コピー完了",
              description: `月次報告書の生成に使用するインプットデータをマークダウン形式でクリップボードにコピーしました。${selectedMsg}`,
            });
          })
          .catch(() => {
            toast({duration: 1000,});
          });
      }
    });
  };

  // 月次サマリーをクリップボードにコピーする処理
  const copyMonthlySummaryToClipboard = () => {
    if (!monthlySummary) return;

    navigator.clipboard
      .writeText(monthlySummary)
      .then(() => {
        toast({duration: 1000,});
      })
      .catch(() => {
        toast({duration: 1000,});
      });
  };

  // ローディング中の表示
  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-8 max-w-5xl">
          <p className="text-center">読み込み中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <ThemeToggle />

      <div className="container mx-auto px-4 py-8 max-w-5xl">
        <header className="mb-8">
          <div className="flex justify-between items-center mb-4">
            <h1 className="text-3xl font-bold text-primary">
              {selectedCase !== null ? "案件別週次報告一覧" : "週次報告一覧"}
            </h1>
            <div className="flex items-center gap-4">
              <Link href="/report/new">
                <Button variant="outline" size="sm" className="flex items-center gap-2">
                  <Plus className="h-4 w-4" />
                  新規報告作成
                </Button>
              </Link>
              <Link href="/cases">
                <Button variant="outline" size="sm" className="flex items-center gap-2">
                  <List className="h-4 w-4" />
                  案件一覧
                </Button>
              </Link>
            </div>
          </div>
          <div className="flex justify-start">
            <Link href="/">
              <Button variant="ghost" size="sm">
                ホームに戻る
              </Button>
            </Link>
          </div>
        </header>

        {/* パンくずリスト - 常に表示 */}
        <Breadcrumb className="mt-2 mb-4">
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link href="/">
                  <span className="flex items-center gap-1">
                    <Home className="h-3.5 w-3.5" />
                    ホーム
                  </span>
                </Link>
              </BreadcrumbLink>
            </BreadcrumbItem>

            <BreadcrumbSeparator />

            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link href="/cases">
                  <span className="flex items-center gap-1">
                    <Briefcase className="h-3.5 w-3.5" />
                    案件一覧
                  </span>
                </Link>
              </BreadcrumbLink>
            </BreadcrumbItem>

            {selectedCase === null ? (
              <>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbPage>
                    <span className="flex items-center gap-1">
                      <FileText className="h-3.5 w-3.5" />
                      週次報告一覧
                    </span>
                  </BreadcrumbPage>
                </BreadcrumbItem>
              </>
            ) : (
              <>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbLink asChild>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={resetCaseSelection}
                      className="flex items-center gap-1 h-auto p-0"
                    >
                      <FileText className="h-3.5 w-3.5" />
                      週次報告一覧
                    </Button>
                  </BreadcrumbLink>
                </BreadcrumbItem>

                <BreadcrumbSeparator />

                <BreadcrumbItem>
                  <BreadcrumbPage>
                    {caseMap.get(selectedCase)?.caseName}
                  </BreadcrumbPage>
                </BreadcrumbItem>
              </>
            )}
          </BreadcrumbList>
        </Breadcrumb>

        {/* マイルストーン編集エリア - 案件が選択されている場合のみ表示 */}
        {selectedCase !== null && (
          <div className="mt-4 mb-6 p-4 border rounded-lg bg-muted/20">
            <div className="flex justify-between items-start mb-2">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-semibold">マイルストーン</h3>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <HelpCircle className="h-4 w-4 text-muted-foreground hover:text-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-md p-4">
                        <div className="space-y-2 text-sm">
                          <div className="font-semibold">マークダウン記法例:</div>
                          <div className="space-y-1 font-mono text-xs">
                            <div># 見出し1</div>
                            <div>## 見出し2</div>
                            <div>### 見出し3</div>
                            <div className="mt-2">- リスト項目</div>
                            <div>- [ ] 未完了タスク</div>
                            <div>- [x] 完了タスク</div>
                            <div className="mt-2">**太字** *斜体*</div>
                            <div className="mt-2">| 列1 | 列2 |</div>
                            <div>|-----|-----|</div>
                            <div>| 値1 | 値2 |</div>
                            <div className="mt-2">`コード`</div>
                          </div>
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                <Link 
                  href={`/case/view/${selectedCase}?from=reports`} 
                  className="text-sm text-primary hover:underline flex items-center gap-1"
                  onClick={() => {
                    // 案件詳細ページに遷移する前に、個別の案件データを無効化して最新データを取得させる
                    import("@/lib/queryClient").then(({ queryClient }) => {
                      queryClient.invalidateQueries({ queryKey: [`/api/cases/${selectedCase}`] });
                    });
                  }}
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  案件詳細を表示
                </Link>
              </div>
              <div className="flex gap-2">
                {!isMilestoneEditing ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={startEditingMilestone}
                    className="flex items-center gap-1"
                  >
                    <PenSquare className="h-3.5 w-3.5 mr-1" />
                    編集
                  </Button>
                ) : (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={cancelEditingMilestone}
                      className="flex items-center gap-1"
                    >
                      <X className="h-3.5 w-3.5 mr-1" />
                      キャンセル
                    </Button>
                    <Button
                      variant="default"
                      size="sm"
                      onClick={saveMilestone}
                      disabled={updateMilestoneMutation.isPending}
                      className="flex items-center gap-1"
                    >
                      {updateMilestoneMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-1" />
                      ) : (
                        <Check className="h-3.5 w-3.5 mr-1" />
                      )}
                      保存
                    </Button>
                  </>
                )}
              </div>
            </div>
            {isMilestoneEditing ? (
              <textarea
                value={milestone}
                onChange={(e) => setMilestone(e.target.value)}
                className="w-full p-2 border rounded-md min-h-[120px] bg-background"
                placeholder="案件のマイルストーンを入力してください..."
              />
            ) : (
              <div className="p-2 min-h-[40px]">
                {milestone ? (
                  <div className="prose prose-sm max-w-none dark:prose-invert">
                    <ReactMarkdown 
                      remarkPlugins={[remarkGfm]} 
                      rehypePlugins={[rehypeRaw]}
                    >
                      {milestone}
                    </ReactMarkdown>
                  </div>
                ) : (
                  <span className="text-muted-foreground italic">
                    マイルストーンは設定されていません
                  </span>
                )}
              </div>
            )}
          </div>
        )}

        {/* プロジェクト選択タブ - 案件が選択されていない場合のみ表示 */}
        {selectedCase === null && (
          <Tabs
            value={selectedProject || undefined}
            onValueChange={handleProjectChange}
            className="w-full"
          >
            <TabsList className="w-full min-h-fit justify-start mb-4 flex flex-wrap gap-2 p-4">
              {projectNames.map((projectName) => (
                <TabsTrigger key={projectName} value={projectName}>
                  {projectName}
                </TabsTrigger>
              ))}
            </TabsList>

            {/* プロジェクト内の案件一覧 */}
            {projectNames.map((projectName) => (
              <TabsContent key={projectName} value={projectName}>
                <div className="mb-6 flex justify-between items-center">
                  <h2 className="text-xl font-semibold">{projectName}の案件一覧</h2>
                  <Button
                    onClick={() => showDateDialog(projectName)}
                    disabled={monthlySummaryMutation.isPending}
                    className="flex items-center gap-2"
                  >
                    {monthlySummaryMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <FileText className="h-4 w-4" />
                    )}
                    {monthlySummaryMutation.isPending 
                      ? "生成中..." 
                      : "月次状況報告書を生成"}
                  </Button>
                </div>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {projectCasesMap[projectName]?.map((case_) => (
                    <Card 
                      key={case_.id} 
                      className="hover:bg-accent/5 cursor-pointer"
                      onClick={() => handleCaseSelect(case_.id)}
                    >
                      <CardContent className="p-4">
                        <div className="flex justify-between items-center">
                          <div>
                            <p className="font-semibold">{case_.caseName}</p>
                            <p className="text-sm text-muted-foreground">
                              {case_.description || "説明なし"}
                            </p>
                          </div>
                          <ChevronRight className="h-5 w-5 text-muted-foreground" />
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </TabsContent>
            ))}
          </Tabs>
        )}

        {/* 選択された案件の週次報告一覧 */}
        {selectedCase !== null && caseReports && (
          <div className="mt-4">
            {caseReports.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                この案件の報告はまだありません
              </p>
            ) : (
              <div className="grid gap-4">
                {caseReports.map((report) => {
                  const case_ = caseMap.get(report.caseId);
                  if (!case_) return null;

                  return (
                    <Card key={report.id} className="hover:bg-accent/5">
                      <CardContent className="p-4">
                        <div className="flex justify-between items-start">
                          <Link href={`/reports/${report.id}`}>
                            <div>
                              <p className="font-semibold">{case_.caseName}</p>
                              <p className="text-sm text-muted-foreground">
                                {report.reporterName}
                              </p>
                            </div>
                          </Link>
                          <div className="flex flex-col items-end gap-2">
                            <div className="text-right">
                              <p className="text-sm">
                                {new Date(report.reportPeriodStart).toLocaleDateString()} ～{" "}
                                {new Date(report.reportPeriodEnd).toLocaleDateString()}
                              </p>
                              <p className="text-sm text-muted-foreground">
                                進捗率: {report.progressRate}%
                              </p>
                            </div>
                            <Button
                              variant="outline"
                              size="sm"
                              className="flex items-center gap-2"
                              onClick={() => copyToClipboard(report)}
                            >
                              <Copy className="h-4 w-4" />
                              マークダウンコピー
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* 期間選択ダイアログ */}
      <Dialog open={dateDialogOpen} onOpenChange={setDateDialogOpen}>
        <DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>期間と対象案件を指定</DialogTitle>
            <DialogDescription>
              月次報告書を生成する期間と対象案件を選択してください。
              デフォルトでは直近1ヶ月と全案件が選択されています。
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col space-y-6 py-4">
            {/* カレンダー部分 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full">
              <div className="flex flex-col space-y-2">
                <div className="font-medium">開始日</div>
                <Calendar
                  mode="single"
                  selected={startDate}
                  onSelect={setStartDate}
                  defaultMonth={startDate}
                  className="border rounded-md mx-auto"
                />
              </div>

              <div className="flex flex-col space-y-2">
                <div className="font-medium">終了日</div>
                <Calendar
                  mode="single"
                  selected={endDate}
                  onSelect={setEndDate}
                  defaultMonth={endDate}
                  className="border rounded-md mx-auto"
                  disabled={(date) => 
                    startDate ? date < startDate : false
                  }
                />
              </div>
            </div>

            {/* 案件選択部分 */}
            <div className="space-y-4 border rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div className="font-medium">処理対象の案件</div>
                <div className="flex space-x-2">
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => toggleAllCases(tempProjectName, true)}
                  >
                    すべて選択
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => toggleAllCases(tempProjectName, false)}
                  >
                    選択解除
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-60 overflow-y-auto p-2">
                {projectCasesMap[tempProjectName]?.map((case_) => (
                  <div 
                    key={case_.id} 
                    className="flex items-center space-x-2 hover:bg-accent/10 rounded-md p-2"
                    onClick={() => toggleCaseSelection(case_.id)}
                  >
                    <input 
                      type="checkbox" 
                      id={`case-${case_.id}`}
                      checked={selectedCaseIds.includes(case_.id)}
                      onChange={() => toggleCaseSelection(case_.id)}
                      className="h-4 w-4"
                    />
                    <label 
                      htmlFor={`case-${case_.id}`} 
                      className="flex-grow cursor-pointer truncate"
                      title={case_.caseName}
                    >
                      {case_.caseName}
                    </label>
                  </div>
                ))}
              </div>

              <div className="text-sm text-muted-foreground">
                {selectedCaseIds.length === 0 
                  ? "案件が選択されていません。全案件が対象になります。" 
                  : `${selectedCaseIds.length}件の案件が選択されています`}
              </div>
            </div>
          </div>

          <div className="flex flex-row flex-wrap justify-between items-center gap-2 mt-4">
            <Button
              variant="outline"
              onClick={getAndCopyInputData}
              disabled={!startDate || !endDate || monthlySummaryInputMutation.isPending}
              className="flex items-center gap-2"
            >
              {monthlySummaryInputMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
              {monthlySummaryInputMutation.isPending 
                ? "コピー中..." 
                : "インプットデータをコピー"}
            </Button>

            <div className="flex flex-row gap-2">
              <Button
                variant="outline"
                onClick={() => setDateDialogOpen(false)}
              >
                キャンセル
              </Button>
              <Button 
                onClick={generateMonthlySummaryWithDates}
                disabled={!startDate || !endDate || monthlySummaryMutation.isPending}
              >
                {monthlySummaryMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : null}
                {monthlySummaryMutation.isPending 
                  ? "生成中..." 
                  : "この設定で生成"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* 月次報告書選択ダイアログ */}
      <Dialog open={choiceDialogOpen} onOpenChange={setChoiceDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>月次報告書の表示</DialogTitle>
            <DialogDescription>
              既存の報告書が見つかりました。どちらを選択しますか？
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {existingReport && (
              <div className="p-4 border rounded-lg">
                <h4 className="font-medium mb-2">保存済みの報告書</h4>
                <p className="text-sm text-muted-foreground">
                  作成日: {new Date(existingReport.createdAt).toLocaleString('ja-JP')}
                </p>
                <p className="text-sm text-muted-foreground">
                  期間: {existingReport.startDate} 〜 {existingReport.endDate}
                </p>
                {existingReport.aiProvider && (
                  <p className="text-sm text-muted-foreground">
                    生成AI: {existingReport.aiProvider}
                  </p>
                )}
              </div>
            )}
            <div className="flex space-x-2">
              <Button 
                onClick={handleShowExistingReport} 
                variant="outline" 
                className="flex-1"
                disabled={!existingReport}
              >
                保存済みを表示
              </Button>
              <Button 
                onClick={handleGenerateNewReport} 
                className="flex-1"
                disabled={latestMonthlyReportMutation.isPending || monthlySummaryMutation.isPending}
              >
                {monthlySummaryMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    生成中
                  </>
                ) : (
                  "新しく作成"
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* 月次報告書ダイアログ */}
      <Dialog open={summaryDialogOpen} onOpenChange={setSummaryDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {tempProjectName && `${tempProjectName}の月次状況報告書`}
            </DialogTitle>
            <DialogDescription>
              {monthlySummaryPeriod && (
                <div className="space-y-1">
                  <span>
                    期間: {monthlySummaryPeriod.start} 〜 {monthlySummaryPeriod.end}
                  </span>
                  {existingReport && monthlySummary === existingReport.content && (
                    <div className="text-xs text-muted-foreground">
                      保存済み報告書を表示中 (作成日: {new Date(existingReport.createdAt).toLocaleString('ja-JP')})
                    </div>
                  )}
                </div>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="mt-4 p-4 border rounded-lg bg-muted/30">
            {monthlySummary ? (
              <div className="prose prose-sm dark:prose-invert max-w-full">
                <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>{monthlySummary}</ReactMarkdown>
              </div>
            ) : (
              <div className="flex items-center justify-center p-8">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 mt-4">
            <Button
              onClick={copyMonthlySummaryToClipboard}
              disabled={!monthlySummary}
              className="flex items-center gap-2"
            >
              <Copy className="h-4 w-4" />
              コピー
            </Button>
            <DialogClose asChild>
              <Button variant="outline">閉じる</Button>
            </DialogClose>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}