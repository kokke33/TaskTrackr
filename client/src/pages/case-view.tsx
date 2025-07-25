import { useEffect, useState, useMemo } from "react";
import { useParams, Link, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { type Case } from "@shared/schema";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Card, CardContent } from "@/components/ui/card";
import { 
  PenSquare, 
  ArrowLeft, 
  Briefcase, 
  Calendar,
  FileText,
  Check,
  X,
  Trash2,
  AlertTriangle
} from "lucide-react";
import { 
  Breadcrumb, 
  BreadcrumbItem, 
  BreadcrumbLink, 
  BreadcrumbList, 
  BreadcrumbPage, 
  BreadcrumbSeparator 
} from "@/components/ui/breadcrumb";
import { ThemeToggle } from "@/components/theme-toggle";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';

export default function CaseView() {
  // すべてのReactフックを関数の先頭で宣言
  const { id } = useParams<{ id: string }>();
  const [location, setLocation] = useLocation();
  const [isEditing, setIsEditing] = useState(false);
  const [editedCase, setEditedCase] = useState<Partial<Case>>({});
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const { toast } = useToast();

  // 案件データを取得
  const { data: caseData, isLoading } = useQuery<Case>({
    queryKey: [`/api/cases/${id}`],
    enabled: !!id,
    staleTime: 0, // 常に最新のデータを取得
    refetchOnMount: true, // コンポーネントマウント時に再取得
  });

  // URLクエリパラメータを取得（前のページから情報を取得するため）
  const searchParams = useMemo(() => new URLSearchParams(window.location.search), []);
  const fromPage = useMemo(() => searchParams.get('from') || '', [searchParams]);
  const fromProjectId = useMemo(() => searchParams.get('projectId') || '', [searchParams]);
  const fromProjectName = useMemo(() => searchParams.get('projectName') || '', [searchParams]);

  // 案件データが変更された時に編集データを更新
  useEffect(() => {
    if (caseData) {
      setEditedCase({
        caseName: caseData.caseName,
        description: caseData.description,
        milestone: caseData.milestone,
        includeProgressAnalysis: caseData.includeProgressAnalysis,
      });
    }
  }, [caseData]);

  // パンくずリストに表示するためのパス情報を決定
  const pathInfo = useMemo(() => {
    if (!caseData) return { 
      showProject: false, 
      showReports: false,
      projectPath: '', 
      projectName: '',
      reportsPath: ''
    };

    // プロジェクト詳細ページから来た場合
    if (fromPage === 'project' && fromProjectId) {
      return {
        showProject: true,
        showReports: false,
        projectPath: `/project/${fromProjectId}`,
        projectName: caseData.projectName,
        reportsPath: ''
      };
    }
    // 週次報告一覧から来た場合
    else if (fromPage === 'reports') {
      return {
        showProject: false,
        showReports: true,
        projectPath: '',
        projectName: caseData.projectName,
        reportsPath: '/reports'
      };
    }
    // 案件一覧からの場合（デフォルト）
    else {
      return {
        showProject: false,
        showReports: false,
        projectPath: `/project/name/${encodeURIComponent(caseData.projectName)}`,
        projectName: caseData.projectName,
        reportsPath: ''
      };
    }
  }, [caseData, fromPage, fromProjectId]);

  // 編集開始時にデータを初期化
  useEffect(() => {
    if (caseData && !isEditing) {
      setEditedCase({
        caseName: caseData.caseName,
        description: caseData.description,
        milestone: caseData.milestone,
        includeProgressAnalysis: caseData.includeProgressAnalysis,
      });
    }
  }, [caseData, isEditing]);

  // 編集モードの切り替え
  const toggleEditMode = () => {
    setIsEditing(!isEditing);
  };

  // マイルストーン更新
  const updateMilestoneMutation = useMutation<Case, Error, string>({
    mutationFn: async (newMilestone) => {
      // マイルストーン専用エンドポイントを使用（一般ユーザーも利用可能）
      return apiRequest<Case>(`/api/cases/${id}/milestone`, {
        method: "PATCH",
        data: { milestone: newMilestone }
      });
    },
  });


  const saveChanges = async () => {
    if (!caseData) return;

    try {
      // apiRequestを使ってTanStack Queryのキャッシュを更新
      await apiRequest(`/api/cases/${id}`, {
        method: 'PUT',
        data: {
          ...caseData,
          ...editedCase
        }
      });
      //Update Milestone separately using the new mutation
      await updateMilestoneMutation.mutateAsync(editedCase.milestone || "");

      // 編集モードを終了
      setIsEditing(false);

      // キャッシュを無効化して最新データを取得する
      // 個別の案件データだけでなく、案件一覧も更新
      queryClient.invalidateQueries({ queryKey: [`/api/cases/${id}`] });
      queryClient.invalidateQueries({ queryKey: ["/api/cases"] });

      // 成功メッセージを表示
      toast({
        title: "保存成功",
        description: "案件情報が正常に更新されました。"
      });
    } catch (error) {
      console.error('Error updating case:', error);

      // エラーメッセージを表示
      toast({
        title: "エラー",
        description: "案件情報の更新に失敗しました。",
        variant: "destructive"
      });
    }
  };

  // 編集をキャンセル
  const cancelEdit = () => {
    setIsEditing(false);
    // 元のデータに戻す
    if (caseData) {
      setEditedCase({
        caseName: caseData.caseName,
        description: caseData.description,
        milestone: caseData.milestone,
        includeProgressAnalysis: caseData.includeProgressAnalysis,
      });
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setEditedCase({
      ...editedCase,
      [name]: value,
    });
  };

  const handleCheckboxChange = (checked: boolean) => {
    setEditedCase({
      ...editedCase,
      includeProgressAnalysis: checked,
    });
  };

  // 削除ダイアログを開く
  const openDeleteDialog = () => {
    setIsDeleteDialogOpen(true);
  };

  // 削除を実行
  const handleDelete = async () => {
    if (!id) return;

    try {
      // 削除フラグを立てるAPIを実行
      await apiRequest(`/api/cases/${id}`, {
        method: 'PUT',
        data: {
          ...(caseData || {}),
          isDeleted: true
        }
      });

      // 個別の案件キャッシュも無効化
      queryClient.invalidateQueries({ queryKey: [`/api/cases/${id}`] });
      // 一覧キャッシュを無効化
      queryClient.invalidateQueries({ queryKey: ["/api/cases"] });

      toast({
        title: "削除成功",
        description: "案件を削除しました。",
        variant: "default"
      });

      // 案件一覧ページにリダイレクト
      setLocation("/cases");
    } catch (error) {
      console.error('Error deleting case:', error);
      toast({
        title: "エラー",
        description: "案件の削除に失敗しました。",
        variant: "destructive"
      });
    }
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

  if (!caseData) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-8">
          <p className="text-center">案件が見つかりません</p>
          <div className="flex justify-center mt-4">
            <Button onClick={() => setLocation('/cases')}>
              案件一覧に戻る
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-2xl">
        <div className="flex justify-between items-center mb-6">
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink asChild>
                  <Link href="/">ホーム</Link>
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              {pathInfo.showReports ? (
                <BreadcrumbItem>
                  <BreadcrumbLink asChild>
                    <Link href="/reports">週次報告一覧</Link>
                  </BreadcrumbLink>
                </BreadcrumbItem>
              ) : (
                <BreadcrumbItem>
                  <BreadcrumbLink asChild>
                    <Link href="/cases">案件一覧</Link>
                  </BreadcrumbLink>
                </BreadcrumbItem>
              )}

              {pathInfo.showProject && (
                <>
                  <BreadcrumbSeparator />
                  <BreadcrumbItem>
                    <BreadcrumbLink asChild>
                      <Link href={pathInfo.projectPath}>
                        {pathInfo.projectName}
                      </Link>
                    </BreadcrumbLink>
                  </BreadcrumbItem>
                </>
              )}

              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>{caseData.caseName}</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
          <ThemeToggle />
        </div>

        <header className="mb-6">
          <div className="flex justify-between items-center">
            <h1 className="text-2xl font-semibold">案件詳細</h1>
            <div className="flex gap-2">
              {pathInfo.showReports ? (
                <Link href="/reports">
                  <Button variant="outline" size="sm">
                    <ArrowLeft className="h-4 w-4 mr-2" /> 報告一覧に戻る
                  </Button>
                </Link>
              ) : (
                <Link href="/cases">
                  <Button variant="outline" size="sm">
                    <ArrowLeft className="h-4 w-4 mr-2" /> 案件一覧に戻る
                  </Button>
                </Link>
              )}
              {isEditing ? (
                <>
                  <Button variant="outline" size="sm" onClick={cancelEdit}>
                    <X className="h-4 w-4 mr-2" /> キャンセル
                  </Button>
                  <Button size="sm" onClick={saveChanges}>
                    <Check className="h-4 w-4 mr-2" /> 保存
                  </Button>
                </>
              ) : (
                <Button size="sm" onClick={toggleEditMode}>
                  <PenSquare className="h-4 w-4 mr-2" /> 編集する
                </Button>
              )}
            </div>
          </div>
        </header>

        <Card>
          <CardContent className="p-6">
            <div className="space-y-6">
              <div className="space-y-2">
                <h2 className="text-sm font-medium text-muted-foreground">プロジェクト名</h2>
                <div className="flex items-center gap-2 bg-accent/50 p-2 rounded-md">
                  <Briefcase className="h-4 w-4 text-primary" />
                  <div>{caseData.projectName}</div>
                </div>
              </div>

              <div className="space-y-2">
                <h2 className="text-sm font-medium text-muted-foreground">案件名</h2>
                {isEditing ? (
                  <Input
                    name="caseName"
                    value={editedCase.caseName || ''}
                    onChange={handleInputChange}
                    className="w-full"
                  />
                ) : (
                  <div className="bg-accent/50 p-2 rounded-md">
                    <h3 className="text-lg font-semibold">{caseData.caseName}</h3>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <h2 className="text-sm font-medium text-muted-foreground">説明</h2>
                {isEditing ? (
                  <Textarea
                    name="description"
                    value={editedCase.description || ''}
                    onChange={handleInputChange}
                    className="min-h-[100px]"
                  />
                ) : (
                  <div className="bg-accent/50 p-3 rounded-md min-h-[100px] whitespace-pre-wrap">
                    {caseData.description || "説明はありません"}
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <h2 className="text-sm font-medium text-muted-foreground">マイルストーン</h2>
                {isEditing ? (
                  <Textarea
                    name="milestone"
                    value={editedCase.milestone || ''}
                    onChange={handleInputChange}
                    className="min-h-[100px]"
                    placeholder="マークダウン形式で入力できます（見出し、リスト、表、コードブロック等に対応）"
                  />
                ) : (
                  <div className="bg-accent/50 p-3 rounded-md min-h-[100px]">
                    {caseData.milestone ? (
                      <div className="prose prose-sm max-w-none dark:prose-invert">
                        <ReactMarkdown 
                          remarkPlugins={[remarkGfm]} 
                          rehypePlugins={[rehypeRaw]}
                        >
                          {caseData.milestone}
                        </ReactMarkdown>
                      </div>
                    ) : (
                      <div className="text-muted-foreground">マイルストーンはありません</div>
                    )}
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <h2 className="text-sm font-medium text-muted-foreground">進捗率分析設定</h2>
                {isEditing ? (
                  <div className="flex items-center space-x-2 bg-accent/50 p-3 rounded-md">
                    <Checkbox
                      checked={editedCase.includeProgressAnalysis ?? true}
                      onCheckedChange={handleCheckboxChange}
                    />
                    <span>週次報告詳細やAI分析結果で進捗率を分析対象に含める</span>
                  </div>
                ) : (
                  <div className="bg-accent/50 p-3 rounded-md">
                    {caseData.includeProgressAnalysis !== false ? "✓ 進捗率分析を含める" : "✗ 進捗率分析を含めない"}
                  </div>
                )}
              </div>

              {caseData.isDeleted && (
                <div className="p-3 bg-destructive/10 text-destructive rounded-md">
                  この案件は削除フラグが立っています。週次報告一覧に表示されません。
                </div>
              )}
            </div>

            <div className="flex justify-between mt-8">
              <Button 
                variant="destructive" 
                className="flex items-center gap-2"
                onClick={openDeleteDialog}
                disabled={isEditing}
              >
                <Trash2 className="h-4 w-4" />
                削除する
              </Button>
              <Link href={`/reports?caseId=${caseData.id}`}>
                <Button variant="outline" className="flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  この案件の週次報告を表示
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>

        {/* 削除確認ダイアログ */}
        <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>案件を削除しますか？</AlertDialogTitle>
              <AlertDialogDescription>
                <div className="flex flex-col gap-2">
                  <p>案件「{caseData.caseName}」を削除します。この操作は元に戻せません。</p>
                  <div className="flex items-center text-destructive gap-2 mt-2">
                    <AlertTriangle className="h-5 w-5" />
                    <span>削除された案件は週次報告一覧から非表示になります</span>
                  </div>
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>キャンセル</AlertDialogCancel>
              <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                削除する
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}