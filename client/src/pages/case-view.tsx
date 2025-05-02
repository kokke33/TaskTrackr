
import { useEffect, useState, useMemo } from "react";
import { useParams, Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { type Case } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { 
  PenSquare, 
  ArrowLeft, 
  Briefcase, 
  Calendar,
  FileText,
  Check,
  X
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
import { apiRequest } from "@/lib/queryClient";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export default function CaseView() {
  // すべてのReactフックを関数の先頭で宣言
  const { id } = useParams<{ id: string }>();
  const [location, setLocation] = useLocation();
  const [isEditing, setIsEditing] = useState(false);
  const [editedCase, setEditedCase] = useState<Partial<Case>>({});
  const { toast } = useToast();

  // 案件データを取得
  const { data: caseData, isLoading } = useQuery<Case>({
    queryKey: [`/api/cases/${id}`],
    enabled: !!id,
  });

  // URLクエリパラメータを取得（前のページから情報を取得するため）
  const searchParams = useMemo(() => new URLSearchParams(window.location.search), []);
  const fromPage = useMemo(() => searchParams.get('from') || '', [searchParams]);
  const fromProjectId = useMemo(() => searchParams.get('projectId') || '', [searchParams]);
  const fromProjectName = useMemo(() => searchParams.get('projectName') || '', [searchParams]);

  // パンくずリストに表示するためのパス情報を決定
  const pathInfo = useMemo(() => {
    if (!caseData) return { showProject: false, projectPath: '', projectName: '' };
    
    // プロジェクト詳細ページから来た場合
    if (fromPage === 'project' && fromProjectId) {
      return {
        showProject: true,
        projectPath: `/project/${fromProjectId}`,
        projectName: caseData.projectName
      };
    }
    // 案件一覧から来た場合
    else {
      return {
        showProject: false,
        projectPath: `/project/name/${encodeURIComponent(caseData.projectName)}`,
        projectName: caseData.projectName
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
      });
    }
  }, [caseData, isEditing]);

  // 編集モードの切り替え
  const toggleEditMode = () => {
    setIsEditing(!isEditing);
  };
  
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
      
      // 編集モードを終了
      setIsEditing(false);
      
      // キャッシュを無効化して最新データを取得する
      queryClient.invalidateQueries({ queryKey: [`/api/cases/${id}`] });
      
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
              <BreadcrumbItem>
                <BreadcrumbLink asChild>
                  <Link href="/cases">案件一覧</Link>
                </BreadcrumbLink>
              </BreadcrumbItem>
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
              <Link href="/cases">
                <Button variant="outline" size="sm">
                  <ArrowLeft className="h-4 w-4 mr-2" /> 一覧に戻る
                </Button>
              </Link>
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
                  />
                ) : (
                  <div className="bg-accent/50 p-3 rounded-md min-h-[100px] whitespace-pre-wrap">
                    {caseData.milestone || "マイルストーンはありません"}
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
              <Link href={`/reports?caseId=${caseData.id}`}>
                <Button variant="outline" className="flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  この案件の週次報告を表示
                </Button>
              </Link>
              {!isEditing && (
                <Button 
                  className="flex items-center gap-2"
                  onClick={toggleEditMode}
                >
                  <PenSquare className="h-4 w-4" />
                  編集する
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
