import { useQuery, useMutation } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { WeeklyReport, Case } from "@shared/schema";
import { Card, CardContent } from "@/components/ui/card";
import { ThemeToggle } from "@/components/theme-toggle";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Copy, List, Plus, ChevronRight, FileText, Loader2, Home, Briefcase } from "lucide-react";
import { 
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator
} from "@/components/ui/breadcrumb";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect, useRef } from "react";
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
import { apiRequest } from "@/lib/queryClient";
import ReactMarkdown from 'react-markdown';

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

export default function WeeklyReportList() {
  const { toast } = useToast();
  const [location] = useLocation();
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
  
  // マイルストーン更新のmutation
  const updateMilestoneMutation = useMutation<Case, Error, { caseId: number, milestone: string }>({
    mutationFn: async ({ caseId, milestone }) => {
      return apiRequest<Case>(`/api/cases/${caseId}/milestone`, {
        method: "PUT",
        data: { milestone }
      });
    },
    onSuccess: () => {
      toast({
        title: "マイルストーンを更新しました",
        description: "案件のマイルストーン情報が正常に更新されました。",
      });
      setIsMilestoneEditing(false);
    },
    onError: (error) => {
      console.error("Error updating milestone:", error);
      toast({
        title: "エラー",
        description: "マイルストーンの更新に失敗しました。",
        variant: "destructive",
      });
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
      toast({
        title: "エラー",
        description: "月次報告書の入力データの取得に失敗しました",
        variant: "destructive",
      });
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
      toast({
        title: "エラー",
        description: "月次報告書の生成に失敗しました",
        variant: "destructive",
      });
    }
  });
  
  // URLパラメータから初期値を設定
  useEffect(() => {
    // ブラウザの場合のみURLSearchParamsを使用
    if (typeof window !== 'undefined') {
      try {
        // URLから直接クエリパラメータを取得
        const url = new URL(window.location.href);
        const projectNameParam = url.searchParams.get('projectName');
        const caseIdParam = url.searchParams.get('caseId');
        
        console.log('URL Params:', { projectNameParam, caseIdParam });
        
        if (projectNameParam) {
          setSelectedProject(decodeURIComponent(projectNameParam));
        }
        
        if (caseIdParam) {
          const caseId = parseInt(caseIdParam);
          if (!isNaN(caseId)) {
            setSelectedCase(caseId);
          }
        }
      } catch (err) {
        console.error('Error parsing URL parameters:', err);
      }
    }
  }, [location]); // locationを依存配列に入れて、URLが変わったときに再実行
  
  // すべての週次報告を取得
  const { data: reports, isLoading: isLoadingReports } = useQuery<WeeklyReport[]>({
    queryKey: ["/api/weekly-reports"],
    staleTime: 0,
  });

  // すべての案件を取得
  const { data: cases, isLoading: isLoadingCases } = useQuery<Case[]>({
    queryKey: ["/api/cases"],
    staleTime: 0,
  });
  
  // 選択された案件に紐づく週次報告を取得
  const { data: caseReports, isLoading: isLoadingCaseReports } = useQuery<WeeklyReport[]>({
    queryKey: [`/api/weekly-reports/by-case/${selectedCase}`],
    staleTime: 0,
    enabled: selectedCase !== null,
  });

  if (isLoadingReports || isLoadingCases || (selectedCase !== null && isLoadingCaseReports)) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-8 max-w-4xl">
          <p className="text-center">読み込み中...</p>
        </div>
      </div>
    );
  }

  // 案件情報をIDでマップ化
  const caseMap = new Map(cases?.map(case_ => [case_.id, case_]));

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

    const csvHeaders = [
      "報告期間開始",
      "報告期間終了",
      "プロジェクト名",
      "案件名",
      "報告者名",
      "今週の作業内容",
      "進捗率",
      "進捗状況",
      "遅延・問題点の有無",
      "遅延・問題点の詳細",
      "課題・問題点",
      "新たなリスクの有無",
      "リスクの概要",
      "リスク対策",
      "リスクレベル",
      "品質懸念事項の有無",
      "品質懸念事項の詳細",
      "テスト進捗状況",
      "変更の有無",
      "変更内容の詳細",
      "来週の作業予定",
      "支援・判断の要望事項",
      "リソースに関する懸念",
      "リソースの詳細",
      "顧客に関する懸念",
      "顧客の詳細",
      "環境に関する懸念",
      "環境の詳細",
      "コストに関する懸念",
      "コストの詳細",
      "知識・スキルに関する懸念",
      "知識・スキルの詳細",
      "教育に関する懸念",
      "教育の詳細",
      "緊急課題に関する懸念",
      "緊急課題の詳細",
      "営業チャンス・顧客ニーズ",
      "営業チャンス・顧客ニーズの詳細",
    ].join(",");

    const csvData = [
      csvHeaders,
      [
        report.reportPeriodStart,
        report.reportPeriodEnd,
        case_.projectName,
        case_.caseName,
        report.reporterName,
        report.weeklyTasks || "",
        `${report.progressRate}%`,
        progressStatusMap[
          report.progressStatus as keyof typeof progressStatusMap
        ] || report.progressStatus,
        report.delayIssues === "yes" ? "あり" : "なし",
        report.delayDetails || "",
        report.issues || "",
        report.newRisks === "yes" ? "あり" : "なし",
        report.riskSummary || "",
        report.riskCountermeasures || "",
        report.riskLevel
          ? riskLevelMap[report.riskLevel as keyof typeof riskLevelMap]
          : "",
        qualityConcernsMap[
          report.qualityConcerns as keyof typeof qualityConcernsMap
        ] || "",
        report.qualityDetails || "",
        report.testProgress || "",
        report.changes === "yes" ? "あり" : "なし",
        report.changeDetails || "",
        report.nextWeekPlan || "",
        report.supportRequests || "",
        report.resourceConcerns === "exists" ? "あり" : "なし",
        report.resourceDetails || "",
        report.customerIssues === "exists" ? "あり" : "なし",
        report.customerDetails || "",
        report.environmentIssues === "exists" ? "あり" : "なし",
        report.environmentDetails || "",
        report.costIssues === "exists" ? "あり" : "なし",
        report.costDetails || "",
        report.knowledgeIssues === "exists" ? "あり" : "なし",
        report.knowledgeDetails || "",
        report.trainingIssues === "exists" ? "あり" : "なし",
        report.trainingDetails || "",
        report.urgentIssues === "exists" ? "あり" : "なし",
        report.urgentDetails || "",
        report.businessOpportunities === "exists" ? "あり" : "なし",
        report.businessDetails || "",
      ].join(","),
    ].join("\n");

    navigator.clipboard
      .writeText(csvData)
      .then(() => {
        toast({
          title: "コピー完了",
          description: "報告内容をCSV形式でクリップボードにコピーしました。",
        });
      })
      .catch(() => {
        toast({
          title: "エラー",
          description: "クリップボードへのコピーに失敗しました。",
          variant: "destructive",
        });
      });
  };

  // 案件を選択した時の処理
  const handleCaseSelect = (caseId: number) => {
    setSelectedCase(caseId);
    
    // 選択された案件のマイルストーンを読み込む
    const selectedCase = caseMap.get(caseId);
    if (selectedCase) {
      setMilestone(selectedCase.milestone || "");
      setIsMilestoneEditing(false);
    }
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
  
  // 選択された期間で月次サマリーを生成
  const generateMonthlySummaryWithDates = () => {
    if (!tempProjectName || !startDate || !endDate) return;
    
    setMonthlySummary("");
    setMonthlySummaryPeriod(null);
    setDateDialogOpen(false);
    
    toast({
      title: "月次報告書を生成中",
      description: "OpenAI APIを使って処理中です。しばらくお待ちください...",
    });
    
    // yyyy-MM-dd形式にフォーマット
    const formatDate = (date: Date) => {
      return date.toISOString().split('T')[0];
    };
    
    // 選択された案件IDsがある場合のみ含める
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
    
    monthlySummaryMutation.mutate(params);
  };
  
  // 選択された期間のインプットデータを取得してコピー
  const getAndCopyInputData = () => {
    if (!tempProjectName || !startDate || !endDate) return;
    
    // yyyy-MM-dd形式にフォーマット
    const formatDate = (date: Date) => {
      return date.toISOString().split('T')[0];
    };
    
    toast({
      title: "入力データを取得中",
      description: "インプットデータの準備中です...",
    });
    
    // 選択された案件IDsがある場合のみ含める
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
            
            toast({
              title: "コピー完了",
              description: `月次報告書の生成に使用するインプットデータをクリップボードにコピーしました。${selectedMsg}`,
            });
          })
          .catch(() => {
            toast({
              title: "エラー",
              description: "クリップボードへのコピーに失敗しました。",
              variant: "destructive",
            });
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
        toast({
          title: "コピー完了",
          description: "月次報告書をクリップボードにコピーしました。",
        });
      })
      .catch(() => {
        toast({
          title: "エラー",
          description: "クリップボードへのコピーに失敗しました。",
          variant: "destructive",
        });
      });
  };

  return (
    <div className="min-h-screen bg-background">
      <ThemeToggle />

      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <header className="mb-8">
          <div className="flex justify-between items-center mb-4">
            <h1 className="text-3xl font-bold text-primary">週次報告一覧</h1>
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
                              CSVコピー
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
      
      {/* 月次報告書ダイアログ */}
      <Dialog open={summaryDialogOpen} onOpenChange={setSummaryDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {tempProjectName && `${tempProjectName}の月次状況報告書`}
            </DialogTitle>
            <DialogDescription>
              {monthlySummaryPeriod && (
                <span>
                  期間: {monthlySummaryPeriod.start} 〜 {monthlySummaryPeriod.end}
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          
          <div className="mt-4 p-4 border rounded-lg bg-muted/30">
            {monthlySummary ? (
              <div className="prose prose-sm dark:prose-invert max-w-full">
                <ReactMarkdown>{monthlySummary}</ReactMarkdown>
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