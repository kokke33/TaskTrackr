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
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { Textarea } from "@/components/ui/textarea";
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
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [originalData, setOriginalData] = useState<WeeklyReport | null>(null);
  const { toast } = useToast();
  
  // 議事録編集の状態管理
  const [editingMeetings, setEditingMeetings] = useState<{[key: number]: {title: string, content: string}}>({});
  
  // 削除確認モーダルの状態管理
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  
  // マイルストーンダイアログの状態管理
  const [showMilestoneDialog, setShowMilestoneDialog] = useState(false);
  
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

  // 議事録更新のミューテーション
  const updateMeetingMutation = useMutation({
    mutationFn: async ({ meetingId, title, content }: { meetingId: number, title: string, content: string }) => {
      const response = await fetch(`/api/weekly-reports/meetings/${meetingId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ title, content }),
        credentials: 'include',
      });
      
      if (!response.ok) {
        throw new Error('議事録の更新に失敗しました');
      }
      
      return response.json();
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
      const response = await fetch(`/api/weekly-reports/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      
      if (!response.ok) {
        throw new Error('週次報告の削除に失敗しました');
      }
      
      return response.json();
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
      const response = await fetch(`/api/weekly-reports/${id}/admin-edit-start`, {
        method: 'POST',
        credentials: 'include',
      });
      if (!response.ok) {
        throw new Error('管理者編集の開始に失敗しました');
      }
      return response.json();
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
      toast({
        title: "エラー",
        description: error.message,
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

  // ステータスの日本語マッピング
  const progressStatusMap = {
    'on-schedule': '予定通り',
    'slightly-delayed': '少し遅れている',
    'severely-delayed': '大幅に遅れている',
    'ahead': '前倒しで進行中'
  };

  const qualityConcernsMap = {
    'none': 'なし',
    'minor': '軽微な懸念あり',
    'major': '重大な懸念あり'
  };

  const riskLevelMap = {
    'high': '高',
    'medium': '中',
    'low': '低'
  };

  const binaryStatusMap = {
    'exists': 'あり',
    'none': 'なし'
  };

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
  
  console.log('Report and Case info:', { 
    reportProjectName: report.projectName,
    caseId: report.caseId,
    foundProjectName: projectName 
  });

  const renderSection = (title: string, content: string | null | undefined) => {
    if (!content) return null;
    return (
      <div className="mb-4">
        <h3 className="font-semibold mb-2 text-sm">{title}</h3>
        <p className="whitespace-pre-wrap text-sm">{content}</p>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-background">
      <ThemeToggle />

      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <header className="mb-8">
          <div className="flex justify-between items-center">
            <h1 className="text-3xl font-bold text-primary">週次報告詳細</h1>
            <div className="flex gap-4">
              <Button 
                onClick={() => setShowMilestoneDialog(true)}
                variant="outline"
                className="flex items-center gap-2 text-blue-600 border-blue-200 hover:bg-blue-50"
              >
                <Target className="h-4 w-4" />
                マイルストーン
              </Button>
              <Link href={`/report/edit/${id}`}>
                <Button className="flex items-center gap-2">
                  <Edit className="h-4 w-4" />
                  編集
                </Button>
              </Link>
              {user?.isAdmin && (
                <>
                  <Button 
                    onClick={handleAdminEditStart}
                    disabled={adminEditStartMutation.isPending}
                    variant="default"
                    className="flex items-center gap-2 bg-red-600 hover:bg-red-700"
                  >
                    <ShieldCheck className="h-4 w-4" />
                    {adminEditStartMutation.isPending ? '準備中...' : '管理者編集'}
                  </Button>
                  <Button 
                    onClick={() => setShowDeleteDialog(true)}
                    disabled={deleteReportMutation.isPending}
                    variant="destructive"
                    className="flex items-center gap-2"
                  >
                    <Trash2 className="h-4 w-4" />
                    削除
                  </Button>
                </>
              )}
              <Link href={`/reports?projectName=${encodeURIComponent(projectName || '')}&caseId=${report.caseId || ''}`}>
                <Button variant="outline">一覧に戻る</Button>
              </Link>
            </div>
          </div>
          
          {/* パンくずリスト */}
          <Breadcrumb className="mt-4">
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
                  <Link href={`/reports?projectName=${encodeURIComponent(projectName || '')}&caseId=${report.caseId || ''}`}>
                    <span className="flex items-center gap-1">
                      <FileText className="h-3.5 w-3.5" />
                      週次報告一覧
                    </span>
                  </Link>
                </BreadcrumbLink>
              </BreadcrumbItem>
              
              <BreadcrumbSeparator />
              
              <BreadcrumbItem>
                <BreadcrumbPage>
                  週次報告詳細（{new Date(report.reportPeriodStart).toLocaleDateString()} ～ {new Date(report.reportPeriodEnd).toLocaleDateString()}）
                </BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </header>

        <div className="space-y-6">
          <Card>
            <CardContent className="p-6">
              <h2 className="text-xl font-semibold mb-4 pb-2 border-b">1. 基本情報</h2>
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">報告期間</p>
                  <p className="text-sm">
                    {new Date(report.reportPeriodStart).toLocaleDateString()} ～{" "}
                    {new Date(report.reportPeriodEnd).toLocaleDateString()}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">担当現場名</p>
                  <p className="text-sm">{report.projectName} - {report.caseName}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">報告者名</p>
                  <p className="text-sm">{report.reporterName}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <h2 className="text-xl font-semibold mb-4 pb-2 border-b">2. 今週の作業内容</h2>
              {renderSection("作業内容", report.weeklyTasks)}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <h2 className="text-xl font-semibold mb-4 pb-2 border-b">3. 進捗状況</h2>
              <div className="space-y-4">
                {relatedCase?.includeProgressAnalysis !== false && (
                  <div>
                    <p className="text-sm text-muted-foreground">進捗率</p>
                    <p className="text-sm">{report.progressRate}%</p>
                  </div>
                )}
                <div>
                  <p className="text-sm text-muted-foreground">進捗状況</p>
                  <p className="text-sm">{progressStatusMap[report.progressStatus as keyof typeof progressStatusMap] || report.progressStatus}</p>
                </div>
                {report.delayIssues === "yes" && renderSection("遅延・問題点の詳細", report.delayDetails)}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <h2 className="text-xl font-semibold mb-4 pb-2 border-b">4. 課題・問題点</h2>
              {renderSection("課題・問題点", report.issues)}
            </CardContent>
          </Card>

          {report.newRisks === "yes" && (
            <Card>
              <CardContent className="p-6">
                <h2 className="text-xl font-semibold mb-4 pb-2 border-b">5. 新たなリスク</h2>
                <div className="space-y-4">
                  {renderSection("リスクの概要", report.riskSummary)}
                  {renderSection("対策", report.riskCountermeasures)}
                  <div>
                    <p className="text-sm text-muted-foreground">リスクレベル</p>
                    <p className="text-sm">{riskLevelMap[report.riskLevel as keyof typeof riskLevelMap] || report.riskLevel}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardContent className="p-6">
              <h2 className="text-xl font-semibold mb-4 pb-2 border-b">6. 品質</h2>
              <div className="space-y-4">
                <div>
                  <p className="text-sm text-muted-foreground">品質懸念事項の有無</p>
                  <p className="text-sm">{qualityConcernsMap[report.qualityConcerns as keyof typeof qualityConcernsMap] || report.qualityConcerns}</p>
                </div>
                {report.qualityConcerns !== "none" && renderSection("品質懸念事項の詳細", report.qualityDetails)}
                {renderSection("進捗状況", report.testProgress)}
              </div>
            </CardContent>
          </Card>

          {report.changes === "yes" && (
            <Card>
              <CardContent className="p-6">
                <h2 className="text-xl font-semibold mb-4 pb-2 border-b">7. 変更管理</h2>
                {renderSection("変更内容の詳細", report.changeDetails)}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardContent className="p-6">
              <h2 className="text-xl font-semibold mb-4 pb-2 border-b">8. 来週の予定</h2>
              {renderSection("来週の作業予定", report.nextWeekPlan)}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <h2 className="text-xl font-semibold mb-4 pb-2 border-b">9. 支援・判断要望</h2>
              {renderSection("支援・判断の要望事項", report.supportRequests)}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <h2 className="text-xl font-semibold mb-4 pb-2 border-b">10. その他の懸念事項</h2>
              <div className="space-y-6">
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
              <CardContent className="p-6">
                <h2 className="text-xl font-semibold mb-4 pb-2 border-b">■ AI分析結果</h2>
                <div className="prose prose-sm max-w-none">
                  <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>{report.aiAnalysis}</ReactMarkdown>
                </div>
              </CardContent>
            </Card>
          )}

          {meetings && meetings.length > 0 && (
            <Card>
              <CardContent className="p-6">
                <h2 className="text-xl font-semibold mb-4 pb-2 border-b">■ 確認会議事録</h2>
                {meetings.map((meeting, index) => (
                  <div key={meeting.id} className="mb-6 last:mb-0">
                    {meetings.length > 1 && (
                      <h3 className="text-lg font-medium mb-3 text-gray-700">
                        {meetings.length - index}回目の修正 ({new Date(meeting.createdAt).toLocaleDateString('ja-JP')})
                      </h3>
                    )}
                    <div className="bg-gray-50 rounded-lg p-4">
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