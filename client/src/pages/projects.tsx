import { Link, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { type Project } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb";
import { ThemeToggle } from "@/components/theme-toggle";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useState, useEffect } from "react";
import { Home, FolderKanban, Plus, ChevronRight, Edit, ExternalLink, RotateCcw } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { AdminOnly } from "@/lib/admin-only";
import { apiRequest } from "@/lib/queryClient";
import { useToast, toast } from "@/hooks/use-toast";

export default function ProjectList() {
  const [, setLocation] = useLocation();
  const [showDeleted, setShowDeleted] = useState(false);
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // プロジェクト一覧を取得
  const { data: projects, isLoading, refetch } = useQuery<Project[]>({
    queryKey: [`/api/projects${showDeleted ? '?includeDeleted=true' : ''}`],
    staleTime: 1000 * 60, // 1分間キャッシュ
  });

  // 表示切り替え時に強制リフレッシュ
  useEffect(() => {
    refetch();
  }, [showDeleted, refetch]);

  // プロジェクト復活のミューテーション
  const restoreMutation = useMutation({
    mutationFn: async (projectId: number) => {
      return apiRequest(`/api/projects/${projectId}/restore`, {
        method: "POST",
      });
    },
    onSuccess: () => {
      toast({
        title: "成功",
        description: "プロジェクトを復活しました",
        variant: "default",
      });
      // キャッシュを更新
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      queryClient.invalidateQueries({ queryKey: ["/api/projects?includeDeleted=true"] });
      
      // データを強制リフレッシュ
      setTimeout(() => {
        refetch();
      }, 300);
    },
    onError: (error) => {
      console.error("Error restoring project:", error);
      toast({
        title: "エラー",
        description: "プロジェクトの復活に失敗しました",
        variant: "destructive",
      });
    },
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-8">
          <p className="text-center">読み込み中...</p>
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
                <BreadcrumbPage>
                  <span className="flex items-center gap-1">
                    <FolderKanban className="h-3.5 w-3.5" />
                    プロジェクト一覧
                  </span>
                </BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
          <ThemeToggle />
        </div>

        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-semibold">プロジェクト一覧</h1>
          <ThemeToggle />
        </div>

        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Switch
              id="showDeleted"
              checked={showDeleted}
              onCheckedChange={setShowDeleted}
            />
            <Label htmlFor="showDeleted">削除済みプロジェクトを表示</Label>
          </div>
          
          <AdminOnly>
            <Button onClick={() => setLocation('/project/new')} className="flex items-center gap-2">
              <Plus className="h-4 w-4" /> 新規プロジェクト
            </Button>
          </AdminOnly>
        </div>

        {projects && projects.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {projects.map((project) => (
              <Card 
                key={project.id} 
                className={`
                  overflow-hidden transition-all duration-300 hover:shadow-md
                  ${project.isDeleted ? 'opacity-60 border-dashed' : ''}
                `}
              >
                <CardHeader className="pb-3">
                  <div className="flex justify-between items-start">
                    <CardTitle className="text-lg font-bold line-clamp-2 break-all">
                      {project.name}
                    </CardTitle>
                    <AdminOnly>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={(e) => {
                          e.preventDefault();
                          setLocation(`/project/edit/${project.id}`);
                        }}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                    </AdminOnly>
                  </div>
                </CardHeader>
                <CardContent className="pb-3">
                  <div className="space-y-3">
                    <div>
                      <h4 className="text-sm font-semibold mb-1">プロジェクト概要</h4>
                      <p className="text-sm text-muted-foreground line-clamp-3">
                        {project.overview || "未設定"}
                      </p>
                    </div>
                  </div>
                </CardContent>
                <CardFooter className="pt-0 flex flex-col gap-2">
                  {project.isDeleted ? (
                    <>
                      {/* 管理者権限デバッグ表示 */}
                      <div className="text-xs text-gray-500 mb-2">
                        管理者: {user?.isAdmin ? "はい" : "いいえ"}
                      </div>
                      <AdminOnly>
                        <Button 
                          variant="outline" 
                          className="w-full flex items-center justify-center gap-1 mb-2"
                          onClick={() => restoreMutation.mutate(project.id)}
                          disabled={restoreMutation.isPending}
                        >
                          <RotateCcw className="h-3.5 w-3.5 mr-1" />
                          プロジェクトを復活 (AdminOnly)
                        </Button>
                      </AdminOnly>
                      {/* 直接テスト用のボタン */}
                      <Button 
                        variant="outline" 
                        className="w-full flex items-center justify-center gap-1 bg-yellow-100 dark:bg-yellow-900"
                        onClick={() => restoreMutation.mutate(project.id)}
                        disabled={restoreMutation.isPending}
                      >
                        <RotateCcw className="h-3.5 w-3.5 mr-1" />
                        プロジェクトを復活 (直接テスト)
                      </Button>
                    </>
                  ) : (
                    <Link href={`/project/${project.id}`} className="w-full">
                      <Button variant="default" className="w-full flex items-center justify-center gap-1">
                        詳細を見る <ChevronRight className="h-3 w-3" />
                      </Button>
                    </Link>
                  )}
                </CardFooter>
              </Card>
            ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <p className="text-lg text-muted-foreground mb-4">プロジェクトがありません</p>
            <AdminOnly>
              <Button onClick={() => setLocation('/project/new')}>
                新規プロジェクトを作成
              </Button>
            </AdminOnly>
          </div>
        )}
      </div>
    </div>
  );
}