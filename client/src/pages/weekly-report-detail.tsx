import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useParams, useLocation } from "wouter";
import { WeeklyReport } from "@shared/schema";
import { Card, CardContent } from "@/components/ui/card";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { Edit, Home, Briefcase, FileText, ChevronRight, ShieldCheck, Trash2, Target } from "lucide-react";
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import { useAuth } from "@/lib/auth";
import { apiRequest } from "@/lib/queryClient";
import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { createLogger } from "@shared/logger";
import { useAIAnalysis } from "@/hooks/use-ai-analysis";
import { AIAnalysisResult } from "@/components/ai-analysis-result";
import { AIMetadataDisplay } from "@/components/ai-metadata-display";
import { Textarea } from "@/components/ui/textarea";
import { 
  progressStatusMap,
  qualityConcernsMap,
  riskLevelMap,
  binaryStatusMap 
} from "@shared/value-maps";
import { 
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator
} from "@/components/ui/breadcrumb";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { MilestoneDialog } from "@/components/milestone-dialog";


export default function WeeklyReportDetail() {
  const logger = createLogger('WeeklyReportDetail');
  const { id } = useParams<{ id: string }>();
  const [location, setLocation] = useLocation();
  
  // AuthProviderエラーを防ぐためのtry-catch
  let user;
  try {
    const authContext = useAuth();
    user = authContext.user;
  } catch (error) {
    logger.error('AuthProvider not available', error instanceof Error ? error : new Error(String(error)));
    // 緊急避難: ログインページにリダイレクト
    if (typeof window !== 'undefined') {
      window.location.href = '/login';
    }
    return <div>認証エラーが発生しました。ログインページにリダイレクトしています...</div>;
  }
  const queryClient = useQueryClient();
  const [originalData, setOriginalData] = useState<WeeklyReport | null>(null);
  const { toast } = useToast();
  
  // 議事録編集の状態管理
  const [editingMeetings, setEditingMeetings] = useState<{[key: number]: {title: string, content: string}}>({});
  
  // 削除確認モーダルの状態管理
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  
  // マイルストーンダイアログの状態管理
  const [showMilestoneDialog, setShowMilestoneDialog] = useState(false);
  
  // AI分析フック
  const aiAnalysisHook = useAIAnalysis();
  
  // 管理者確認メール文章の再生成
  const regenerateAdminEmailMutation = useMutation({
    mutationFn: async () => {
      if (!report || !id) throw new Error('レポートデータが不足しています');
      
      // apiRequestは既にJSONデータを返すので、直接データを取得
      const data = await apiRequest(`/api/weekly-reports/${id}/regenerate-admin-email`, {
        method: 'POST'
      });
      
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/weekly-reports/${id}`] });
      toast({
        title: "成功",
        description: "管理者確認メール文章が再生成されました",
      });
    },
    onError: (error) => {
      toast({
        title: "エラー",
        description: "メール文章の再生成に失敗しました",
        variant: "destructive",
      });
    },
  });
  
  const { data: report, isLoading } = useQuery<WeeklyReport>({
    queryKey: [`/api/weekly-reports/${id}`],
    staleTime: 0, // 常にデータを古いとみなす
    refetchOnMount: true, // コンポーネントマウント時に再取得
    refetchOnWindowFocus: true, // ウィンドウフォーカス時に再取得
  });
  
  // 案件情報を取得
  const { data: cases } = useQuery<any[]>({
    queryKey: ['/api/cases'],
    staleTime: 0,
    enabled: !!report, // レポートが取得できたら案件情報も取得
  });

  // 議事録を取得
  const { data: meetings } = useQuery<any[]>({
    queryKey: [`/api/weekly-reports/${id}/meetings`],
    staleTime: 0,
    enabled: !!report, // レポートが取得できたら議事録も取得
  });

  // AIプロバイダー設定を取得
  const { data: aiProviderSettings } = useQuery<{key: string, value: string}[]>({
    queryKey: ['/api/system-settings', 'AI_PROVIDER'],
    staleTime: 1000 * 60 * 5, // 5分間キャッシュ
  });

  // URLパラメータからスクロール指示を取得してスクロール実行
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const url = new URL(window.location.href);
        const scrollTo = url.searchParams.get('scrollTo');
        
        if (scrollTo === 'meetings') {
          // DOM要素が読み込まれるまで少し待つ
          setTimeout(() => {
            const meetingsSection = document.getElementById('meetings-section');
            if (meetingsSection) {
              meetingsSection.scrollIntoView({ 
                behavior: 'smooth',
                block: 'start'
              });
            }
          }, 100);
        }
      } catch (err) {
        logger.error('Error parsing URL parameters', err instanceof Error ? err : new Error(String(err)));
      }
    }
  }, [location, meetings]); // meetings依存でDOM更新後にスクロール

  // 議事録更新のミューテーション
  const updateMeetingMutation = useMutation({
    mutationFn: async ({ meetingId, title, content }: { meetingId: number, title: string, content: string }) => {
      // apiRequestは既にJSONデータを返すので、直接データを取得
      const data = await apiRequest(`/api/weekly-reports/meetings/${meetingId}`, {
        method: 'PUT',
        data: { title, content }
      });
      
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/weekly-reports/${id}/meetings`] });
      toast({
        title: "成功",
        description: "議事録が更新されました",
      });
    },
    onError: (error) => {
      toast({
        title: "エラー",
        description: "議事録の更新に失敗しました",
        variant: "destructive",
      });
    },
  });

  // 週次報告削除のミューテーション
  const deleteReportMutation = useMutation({
    mutationFn: async () => {
      // apiRequestは既にJSONデータを返すので、直接データを取得
      const data = await apiRequest(`/api/weekly-reports/${id}`, {
        method: 'DELETE'
      });
      
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/weekly-reports'] });
      toast({
        title: "成功",
        description: "週次報告が削除されました",
      });
      setLocation('/reports');
    },
    onError: (error) => {
      toast({
        title: "エラー",
        description: "週次報告の削除に失敗しました",
        variant: "destructive",
      });
    },
  });

  // 管理者編集開始のミューテーション
  const adminEditStartMutation = useMutation({
    mutationFn: async () => {
      logger.info('管理者編集開始を試行中', {
        reportId: id,
        user: {
          id: user?.id,
          username: user?.username,
          isAdmin: user?.isAdmin,
          isAuthenticated: !!user
        }
      });

      try {
        // apiRequestは既にJSONデータを返すので、直接データを取得
        const data = await apiRequest(`/api/weekly-reports/${id}/admin-edit-start`, {
          method: 'POST'
        });
        
        logger.debug('APIレスポンスデータ受信', { data });
        
        // データが正常に取得できた場合はそのまま返す
        if (data && typeof data === 'object') {
          return data;
        } else {
          throw new Error('管理者編集の開始に失敗しました: 無効なレスポンスデータ');
        }
        
      } catch (error) {
        logger.error('ADMIN EDIT エラー発生', error instanceof Error ? error : new Error(String(error)));
        
        // apiRequestから投げられたエラーメッセージをより詳細に処理
        const errorMessage = error instanceof Error ? error.message : String(error);
        if (errorMessage.includes('403')) {
          throw new Error('管理者編集の開始に失敗しました (権限エラー)');
        } else if (errorMessage.includes('401')) {
          throw new Error('管理者編集の開始に失敗しました (認証エラー)');
        } else if (errorMessage.includes('404')) {
          throw new Error('管理者編集の開始に失敗しました (週次報告が見つかりません)');
        } else if (errorMessage.includes('500')) {
          throw new Error('管理者編集の開始に失敗しました (サーバーエラー)');
        } else {
          throw new Error(`管理者編集の開始に失敗しました: ${errorMessage}`);
        }
      }
    },
    onSuccess: (data) => {
      // 元データをReact stateに保存
      setOriginalData(data.report);
      // セッションストレージに元データを保存
      sessionStorage.setItem(`adminEdit_original_${id}`, JSON.stringify(data.report));
      // 編集画面に遷移（管理者編集モード）
      setLocation(`/report/edit/${id}?adminEdit=true`);
      toast({
        title: "管理者編集モードを開始しました",
        description: "修正作業を開始してください。",
      });
    },
    onError: (error: Error) => {
      logger.error('管理者編集開始エラー', error);
      
      let errorMessage = error.message;
      let errorTitle = "管理者編集開始エラー";
      
      // HTTPステータスコードに基づく詳細なエラーメッセージ
      if (error.message.includes('403')) {
        errorTitle = "権限エラー";
        errorMessage = "この操作には管理者権限が必要です。管理者でログインしているか確認してください。";
      } else if (error.message.includes('401')) {
        errorTitle = "認証エラー";
        errorMessage = "セッションが期限切れです。再度ログインしてください。";
      } else if (error.message.includes('404')) {
        errorTitle = "データエラー";
        errorMessage = "指定された週次報告が見つかりません。";
      } else if (error.message.includes('500')) {
        errorTitle = "サーバーエラー";
        errorMessage = "サーバー内部でエラーが発生しました。しばらく時間をおいて再試行してください。";
      }
      
      toast({
        title: errorTitle,
        description: errorMessage,
        variant: "destructive",
      });
    }
  });

  // 管理者編集開始ハンドラー
  const handleAdminEditStart = () => {
    if (!report) return;
    adminEditStartMutation.mutate();
  };

  // 削除ハンドラー
  const handleDelete = () => {
    deleteReportMutation.mutate();
    setShowDeleteDialog(false);
  };

  // ステータスの日本語マッピング（共通マップを使用）

  // 議事録編集のヘルパー関数
  const startEditingMeeting = (meetingId: number, title: string, content: string) => {
    setEditingMeetings(prev => ({
      ...prev,
      [meetingId]: { title, content }
    }));
  };

  const cancelEditingMeeting = (meetingId: number) => {
    setEditingMeetings(prev => {
      const newState = { ...prev };
      delete newState[meetingId];
      return newState;
    });
  };

  const saveMeeting = (meetingId: number) => {
    const editData = editingMeetings[meetingId];
    if (editData) {
      updateMeetingMutation.mutate({
        meetingId,
        title: editData.title,
        content: editData.content
      });
      cancelEditingMeeting(meetingId);
    }
  };

  const updateMeetingField = (meetingId: number, field: 'title' | 'content', value: string) => {
    setEditingMeetings(prev => ({
      ...prev,
      [meetingId]: {
        ...prev[meetingId],
        [field]: value
      }
    }));
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-8">
          <p className="text-center">読み込み中...</p>
        </div>
      </div>
    );
  }

  if (!report) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-8">
          <p className="text-center">報告が見つかりません</p>
          <div className="text-center mt-4">
            <Link href="/reports">
              <Button variant="outline">一覧に戻る</Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }
  
  // 関連する案件情報を取得
  const relatedCase = cases?.find(c => c.id === report.caseId);
  const projectName = relatedCase?.projectName || report.projectName;
  
  // AIプロバイダー設定から現在のAIモデル情報を取得
  const getCurrentAIModel = (): string | undefined => {
    if (!aiProviderSettings) return undefined;
    
    const aiProviderSetting = aiProviderSettings.find(setting => setting.key === 'AI_PROVIDER');
    const realtimeProviderSetting = aiProviderSettings.find(setting => setting.key === 'REALTIME_PROVIDER');
    
    // リアルタイム分析用のプロバイダーが設定されていればそれを使用、なければ通常のAIプロバイダー
    const provider = realtimeProviderSetting?.value || aiProviderSetting?.value || 'unknown';
    
    // プロバイダー名をより読みやすい形に変換
    const providerMap: Record<string, string> = {
      'openai': 'OpenAI GPT',
      'ollama': 'Ollama',
      'gemini': 'Google Gemini',
      'groq': 'Groq',
      'openrouter': 'OpenRouter',
    };
    
    return providerMap[provider] || provider;
  };
  
  logger.debug('Report and Case info', {
    reportProjectName: report.projectName,
    caseId: report.caseId,
    foundProjectName: projectName
  });

  const renderSection = (title: string, content: string | null | undefined) => {
    if (!content) return null;
    return (
      <div className="mb-3 sm:mb-4">
        <h3 className="font-semibold mb-2 text-xs sm:text-sm">{title}</h3>
        <p className="whitespace-pre-wrap text-xs sm:text-sm">{content}</p>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-background">
      <ThemeToggle />

      <div className="container mx-auto px-2 sm:px-4 py-4 sm:py-8 max-w-4xl">
        <header className="mb-6 sm:mb-8">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
            <h1 className="text-xl sm:text-3xl font-bold text-primary">週次報告詳細</h1>
            <div className="flex flex-col sm:flex-row gap-2 sm:gap-4">
              <div className="flex flex-col sm:flex-row gap-2">
                <Button 
                  onClick={() => setShowMilestoneDialog(true)}
                  variant="outline"
                  size="sm"
                  className="flex items-center gap-2 text-blue-600 border-blue-200 hover:bg-blue-50 w-full sm:w-auto justify-center"
                >
                  <Target className="h-4 w-4" />
                  マイルストーン
                </Button>
                <Link href={`/report/edit/${id}`}>
                  <Button size="sm" className="flex items-center gap-2 w-full sm:w-auto justify-center">
                    <Edit className="h-4 w-4" />
                    編集
                  </Button>
                </Link>
              </div>
              {user?.isAdmin && (
                <div className="flex flex-col sm:flex-row gap-2">
                  <Button 
                    onClick={handleAdminEditStart}
                    disabled={adminEditStartMutation.isPending}
                    variant="default"
                    size="sm"
                    className="flex items-center gap-2 bg-red-600 hover:bg-red-700 w-full sm:w-auto justify-center"
                  >
                    <ShieldCheck className="h-4 w-4" />
                    {adminEditStartMutation.isPending ? '準備中...' : '管理者編集'}
                  </Button>
                  <Button 
                    onClick={() => setShowDeleteDialog(true)}
                    disabled={deleteReportMutation.isPending}
                    variant="destructive"
                    size="sm"
                    className="flex items-center gap-2 w-full sm:w-auto justify-center"
                  >
                    <Trash2 className="h-4 w-4" />
                    削除
                  </Button>
                </div>
              )}
              <Link href={`/reports?projectName=${encodeURIComponent(projectName || '')}&caseId=${report.caseId || ''}`}>
                <Button variant="outline" size="sm" className="w-full sm:w-auto">一覧に戻る</Button>
              </Link>
            </div>
          </div>
          
          {/* パンくずリスト */}
          <Breadcrumb className="mt-4">
            <BreadcrumbList className="flex-wrap">
              <BreadcrumbItem>
                <BreadcrumbLink asChild>
                  <Link href="/">
                    <span className="flex items-center gap-1 text-xs sm:text-sm">
                      <Home className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                      <span className="hidden xs:inline">ホーム</span>
                    </span>
                  </Link>
                </BreadcrumbLink>
              </BreadcrumbItem>
              
              <BreadcrumbSeparator />
              
              <BreadcrumbItem>
                <BreadcrumbLink asChild>
                  <Link href={`/reports?projectName=${encodeURIComponent(projectName || '')}&caseId=${report.caseId || ''}`}>
                    <span className="flex items-center gap-1 text-xs sm:text-sm">
                      <FileText className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                      <span className="hidden xs:inline">週次報告一覧</span>
                      <span className="xs:hidden">一覧</span>
                    </span>
                  </Link>
                </BreadcrumbLink>
              </BreadcrumbItem>
              
              <BreadcrumbSeparator />
              
              <BreadcrumbItem>
                <BreadcrumbPage className="text-xs sm:text-sm">
                  <span className="hidden sm:inline">
                    週次報告詳細（{new Date(report.reportPeriodStart).toLocaleDateString()} ～ {new Date(report.reportPeriodEnd).toLocaleDateString()}）
                  </span>
                  <span className="sm:hidden">
                    詳細（{new Date(report.reportPeriodStart).toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' })}～{new Date(report.reportPeriodEnd).toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' })}）
                  </span>
                </BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </header>

        <div className="space-y-4 sm:space-y-6">
          <Card>
            <CardContent className="p-4 sm:p-6">
              <h2 className="text-lg sm:text-xl font-semibold mb-3 sm:mb-4 pb-2 border-b">1. 基本情報</h2>
              <div className="grid md:grid-cols-2 gap-3 sm:gap-4">
                <div>
                  <p className="text-xs sm:text-sm text-muted-foreground">報告期間</p>
                  <p className="text-xs sm:text-sm">
                    {new Date(report.reportPeriodStart).toLocaleDateString()} ～{" "}
                    {new Date(report.reportPeriodEnd).toLocaleDateString()}
                  </p>
                </div>
                <div>
                  <p className="text-xs sm:text-sm text-muted-foreground">担当現場名</p>
                  <p className="text-xs sm:text-sm">{report.projectName} - {report.caseName}</p>
                </div>
                <div>
                  <p className="text-xs sm:text-sm text-muted-foreground">報告者名</p>
                  <p className="text-xs sm:text-sm">{report.reporterName}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 sm:p-6">
              <h2 className="text-lg sm:text-xl font-semibold mb-3 sm:mb-4 pb-2 border-b">2. 今週の作業内容</h2>
              {renderSection("作業内容", report.weeklyTasks)}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 sm:p-6">
              <h2 className="text-lg sm:text-xl font-semibold mb-3 sm:mb-4 pb-2 border-b">3. 進捗状況</h2>
              <div className="space-y-3 sm:space-y-4">
                {relatedCase?.includeProgressAnalysis !== false && (
                  <div>
                    <p className="text-xs sm:text-sm text-muted-foreground">進捗率</p>
                    <p className="text-xs sm:text-sm">{report.progressRate}%</p>
                  </div>
                )}
                <div>
                  <p className="text-xs sm:text-sm text-muted-foreground">進捗状況</p>
                  <p className="text-xs sm:text-sm">{progressStatusMap[report.progressStatus as keyof typeof progressStatusMap] || report.progressStatus}</p>
                </div>
                {report.delayIssues === "yes" && renderSection("遅延・問題点の詳細", report.delayDetails)}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 sm:p-6">
              <h2 className="text-lg sm:text-xl font-semibold mb-3 sm:mb-4 pb-2 border-b">4. 課題・問題点</h2>
              {renderSection("課題・問題点", report.issues)}
            </CardContent>
          </Card>

          {report.newRisks === "yes" && (
            <Card>
              <CardContent className="p-4 sm:p-6">
                <h2 className="text-lg sm:text-xl font-semibold mb-3 sm:mb-4 pb-2 border-b">5. 新たなリスク</h2>
                <div className="space-y-3 sm:space-y-4">
                  {renderSection("リスクの概要", report.riskSummary)}
                  {renderSection("対策", report.riskCountermeasures)}
                  <div>
                    <p className="text-xs sm:text-sm text-muted-foreground">リスクレベル</p>
                    <p className="text-xs sm:text-sm">{riskLevelMap[report.riskLevel as keyof typeof riskLevelMap] || report.riskLevel}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardContent className="p-4 sm:p-6">
              <h2 className="text-lg sm:text-xl font-semibold mb-3 sm:mb-4 pb-2 border-b">6. 品質</h2>
              <div className="space-y-3 sm:space-y-4">
                <div>
                  <p className="text-xs sm:text-sm text-muted-foreground">品質懸念事項の有無</p>
                  <p className="text-xs sm:text-sm">{qualityConcernsMap[report.qualityConcerns as keyof typeof qualityConcernsMap] || report.qualityConcerns}</p>
                </div>
                {report.qualityConcerns !== "none" && renderSection("品質懸念事項の詳細", report.qualityDetails)}
                {renderSection("進捗状況", report.testProgress)}
              </div>
            </CardContent>
          </Card>

          {report.changes === "yes" && (
            <Card>
              <CardContent className="p-4 sm:p-6">
                <h2 className="text-lg sm:text-xl font-semibold mb-3 sm:mb-4 pb-2 border-b">7. 変更管理</h2>
                {renderSection("変更内容の詳細", report.changeDetails)}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardContent className="p-4 sm:p-6">
              <h2 className="text-lg sm:text-xl font-semibold mb-3 sm:mb-4 pb-2 border-b">8. 来週の予定</h2>
              {renderSection("来週の作業予定", report.nextWeekPlan)}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 sm:p-6">
              <h2 className="text-lg sm:text-xl font-semibold mb-3 sm:mb-4 pb-2 border-b">9. 支援・判断要望</h2>
              {renderSection("支援・判断の要望事項", report.supportRequests)}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 sm:p-6">
              <h2 className="text-lg sm:text-xl font-semibold mb-3 sm:mb-4 pb-2 border-b">10. その他の懸念事項</h2>
              <div className="space-y-4 sm:space-y-6">
                {report.resourceConcerns === "exists" && (
                  <div>
                    <h3 className="font-semibold mb-2">リソースに関する懸念</h3>
                    {renderSection("詳細", report.resourceDetails)}
                  </div>
                )}
                {report.customerIssues === "exists" && (
                  <div>
                    <h3 className="font-semibold mb-2">顧客に関する懸念</h3>
                    {renderSection("詳細", report.customerDetails)}
                  </div>
                )}
                {report.environmentIssues === "exists" && (
                  <div>
                    <h3 className="font-semibold mb-2">環境に関する懸念</h3>
                    {renderSection("詳細", report.environmentDetails)}
                  </div>
                )}
                {report.costIssues === "exists" && (
                  <div>
                    <h3 className="font-semibold mb-2">コストに関する懸念</h3>
                    {renderSection("詳細", report.costDetails)}
                  </div>
                )}
                {report.knowledgeIssues === "exists" && (
                  <div>
                    <h3 className="font-semibold mb-2">知識・スキルに関する懸念</h3>
                    {renderSection("詳細", report.knowledgeDetails)}
                  </div>
                )}
                {report.trainingIssues === "exists" && (
                  <div>
                    <h3 className="font-semibold mb-2">教育に関する懸念</h3>
                    {renderSection("詳細", report.trainingDetails)}
                  </div>
                )}
                {report.urgentIssues === "exists" && (
                  <div>
                    <h3 className="font-semibold mb-2">緊急課題に関する懸念</h3>
                    {renderSection("詳細", report.urgentDetails)}
                  </div>
                )}
                {report.businessOpportunities === "exists" && (
                  <div>
                    <h3 className="font-semibold mb-2">営業チャンス・顧客ニーズ</h3>
                    {renderSection("詳細", report.businessDetails)}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {report.aiAnalysis && (
            <Card>
              <CardContent className="p-4 sm:p-6">
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-2 mb-3 sm:mb-4 pb-2 border-b">
                  <h2 className="text-lg sm:text-xl font-semibold">■ AI分析結果</h2>
                  <AIMetadataDisplay
                    aiModel={getCurrentAIModel()}
                    createdAt={report.createdAt}
                    updatedAt={report.updatedAt}
                    className="sm:text-right"
                  />
                </div>
                <div className="prose prose-sm max-w-none">
                  <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>{report.aiAnalysis}</ReactMarkdown>
                </div>
              </CardContent>
            </Card>
          )}

          {meetings && meetings.length > 0 && (
            <Card>
              <CardContent className="p-4 sm:p-6">
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-2 mb-3 sm:mb-4 pb-2 border-b">
                  <h2 id="meetings-section" className="text-lg sm:text-xl font-semibold">■ 確認会議事録</h2>
                  <AIMetadataDisplay
                    aiModel={getCurrentAIModel()}
                    createdAt={meetings[0]?.createdAt}
                    updatedAt={meetings[0]?.createdAt !== meetings[meetings.length - 1]?.createdAt ? meetings[meetings.length - 1]?.createdAt : undefined}
                    className="sm:text-right"
                  />
                </div>
                {meetings.map((meeting, index) => (
                  <div key={meeting.id} className="mb-4 sm:mb-6 last:mb-0">
                    {meetings.length > 1 && (
                      <h3 className="text-base sm:text-lg font-medium mb-2 sm:mb-3 text-gray-700">
                        {meetings.length - index}回目の修正 ({new Date(meeting.createdAt).toLocaleDateString('ja-JP')})
                      </h3>
                    )}
                    <div className="bg-gray-50 rounded-lg p-3 sm:p-4">
                      {editingMeetings[meeting.id] ? (
                        // 編集モード
                        <div>
                          <div className="mb-4">
                            <label className="block text-sm font-medium mb-2">タイトル:</label>
                            <input
                              type="text"
                              value={editingMeetings[meeting.id].title}
                              onChange={(e) => updateMeetingField(meeting.id, 'title', e.target.value)}
                              className="w-full p-2 border rounded"
                            />
                          </div>
                          <div className="mb-4">
                            <label className="block text-sm font-medium mb-2">内容:</label>
                            <Textarea
                              value={editingMeetings[meeting.id].content}
                              onChange={(e) => updateMeetingField(meeting.id, 'content', e.target.value)}
                              className="min-h-[200px]"
                            />
                          </div>
                          <div className="flex gap-2">
                            <Button 
                              size="sm" 
                              onClick={() => saveMeeting(meeting.id)}
                              disabled={updateMeetingMutation.isPending}
                            >
                              {updateMeetingMutation.isPending ? "保存中..." : "保存"}
                            </Button>
                            <Button 
                              size="sm" 
                              variant="outline" 
                              onClick={() => cancelEditingMeeting(meeting.id)}
                            >
                              キャンセル
                            </Button>
                          </div>
                        </div>
                      ) : (
                        // 表示モード
                        <div>
                          <div className="flex justify-between items-center mb-2">
                            <h4 className="font-medium">{meeting.title}</h4>
                            <Button 
                              size="sm" 
                              variant="outline"
                              onClick={() => startEditingMeeting(meeting.id, meeting.title, meeting.content)}
                            >
                              編集
                            </Button>
                          </div>
                          <div className="prose prose-sm max-w-none">
                            <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>{meeting.content}</ReactMarkdown>
                          </div>
                          <div className="mt-3 text-sm text-gray-500">
                            修正者: {meeting.modifiedBy} | 
                            日時: {new Date(meeting.createdAt).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* 管理者確認メール文章セクション */}
          {user?.isAdmin && (
            <Card>
              <CardContent className="p-4 sm:p-6">
                <div className="flex flex-col gap-2 mb-3 sm:mb-4 pb-2 border-b">
                  <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 sm:gap-0">
                    <h2 className="text-lg sm:text-xl font-semibold">■ 管理者確認メール文章</h2>
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => regenerateAdminEmailMutation.mutate()}
                      disabled={regenerateAdminEmailMutation.isPending}
                      className="w-full sm:w-auto"
                    >
                      {regenerateAdminEmailMutation.isPending ? '再生成中...' : '更新'}
                    </Button>
                  </div>
                  <AIMetadataDisplay
                    aiModel={getCurrentAIModel()}
                    createdAt={report.createdAt}
                    updatedAt={report.updatedAt}
                    className="sm:text-right"
                  />
                </div>
                <div className="bg-gray-50 rounded-lg p-3 sm:p-4">
                  {report?.adminConfirmationEmail ? (
                    <div className="prose prose-sm max-w-none">
                      <pre className="whitespace-pre-wrap font-sans text-sm">
                        {report.adminConfirmationEmail}
                      </pre>
                    </div>
                  ) : (
                    <div className="text-gray-500 text-sm text-center py-4">
                      管理者確認メール文章が生成されていません。<br />
                      「更新」ボタンを押して生成してください。
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* 削除確認モーダル */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>本当に削除しますか？</DialogTitle>
            <DialogDescription className="space-y-2">
              <p className="font-medium text-red-600">
                この操作は取り消すことができません。
              </p>
              <p>
                以下の週次報告を完全に削除します：
              </p>
              <div className="bg-gray-50 p-3 rounded border">
                <p className="font-medium">
                  {report?.projectName} - {report?.caseName}
                </p>
                <p className="text-sm text-gray-600">
                  期間: {report && new Date(report.reportPeriodStart).toLocaleDateString()} ～ {report && new Date(report.reportPeriodEnd).toLocaleDateString()}
                </p>
                <p className="text-sm text-gray-600">
                  報告者: {report?.reporterName}
                </p>
              </div>
              <p className="text-red-600 font-medium">
                本当に削除してもよろしいですか？
              </p>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowDeleteDialog(false)}
              disabled={deleteReportMutation.isPending}
            >
              キャンセル
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleteReportMutation.isPending}
            >
              {deleteReportMutation.isPending ? '削除中...' : '削除'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* マイルストーンダイアログ */}
      <MilestoneDialog
        open={showMilestoneDialog}
        onOpenChange={setShowMilestoneDialog}
        milestone={relatedCase?.milestone}
        projectName={projectName}
        caseName={report.caseName || ''}
      />
    </div>
  );
}