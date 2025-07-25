import { useQuery, useMutation } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { Case, WeeklyReport } from "@shared/schema";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { AdminOnly } from "@/lib/admin-only";
import { 
  Plus, 
  AlertCircle, 
  FileText, 
  ChevronRight, 
  CheckSquare, 
  Loader2,
  CalendarRange,
  Copy,
  Home,
  Briefcase,
  List,
  Search,
  Filter,
  Building2,
  FolderOpen,
  Clock
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useState, useEffect, useRef } from "react";
import { useToast } from "@/hooks/use-toast";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter, 
  DialogDescription,
  DialogClose
} from "@/components/ui/dialog";
import { Calendar } from "@/components/ui/calendar";
import { apiRequest, queryClient } from "@/lib/queryClient";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import { 
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator
} from "@/components/ui/breadcrumb";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

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
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("projects");
  const [selectedProject, setSelectedProject] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [milestoneFilter, setMilestoneFilter] = useState<string>("");
  
  const { data: cases, isLoading, refetch } = useQuery<Case[]>({
    queryKey: ["/api/cases"],
    queryFn: async () => {
      const url = `/api/cases?includeDeleted=${showDeleted}`;
      return await apiRequest<Case[]>(url, { method: "GET" });
    },
    staleTime: 0,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
  });
  
  // インプットデータを取得するmutation
  const monthlySummaryInputMutation = useMutation<{prompt: string}, Error, void>({
    mutationFn: async () => {
      // プロジェクト名が選択されていない場合はエラー
      if (!selectedProjects.length || !startDate || !endDate) {
        throw new Error("プロジェクトと期間を選択してください");
      }
      
      // 選択されたプロジェクト名をカンマ区切りで結合
      const projectNames = selectedProjects.join(',');
      
      // クエリパラメータを追加
      const params = new URLSearchParams();
      params.append('startDate', startDate.toISOString().split('T')[0]);
      params.append('endDate', endDate.toISOString().split('T')[0]);
      
      // 選択された案件IDsがある場合は追加
      if (selectedCases.length > 0) {
        selectedCases.forEach(id => params.append('caseId', id.toString()));
      }
      
      let url = `/api/monthly-summary-input/${encodeURIComponent(projectNames)}`;
      
      // クエリパラメータがある場合は追加
      if (params.toString()) {
        url += `?${params.toString()}`;
      }
      
      try {
        const response = await fetch(url, {
          method: "GET",
          credentials: 'include',
          headers: {
            "Content-Type": "application/json",
          }
        });
        
        if (!response.ok) {
          // 404エラーの場合、レスポンスボディからエラーメッセージを取得
          if (response.status === 404) {
            const errorData = await response.json();
            throw new Error(errorData.message || "指定された期間に週次報告が見つかりません");
          }
          throw new Error("月次報告書のインプットデータの取得に失敗しました");
        }
        
        return response.json();
      } catch (error) {
        console.error("Error retrieving monthly summary input data:", error);
        throw error;
      }
    },
    onSuccess: (data) => {
      // データが空でないか確認
      if (!data.prompt || data.prompt.trim() === "") {
        toast({
          title: "データなし",
          description: "指定された期間に週次報告のある案件が見つかりませんでした",
          variant: "destructive",
        });
        return;
      }
      
      navigator.clipboard
        .writeText(data.prompt)
        .then(() => {
          toast({
            title: "コピー完了",
            description: "月次報告書の生成用インプットデータをコピーしました",
          });
        })
        .catch(() => {
          toast({
            title: "エラー",
            description: "クリップボードへのコピーに失敗しました",
            variant: "destructive",
          });
        });
    },
    onError: (error: Error) => {
      console.error("Error retrieving monthly summary input data:", error);
      toast({
        title: "エラー",
        description: error.message || "月次報告書のインプットデータの取得に失敗しました",
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
      
      try {
        const response = await fetch(url, {
          method: "GET",
          credentials: 'include',
          headers: {
            "Content-Type": "application/json",
          }
        });
        
        if (!response.ok) {
          // 404エラーの場合、レスポンスボディからエラーメッセージを取得
          if (response.status === 404) {
            const errorData = await response.json();
            throw new Error(errorData.message || "指定された期間に週次報告が見つかりません");
          }
          throw new Error("月次報告書の生成に失敗しました");
        }
        
        return response.json();
      } catch (error) {
        console.error("Error generating monthly summary:", error);
        throw error;
      }
    },
    onSuccess: (data) => {
      // サマリーが空でないか確認
      if (!data.summary || data.summary.trim() === "") {
        toast({
          title: "データなし",
          description: "指定された期間に週次報告のある案件が見つかりませんでした",
          variant: "destructive",
        });
        return;
      }
      
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
    onError: (error: Error) => {
      console.error("Error generating monthly summary:", error);
      toast({
        title: "エラー",
        description: error.message || "月次報告書の生成に失敗しました",
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

  // 利用可能なマイルストーン一覧
  const availableMilestones = cases?.reduce((acc, case_) => {
    if (case_.milestone && case_.milestone.trim() && !acc.includes(case_.milestone)) {
      acc.push(case_.milestone);
    }
    return acc;
  }, [] as string[])?.sort() ?? [];

  // 検索でフィルタリングされた案件
  const filteredCases = cases?.filter(case_ => {
    // 削除済みフィルター
    if (!showDeleted && case_.isDeleted) return false;
    
    // 検索クエリでフィルタリング
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const matches = case_.caseName.toLowerCase().includes(query) ||
        case_.projectName.toLowerCase().includes(query) ||
        (case_.description && case_.description.toLowerCase().includes(query));
      if (!matches) return false;
    }
    
    // マイルストーンでフィルタリング
    if (milestoneFilter && case_.milestone !== milestoneFilter) return false;
    
    return true;
  }) ?? [];

  // 検索でフィルタリングされたプロジェクト
  const filteredProjects = Object.keys(groupedCases).filter(projectName => {
    const projectCases = groupedCases[projectName];
    return projectCases.some(case_ => filteredCases.includes(case_));
  });

  // プロジェクト別にフィルタリングされた案件
  const filteredGroupedCases = Object.entries(groupedCases).reduce((acc, [projectName, projectCases]) => {
    const filtered = projectCases.filter(case_ => filteredCases.includes(case_));
    if (filtered.length > 0) {
      acc[projectName] = filtered;
    }
    return acc;
  }, {} as Record<string, Case[]>);

  // プロジェクトが変更されたときに最初のプロジェクトを自動選択
  useEffect(() => {
    if (filteredProjects.length > 0 && !selectedProject) {
      setSelectedProject(filteredProjects[0]);
    }
  }, [filteredProjects, selectedProject]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-8 max-w-5xl">
          <p className="text-center">読み込み中...</p>
        </div>
      </div>
    );
  }
  
  // プロジェクトの選択状態を切り替える処理（月次報告書生成用）
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
    
    // プロジェクトが選択されていない場合、自動的に選択する
    if (!selectedProjects.includes(projectName)) {
      setSelectedProjects(prev => [...prev, projectName]);
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
      <div className="container mx-auto px-4 py-8 max-w-5xl">
        <div className="flex justify-between items-center mb-4">
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink asChild>
                  <Link href="/">
                    <Home className="h-3.5 w-3.5" />
                  </Link>
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>
                  <span className="flex items-center gap-1">
                    <Briefcase className="h-3.5 w-3.5" />
                    案件一覧
                  </span>
                </BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
          <ThemeToggle />
        </div>

        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-semibold">案件管理</h1>
          <ThemeToggle />
        </div>

        {/* 検索バーとフィルター */}
        <div className="space-y-4 mb-6">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                placeholder="プロジェクト名または案件名で検索..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Button
              variant="outline"
              size="icon"
              onClick={() => setShowFilters(!showFilters)}
              className={showFilters ? "bg-blue-50 border-blue-200" : ""}
            >
              <Filter className="h-4 w-4" />
            </Button>
          </div>
          
          {/* 削除済み案件表示切り替え */}
          <div className="flex items-center gap-3">
            <Switch
              id="showDeleted"
              checked={showDeleted}
              onCheckedChange={setShowDeleted}
            />
            <Label htmlFor="showDeleted">削除済み案件を表示</Label>
          </div>
          
          {/* フィルターオプション */}
          {showFilters && (
            <div className="flex gap-4 p-3 bg-gray-50 rounded-lg">
              <div className="flex-1">
                <label className="text-sm font-medium text-gray-700 mb-1 block">
                  マイルストーン
                </label>
                <select
                  value={milestoneFilter}
                  onChange={(e) => setMilestoneFilter(e.target.value)}
                  className="w-full px-3 py-1 border border-gray-300 rounded-md text-sm"
                >
                  <option value="">全て</option>
                  {availableMilestones.map(milestone => (
                    <option key={milestone} value={milestone}>
                      {milestone}
                    </option>
                  ))}
                </select>
              </div>
              
              <div className="flex items-end">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setMilestoneFilter("");
                    setSearchQuery("");
                  }}
                >
                  クリア
                </Button>
              </div>
            </div>
          )}
          
          <div className="flex justify-between items-center">
            <div className="text-sm text-gray-500">
              {filteredCases.length}件の案件が見つかりました
            </div>
            <div className="flex flex-col space-y-2">
              <Button
                onClick={() => {
                  // 全プロジェクトを選択
                  setSelectedProjects(Object.keys(groupedCases));
                  
                  // すべての非削除案件を選択
                  const allCaseIds = Object.values(groupedCases)
                    .flatMap(cases => cases.filter(c => !c.isDeleted).map(c => c.id));
                  setSelectedCases(allCaseIds);
                  
                  handleMonthlyReportClick();
                }}
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
                  : "月次状況報告書"}
              </Button>
              
              <AdminOnly>
                <Link href="/case/new">
                  <Button className="flex items-center gap-1">
                    <Plus className="h-4 w-4" />
                    新規案件作成
                  </Button>
                </Link>
              </AdminOnly>
            </div>
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center items-center h-64">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="projects">
                <Building2 className="h-4 w-4 mr-2" />
                プロジェクト別
              </TabsTrigger>
              <TabsTrigger value="all">
                <FolderOpen className="h-4 w-4 mr-2" />
                全ての案件
              </TabsTrigger>
            </TabsList>

            {/* プロジェクト別表示 */}
            <TabsContent value="projects" className="flex-1 mt-4">
              <div className="flex h-[600px] w-full border rounded-lg">
                {/* プロジェクト一覧 */}
                <div className="w-1/3 border-r">
                  <div className="p-3 border-b font-medium text-sm bg-gray-50">プロジェクト一覧</div>
                  <ScrollArea className="h-[550px]">
                    <div className="space-y-1 p-2">
                      {filteredProjects.map((projectName) => (
                        <div
                          key={projectName}
                          className={`p-3 rounded cursor-pointer text-sm hover:bg-gray-100 transition-colors ${
                            selectedProject === projectName ? 'bg-blue-100 text-blue-700' : ''
                          }`}
                          onClick={() => setSelectedProject(projectName)}
                        >
                          <div className="font-medium">{projectName}</div>
                          <div className="text-xs text-gray-500">
                            {filteredGroupedCases[projectName]?.length || 0}件の案件
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </div>

                {/* 案件一覧 */}
                <div className="w-2/3">
                  <div className="p-3 border-b font-medium text-sm bg-gray-50">
                    {selectedProject ? `${selectedProject}の案件` : '案件を表示するにはプロジェクトを選択してください'}
                  </div>
                  <ScrollArea className="h-[550px]">
                    {selectedProject ? (
                      <div className="space-y-3 p-3">
                        {filteredGroupedCases[selectedProject]?.map((case_) => (
                          <Card 
                            key={case_.id} 
                            className={`hover:bg-accent/5 ${case_.isDeleted ? 'border-destructive/30 bg-destructive/5' : ''}`}
                          >
                            <CardContent className="p-4">
                              <div className="flex">
                                {isMultiSelectMode && !case_.isDeleted && (
                                  <div className="mr-2">
                                    <Checkbox 
                                      checked={selectedCases.includes(case_.id)}
                                      onCheckedChange={() => toggleCaseSelection(case_.id, selectedProject)}
                                    />
                                  </div>
                                )}
                                <div className="flex-1">
                                  <div className="flex justify-between items-start">
                                    <div>
                                      <Link 
                                        href={`/case/view/${case_.id}?from=cases`}
                                        onClick={() => {
                                          import("@/lib/queryClient").then(({ queryClient }) => {
                                            queryClient.invalidateQueries({ queryKey: [`/api/cases/${case_.id}`] });
                                          });
                                        }}
                                      >
                                        <h3 className="font-medium hover:text-primary hover:underline">{case_.caseName}</h3>
                                      </Link>
                                      <p className="text-sm text-muted-foreground">
                                        {case_.description || "説明なし"}
                                      </p>
                                    </div>
                                    {case_.isDeleted && (
                                      <div className="ml-auto flex items-center text-xs text-destructive">
                                        <AlertCircle className="h-3 w-3 mr-1" />
                                        削除済み
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </CardContent>
                            {!isMultiSelectMode && (
                              <CardFooter className="p-4 pt-0 flex justify-end space-x-2">
                                <Link href={`/reports?caseId=${case_.id}`}>
                                  <Button variant="outline" size="sm" className="flex items-center gap-1">
                                    <List className="h-3 w-3" />
                                    週次報告
                                  </Button>
                                </Link>
                                <AdminOnly>
                                  <Link href={`/case/edit/${case_.id}`}>
                                    <Button variant="outline" size="sm" className="flex items-center gap-1">
                                      {case_.isDeleted ? '復元/編集' : '編集'} <ChevronRight className="h-3 w-3" />
                                    </Button>
                                  </Link>
                                </AdminOnly>
                              </CardFooter>
                            )}
                          </Card>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center text-gray-500 py-16">
                        左側からプロジェクトを選択してください
                      </div>
                    )}
                  </ScrollArea>
                </div>
              </div>
            </TabsContent>

            {/* 全ての案件表示 */}
            <TabsContent value="all" className="flex-1 mt-4">
              <ScrollArea className="h-[600px]">
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {filteredCases.map((case_) => (
                    <Card 
                      key={case_.id} 
                      className={`hover:bg-accent/5 ${case_.isDeleted ? 'border-destructive/30 bg-destructive/5' : ''}`}
                    >
                      <CardContent className="p-4">
                        <div className="flex">
                          {isMultiSelectMode && !case_.isDeleted && (
                            <div className="mr-2">
                              <Checkbox 
                                checked={selectedCases.includes(case_.id)}
                                onCheckedChange={() => toggleCaseSelection(case_.id, case_.projectName)}
                              />
                            </div>
                          )}
                          <div className="flex-1">
                            <div className="flex justify-between items-start">
                              <div>
                                <Link 
                                  href={`/case/view/${case_.id}?from=cases`}
                                  onClick={() => {
                                    import("@/lib/queryClient").then(({ queryClient }) => {
                                      queryClient.invalidateQueries({ queryKey: [`/api/cases/${case_.id}`] });
                                    });
                                  }}
                                >
                                  <h3 className="font-medium hover:text-primary hover:underline">{case_.caseName}</h3>
                                </Link>
                                <p className="text-sm text-muted-foreground">
                                  {case_.projectName}
                                </p>
                                <p className="text-xs text-muted-foreground mt-1">
                                  {case_.description || "説明なし"}
                                </p>
                              </div>
                              {case_.isDeleted && (
                                <div className="ml-auto flex items-center text-xs text-destructive">
                                  <AlertCircle className="h-3 w-3 mr-1" />
                                  削除済み
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </CardContent>
                      {!isMultiSelectMode && (
                        <CardFooter className="p-4 pt-0 flex justify-end space-x-2">
                          <Link href={`/reports?caseId=${case_.id}`}>
                            <Button variant="outline" size="sm" className="flex items-center gap-1">
                              <List className="h-3 w-3" />
                              週次報告
                            </Button>
                          </Link>
                          <AdminOnly>
                            <Link href={`/case/edit/${case_.id}`}>
                              <Button variant="outline" size="sm" className="flex items-center gap-1">
                                {case_.isDeleted ? '復元/編集' : '編集'} <ChevronRight className="h-3 w-3" />
                              </Button>
                            </Link>
                          </AdminOnly>
                        </CardFooter>
                      )}
                    </Card>
                  ))}
                </div>
              </ScrollArea>
            </TabsContent>
          </Tabs>
        )}
        
        {/* 期間選択ダイアログ */}
        <Dialog open={dateDialogOpen} onOpenChange={setDateDialogOpen}>
          <DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>期間と対象案件を指定（案件一覧）</DialogTitle>
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
                      onClick={() => {
                        // 全プロジェクトを選択
                        setSelectedProjects(Object.keys(groupedCases));
                        
                        // すべての非削除案件を選択
                        const allCaseIds = Object.values(groupedCases)
                          .flatMap(cases => cases.filter(c => !c.isDeleted).map(c => c.id));
                        setSelectedCases(allCaseIds);
                      }}
                    >
                      すべて選択
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => {
                        // すべての選択を解除
                        setSelectedCases([]);
                      }}
                    >
                      選択解除
                    </Button>
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-60 overflow-y-auto p-2">
                  {Object.keys(groupedCases).map(projectName => (
                    <div key={projectName} className="space-y-2">
                      <div className="font-medium text-sm text-primary">
                        {projectName}
                      </div>
                      {groupedCases[projectName]
                        .filter(c => !c.isDeleted)
                        .map(case_ => (
                          <div 
                            key={case_.id} 
                            className="flex items-center space-x-2 hover:bg-accent/10 rounded-md p-2 ml-2"
                            onClick={(e) => {
                              // この一行を追加して、クリックイベントの伝播を防止
                              e.stopPropagation();
                              toggleCaseSelection(case_.id, projectName);
                            }}
                          >
                            <input 
                              type="checkbox" 
                              id={`case-${case_.id}`}
                              checked={selectedCases.includes(case_.id)}
                              onChange={(e) => {
                                // この一行を追加して、クリックイベントの伝播を防止
                                e.stopPropagation();
                                toggleCaseSelection(case_.id, projectName);
                              }}
                              onClick={(e) => e.stopPropagation()}
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
                        ))
                      }
                    </div>
                  ))}
                </div>
                
                <div className="text-sm text-muted-foreground">
                  {selectedCases.length === 0 
                    ? "案件が選択されていません。全案件が対象になります。" 
                    : `${selectedCases.length}件の案件が選択されています`}
                </div>
              </div>
            </div>
            
            <div className="flex flex-row flex-wrap justify-between items-center gap-2 mt-4">
              <Button
                variant="outline"
                onClick={() => monthlySummaryInputMutation.mutate()}
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
                <DialogClose asChild>
                  <Button variant="outline">
                    キャンセル
                  </Button>
                </DialogClose>
                <Button
                  onClick={generateMonthlySummaryWithDates}
                  disabled={!startDate || !endDate || monthlySummaryMutation.isPending}
                  className="flex items-center gap-2"
                >
                  {monthlySummaryMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <FileText className="h-4 w-4" />
                  )}
                  {monthlySummaryMutation.isPending 
                    ? "生成中..." 
                    : "月次報告書を生成"}
                </Button>
              </div>
            </div>
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
              <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>{monthlySummary}</ReactMarkdown>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
