import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { Case, WeeklyReport } from "@shared/schema";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { 
  Plus, 
  AlertCircle, 
  FileText, 
  ChevronRight, 
  CheckSquare, 
  Loader2,
  CalendarRange,
  Copy
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter, 
  DialogDescription 
} from "@/components/ui/dialog";
import { Calendar } from "@/components/ui/calendar";
import { apiRequest } from "@/lib/queryClient";
import ReactMarkdown from "react-markdown";

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

export default function CaseList() {
  const { toast } = useToast();
  const [showDeleted, setShowDeleted] = useState(false);
  const [selectedProjects, setSelectedProjects] = useState<string[]>([]);
  const [selectedCases, setSelectedCases] = useState<number[]>([]);
  const [dateDialogOpen, setDateDialogOpen] = useState(false);
  const [summaryDialogOpen, setSummaryDialogOpen] = useState(false);
  const [startDate, setStartDate] = useState<Date | undefined>(undefined);
  const [endDate, setEndDate] = useState<Date | undefined>(undefined);
  const [monthlySummary, setMonthlySummary] = useState<string>("");
  const [monthlySummaryPeriod, setMonthlySummaryPeriod] = useState<{start: string, end: string} | null>(null);
  const [isMultiSelectMode, setIsMultiSelectMode] = useState(false);
  
  const { data: cases, isLoading, refetch } = useQuery<Case[]>({
    queryKey: ["/api/cases"],
    queryFn: async () => {
      const url = `/api/cases?includeDeleted=${showDeleted}`;
      const response = await fetch(url, {
        credentials: 'include'
      });
      if (!response.ok) {
        throw new Error("案件の取得に失敗しました");
      }
      return response.json();
    },
    staleTime: 0,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
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
      const selectedMsg = selectedCases.length > 0 
        ? `選択された${selectedCases.length}件の案件の` 
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
  
  // showDeletedが変更されたらデータを再取得する
  useEffect(() => {
    refetch();
  }, [showDeleted, refetch]);

  // マルチ選択モードを終了する時の処理
  useEffect(() => {
    if (!isMultiSelectMode) {
      setSelectedProjects([]);
      setSelectedCases([]);
    }
  }, [isMultiSelectMode]);

  // プロジェクト名でグループ化
  const groupedCases = cases?.reduce((acc, currentCase) => {
    const projectName = currentCase.projectName;
    if (!acc[projectName]) {
      acc[projectName] = [];
    }
    acc[projectName].push(currentCase);
    return acc;
  }, {} as Record<string, Case[]>) ?? {};

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-8 max-w-4xl">
          <p className="text-center">読み込み中...</p>
        </div>
      </div>
    );
  }
  
  // プロジェクトの選択状態を切り替える処理
  const toggleProjectSelection = (projectName: string) => {
    setSelectedProjects(prev => 
      prev.includes(projectName)
        ? prev.filter(name => name !== projectName)
        : [...prev, projectName]
    );
    
    // 該当プロジェクトの案件選択状態も更新
    if (selectedProjects.includes(projectName)) {
      // プロジェクトの選択を解除した場合、そのプロジェクトの全案件の選択も解除
      const projectCaseIds = groupedCases[projectName]
        .filter(case_ => !case_.isDeleted)
        .map(case_ => case_.id);
      setSelectedCases(prev => prev.filter(id => !projectCaseIds.includes(id)));
    } else {
      // プロジェクトを選択した場合、そのプロジェクトの全案件を選択
      const projectCaseIds = groupedCases[projectName]
        .filter(case_ => !case_.isDeleted)
        .map(case_ => case_.id);
      setSelectedCases(prev => [...prev, ...projectCaseIds]);
    }
  };
  
  // 案件の選択状態を切り替える処理
  const toggleCaseSelection = (caseId: number, projectName: string) => {
    setSelectedCases(prev => 
      prev.includes(caseId)
        ? prev.filter(id => id !== caseId)
        : [...prev, caseId]
    );
    
    // プロジェクトの全案件が選択されているか確認
    const projectCases = groupedCases[projectName].filter(case_ => !case_.isDeleted);
    const projectCaseIds = projectCases.map(case_ => case_.id);
    
    // 更新後の選択状態を計算
    const updatedSelectedCases = selectedCases.includes(caseId)
      ? selectedCases.filter(id => id !== caseId)
      : [...selectedCases, caseId];
    
    // プロジェクトの全案件が選択されている場合はプロジェクトも選択
    const isAllSelected = projectCaseIds.every(id => updatedSelectedCases.includes(id));
    
    if (isAllSelected && !selectedProjects.includes(projectName)) {
      setSelectedProjects(prev => [...prev, projectName]);
    } else if (!isAllSelected && selectedProjects.includes(projectName)) {
      setSelectedProjects(prev => prev.filter(name => name !== projectName));
    }
  };
  
  // 月次報告書作成ボタンクリック時の処理
  const handleMonthlyReportClick = () => {
    // 日付を1ヶ月前に初期化
    const end = new Date();
    const start = new Date();
    start.setMonth(start.getMonth() - 1);
    
    // 日付を設定
    setEndDate(end);
    setStartDate(start);
    setDateDialogOpen(true);
  };
  
  // 選択された期間で月次サマリーを生成
  const generateMonthlySummaryWithDates = () => {
    if (!selectedProjects.length || !startDate || !endDate) {
      toast({
        title: "エラー",
        description: "プロジェクトと期間を選択してください",
        variant: "destructive",
      });
      return;
    }
    
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
      // 複数プロジェクトの場合、プロジェクト名をカンマ区切りにする
      projectName: selectedProjects.join(','),
      startDate: formatDate(startDate),
      endDate: formatDate(endDate)
    };
    
    // 案件が選択されている場合は追加
    if (selectedCases.length > 0) {
      params.caseIds = selectedCases;
    }
    
    monthlySummaryMutation.mutate(params);
  };
  
  // 月次報告書をクリップボードにコピー
  const copyMonthlySummaryToClipboard = () => {
    if (!monthlySummary) return;
    
    navigator.clipboard
      .writeText(monthlySummary)
      .then(() => {
        toast({
          title: "コピー完了",
          description: "月次報告書をクリップボードにコピーしました",
        });
      })
      .catch(() => {
        toast({
          title: "エラー",
          description: "クリップボードへのコピーに失敗しました",
          variant: "destructive",
        });
      });
  };

  return (
    <div className="min-h-screen bg-background">
      <ThemeToggle />

      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <header className="mb-8">
          <div className="flex justify-between items-center">
            <h1 className="text-3xl font-bold text-primary">案件一覧</h1>
            <div className="flex gap-2">
              {isMultiSelectMode ? (
                <>
                  <Button 
                    variant="outline" 
                    onClick={() => setIsMultiSelectMode(false)}
                    className="flex items-center gap-1"
                  >
                    選択をキャンセル
                  </Button>
                  <Button 
                    variant="default" 
                    onClick={handleMonthlyReportClick}
                    disabled={selectedProjects.length === 0}
                    className="flex items-center gap-1"
                  >
                    <FileText className="h-4 w-4" />
                    月次報告書作成
                  </Button>
                </>
              ) : (
                <>
                  <Button 
                    variant="outline" 
                    onClick={() => setIsMultiSelectMode(true)}
                    className="flex items-center gap-1"
                  >
                    <CheckSquare className="h-4 w-4" />
                    複数選択
                  </Button>
                  <Link href="/case/new">
                    <Button className="flex items-center gap-1">
                      <Plus className="h-4 w-4" />
                      新規案件作成
                    </Button>
                  </Link>
                </>
              )}
            </div>
          </div>
          <div className="flex justify-between items-center mt-2">
            <Link href="/" className="text-sm text-muted-foreground hover:text-primary">
              ホームに戻る
            </Link>
            <div className="flex items-center space-x-2">
              <Switch 
                id="show-deleted" 
                checked={showDeleted} 
                onCheckedChange={setShowDeleted}
              />
              <Label htmlFor="show-deleted" className="text-sm">
                削除済み案件を表示
              </Label>
            </div>
          </div>
        </header>

        <div className="space-y-8">
          {Object.entries(groupedCases).map(([projectName, projectCases]) => (
            <div key={projectName}>
              <div className="flex items-center gap-2 mb-4">
                {isMultiSelectMode && (
                  <Checkbox 
                    checked={selectedProjects.includes(projectName)}
                    onCheckedChange={() => toggleProjectSelection(projectName)}
                    id={`project-${projectName}`}
                  />
                )}
                <h2 className="text-xl font-semibold">{projectName}</h2>
                {isMultiSelectMode && !showDeleted && (
                  <div className="text-sm text-muted-foreground">
                    ({projectCases.filter(c => !c.isDeleted).length}件の案件)
                  </div>
                )}
              </div>
              <div className="grid gap-4">
                {projectCases.map((case_) => (
                  <Card 
                    key={case_.id} 
                    className={`hover:bg-accent/5 ${case_.isDeleted ? 'border-destructive/30 bg-destructive/5' : ''}`}
                  >
                    <CardContent className="p-4">
                      <div className="flex justify-between items-start">
                        <div className="flex items-start gap-2">
                          {isMultiSelectMode && !case_.isDeleted && (
                            <Checkbox 
                              checked={selectedCases.includes(case_.id)}
                              onCheckedChange={() => toggleCaseSelection(case_.id, projectName)}
                              className="mt-1"
                            />
                          )}
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="font-semibold">{case_.caseName}</p>
                              {case_.isDeleted && (
                                <div className="flex items-center text-destructive text-xs">
                                  <AlertCircle className="h-3 w-3 mr-1" />
                                  <span>削除済み</span>
                                </div>
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground">
                              作成日: {new Date(case_.createdAt).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          {!case_.isDeleted && !isMultiSelectMode && (
                            <Link href={`/reports?caseId=${case_.id}`}>
                              <Button variant="outline" size="sm">
                                週次報告一覧
                              </Button>
                            </Link>
                          )}
                          {!isMultiSelectMode && (
                            <Link href={`/case/edit/${case_.id}`}>
                              <Button variant="outline" size="sm">
                                {case_.isDeleted ? '復元/編集' : '編集'}
                              </Button>
                            </Link>
                          )}
                        </div>
                      </div>
                      {case_.description && (
                        <p className="mt-2 text-sm text-muted-foreground">
                          {case_.description}
                        </p>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </div>
        
        {/* 日付選択ダイアログ */}
        <Dialog open={dateDialogOpen} onOpenChange={setDateDialogOpen}>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>月次報告書の期間を選択</DialogTitle>
              <DialogDescription>
                レポートに含める週次報告の期間を選択してください。
                {selectedProjects.length > 0 && (
                  <div className="mt-2">
                    <p className="font-semibold">選択中のプロジェクト:</p>
                    <ul className="list-disc pl-5 text-sm">
                      {selectedProjects.map(project => (
                        <li key={project}>{project}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {selectedCases.length > 0 && (
                  <div className="mt-2">
                    <p className="text-sm">選択中の案件数: {selectedCases.length}件</p>
                  </div>
                )}
              </DialogDescription>
            </DialogHeader>
            
            <div className="flex flex-col gap-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="start-date">開始日:</Label>
                <div className="border rounded-md p-2">
                  <Calendar
                    mode="single"
                    selected={startDate}
                    onSelect={setStartDate}
                    initialFocus
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="end-date">終了日:</Label>
                <div className="border rounded-md p-2">
                  <Calendar
                    mode="single"
                    selected={endDate}
                    onSelect={setEndDate}
                    initialFocus
                  />
                </div>
              </div>
            </div>
            
            <DialogFooter>
              <Button variant="outline" onClick={() => setDateDialogOpen(false)}>
                キャンセル
              </Button>
              <Button 
                onClick={generateMonthlySummaryWithDates}
                disabled={!startDate || !endDate || monthlySummaryMutation.isPending}
              >
                {monthlySummaryMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                生成
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        
        {/* 月次レポート表示ダイアログ */}
        <Dialog open={summaryDialogOpen} onOpenChange={setSummaryDialogOpen}>
          <DialogContent className="max-w-[900px] max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center justify-between">
                <span>月次報告書</span>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={copyMonthlySummaryToClipboard}
                  className="flex items-center gap-1"
                >
                  <Copy className="h-4 w-4" />
                  コピー
                </Button>
              </DialogTitle>
              {monthlySummaryPeriod && (
                <DialogDescription>
                  期間: {monthlySummaryPeriod.start} 〜 {monthlySummaryPeriod.end}
                </DialogDescription>
              )}
            </DialogHeader>
            <div className="prose prose-sm max-w-none dark:prose-invert">
              <ReactMarkdown>{monthlySummary}</ReactMarkdown>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
