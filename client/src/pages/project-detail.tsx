import React from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams, Link, useLocation } from "wouter";
import { Project, Case } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb";
import { ThemeToggle } from "@/components/theme-toggle";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Home, FolderKanban, Briefcase, PenSquare, FileText, Users } from "lucide-react";
import { ManagerMeetingForm } from "@/components/manager-meeting-form";
import { ManagerMeetingList } from "@/components/manager-meeting-list";

export default function ProjectDetail() {
  const params = useParams<{ id?: string, name?: string }>();
  const [, setLocation] = useLocation();
  const [selectedMonth, setSelectedMonth] = React.useState<string>("");
  
  // プロジェクトIDまたは名前から情報を取得
  const projectId = params.id ? parseInt(params.id) : undefined;
  const projectName = params.name ? decodeURIComponent(params.name) : undefined;
  
  // すべてのプロジェクト一覧を取得（名前からIDを検索する場合に使用）
  const { data: allProjects, isLoading: isLoadingAllProjects } = useQuery<Project[]>({
    queryKey: ['/api/projects'],
    enabled: !!projectName && !projectId,
    staleTime: 1000 * 60, // 1分間キャッシュ
  });
  
  // 名前からIDを取得
  const resolvedProjectId = React.useMemo(() => {
    if (projectId) return projectId;
    if (projectName && allProjects) {
      const foundProject = allProjects.find(p => p.name === projectName);
      return foundProject?.id;
    }
    return undefined;
  }, [projectId, projectName, allProjects]);
  
  // プロジェクト情報を取得
  const { data: project, isLoading: isLoadingProject } = useQuery<Project>({
    queryKey: [`/api/projects/${resolvedProjectId}`],
    enabled: !!resolvedProjectId,
    staleTime: 1000 * 60, // 1分間キャッシュ
  });

  // プロジェクトに関連する案件を取得
  const { data: cases, isLoading: isLoadingCases } = useQuery<Case[]>({
    queryKey: [`/api/cases?projectName=${encodeURIComponent(project?.name || '')}`],
    enabled: !!project?.name,
    staleTime: 1000 * 60, // 1分間キャッシュ
  });

  // マネージャ定例議事録の利用可能月を取得
  const { data: availableMonths = [] } = useQuery<string[]>({
    queryKey: ["/api/projects", resolvedProjectId, "manager-meetings", "months"],
    enabled: !!resolvedProjectId,
    staleTime: 1000 * 60, // 1分間キャッシュ
  });

  if (isLoadingProject || isLoadingAllProjects || (!projectId && !project)) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-8">
          <p className="text-center">読み込み中...</p>
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-8">
          <p className="text-center">プロジェクトが見つかりません</p>
          <div className="flex justify-center mt-4">
            <Button onClick={() => setLocation('/projects')}>
              プロジェクト一覧に戻る
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <div className="flex justify-between items-center mb-6">
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink asChild>
                  <Link href="/">
                    <Home className="h-4 w-4" />
                  </Link>
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbLink asChild>
                  <Link href="/projects">
                    <span className="flex items-center gap-1">
                      <FolderKanban className="h-3.5 w-3.5" />
                      プロジェクト一覧
                    </span>
                  </Link>
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>
                  <span className="flex items-center gap-1">
                    プロジェクト詳細: {project.name}
                  </span>
                </BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
          <ThemeToggle />
        </div>

        <div className="mb-6 flex justify-between items-center">
          <h1 className="text-2xl font-bold">プロジェクト詳細: {project.name}</h1>
          <Button 
            variant="outline"
            onClick={() => setLocation(`/project/edit/${project.id}`)}
            className="flex items-center gap-2"
          >
            <PenSquare className="h-4 w-4" /> 編集
          </Button>
        </div>

        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="mb-4">
            <TabsTrigger value="overview">プロジェクト概要</TabsTrigger>
            <TabsTrigger value="organization">体制と関係者</TabsTrigger>
            <TabsTrigger value="personnel">要員・契約情報</TabsTrigger>
            <TabsTrigger value="progress">進捗・スケジュール</TabsTrigger>
            <TabsTrigger value="business">業務・システム内容</TabsTrigger>
            <TabsTrigger value="issues">課題・リスク</TabsTrigger>
            <TabsTrigger value="manager-meetings">マネ定議事録</TabsTrigger>
            <TabsTrigger value="cases">関連案件</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="border rounded-lg p-6">
            <h2 className="text-xl font-bold mb-4">プロジェクト概要</h2>
            <div className="whitespace-pre-wrap">
              {project.overview || "プロジェクト概要は設定されていません。"}
            </div>
          </TabsContent>

          <TabsContent value="organization" className="border rounded-lg p-6">
            <h2 className="text-xl font-bold mb-4">体制と関係者</h2>
            <div className="whitespace-pre-wrap">
              {project.organization || "体制と関係者情報は設定されていません。"}
            </div>
          </TabsContent>

          <TabsContent value="personnel" className="border rounded-lg p-6">
            <h2 className="text-xl font-bold mb-4">要員・契約情報</h2>
            <div className="whitespace-pre-wrap">
              {project.personnel || "要員・契約情報は設定されていません。"}
            </div>
          </TabsContent>

          <TabsContent value="progress" className="border rounded-lg p-6">
            <h2 className="text-xl font-bold mb-4">現状の進捗・スケジュール</h2>
            <div className="whitespace-pre-wrap">
              {project.progress || "進捗・スケジュール情報は設定されていません。"}
            </div>
          </TabsContent>

          <TabsContent value="business" className="border rounded-lg p-6">
            <h2 className="text-xl font-bold mb-4">業務・システム内容</h2>
            <div className="whitespace-pre-wrap">
              {project.businessDetails || "業務・システム内容は設定されていません。"}
            </div>
          </TabsContent>

          <TabsContent value="issues" className="border rounded-lg p-6">
            <h2 className="text-xl font-bold mb-4">課題・リスク・懸念点</h2>
            <div className="whitespace-pre-wrap">
              {project.issues || "課題・リスク情報は設定されていません。"}
            </div>

            <h2 className="text-xl font-bold mb-4 mt-8">ドキュメント・ナレッジ</h2>
            <div className="whitespace-pre-wrap">
              {project.documents || "ドキュメント・ナレッジ情報は設定されていません。"}
            </div>

            <h2 className="text-xl font-bold mb-4 mt-8">引き継ぎ時の優先確認事項</h2>
            <div className="whitespace-pre-wrap">
              {project.handoverNotes || "引き継ぎ時の優先確認事項は設定されていません。"}
            </div>

            <h2 className="text-xl font-bold mb-4 mt-8">その他特記事項</h2>
            <div className="whitespace-pre-wrap">
              {project.remarks || "特記事項は設定されていません。"}
            </div>
          </TabsContent>

          <TabsContent value="cases" className="border rounded-lg p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">{project.name}の関連案件</h2>
              <Button
                onClick={() => setLocation(`/case/new?projectName=${encodeURIComponent(project.name)}`)}
                variant="outline"
                className="flex items-center gap-2"
              >
                <Briefcase className="h-4 w-4" />
                新規案件作成
              </Button>
            </div>

            {isLoadingCases ? (
              <p className="text-center py-4">案件を読み込み中...</p>
            ) : cases && cases.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {cases
                  .filter(case_ => case_.projectName === project.name)
                  .map(case_ => (
                    <Card key={case_.id} className="overflow-hidden">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-lg font-bold line-clamp-2 break-all">
                          <Link 
                            href={`/case/view/${case_.id}?from=project&projectId=${project.id}&projectName=${encodeURIComponent(project.name)}`}
                            onClick={() => {
                              // 案件詳細ページに遷移する前に、個別の案件データを無効化して最新データを取得させる
                              import("@/lib/queryClient").then(({ queryClient }) => {
                                queryClient.invalidateQueries({ queryKey: [`/api/cases/${case_.id}`] });
                              });
                            }}
                          >
                            {case_.caseName}
                          </Link>
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="pb-3">
                        <div className="text-sm text-muted-foreground line-clamp-3">
                          {case_.description || "説明なし"}
                        </div>
                        <div className="mt-2 flex justify-end">
                          <Link href={`/reports?projectName=${encodeURIComponent(project.name)}&caseId=${case_.id}`}>
                            <Button variant="ghost" size="sm" className="flex items-center gap-1">
                              <FileText className="h-3.5 w-3.5" />
                              週次報告
                            </Button>
                          </Link>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
              </div>
            ) : (
              <p className="text-center py-4 text-muted-foreground">
                このプロジェクトに関連する案件はありません
              </p>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}