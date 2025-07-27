import { Link, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { type Project } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb";
import { ThemeToggle } from "@/components/theme-toggle";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useState, useEffect } from "react";
import { Home, FolderKanban, Plus, Edit, ExternalLink, RotateCcw, Search, Filter, Building2, FolderOpen } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { AdminOnly } from "@/lib/admin-only";
import { apiRequest } from "@/lib/queryClient";
import { toast } from "@/hooks/use-toast";
import { useListPerformance } from "@/hooks/use-performance";

export default function ProjectList() {
  const [, setLocation] = useLocation();
  const [showDeleted, setShowDeleted] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("all");
  const [showFilters, setShowFilters] = useState(false);
  useAuth();
  const queryClient = useQueryClient();
  
  // パフォーマンス監視
  const { measureOperation, measureRender } = useListPerformance('ProjectList', 0);

  // プロジェクト一覧を取得
  const { data: projects, isLoading, refetch } = useQuery<Project[]>({
    queryKey: [`/api/projects${showDeleted ? '?includeDeleted=true' : ''}`],
    staleTime: 5 * 60 * 1000, // 5分間キャッシュ（プロジェクト情報は変更頻度が低い）
  });

  // 表示切り替え時に強制リフレッシュ
  useEffect(() => {
    refetch();
  }, [showDeleted, refetch]);

  // 検索でフィルタリングされたプロジェクト
  const filteredProjects = projects?.filter(project => {
    // 削除済みフィルター
    if (!showDeleted && project.isDeleted) return false;
    
    // 検索クエリでフィルタリング
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const matches = project.name.toLowerCase().includes(query) ||
        (project.overview && project.overview.toLowerCase().includes(query));
      if (!matches) return false;
    }
    
    return true;
  }) ?? [];

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
      <div className="container mx-auto px-4 py-8 max-w-5xl">
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

        {/* 検索バーとフィルター */}
        <div className="space-y-4 mb-6">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                placeholder="プロジェクト名または概要で検索..."
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
          
          {/* 削除済みプロジェクト表示切り替え */}
          <div className="flex items-center gap-3">
            <Switch
              id="showDeleted"
              checked={showDeleted}
              onCheckedChange={setShowDeleted}
            />
            <Label htmlFor="showDeleted">削除済みプロジェクトを表示</Label>
          </div>
          
          {/* フィルターオプション */}
          {showFilters && (
            <div className="flex gap-4 p-3 bg-gray-50 rounded-lg">
              <div className="flex items-end">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSearchQuery("");
                  }}
                >
                  検索クリア
                </Button>
              </div>
            </div>
          )}
          
          <div className="flex justify-between items-center">
            <div className="text-sm text-gray-500">
              {filteredProjects.length}件のプロジェクトが見つかりました
            </div>
            <AdminOnly>
              <Button onClick={() => setLocation('/project/new')} className="flex items-center gap-2">
                <Plus className="h-4 w-4" /> 新規プロジェクト
              </Button>
            </AdminOnly>
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center items-center h-64">
            <div className="text-center">読み込み中...</div>
          </div>
        ) : (
          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
            <TabsList className="grid w-full grid-cols-1">
              <TabsTrigger value="all">
                <FolderOpen className="h-4 w-4 mr-2" />
                全てのプロジェクト
              </TabsTrigger>
            </TabsList>

            {/* 全てのプロジェクト表示 */}
            <TabsContent value="all" className="flex-1 mt-4">
              {filteredProjects.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>プロジェクト名</TableHead>
                        <TableHead>概要</TableHead>
                        <TableHead>ステータス</TableHead>
                        <TableHead className="text-right">操作</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredProjects.map((project) => (
                        <TableRow 
                          key={project.id}
                          className={`${
                            project.isDeleted ? 'opacity-60 bg-gray-50/50' : 'hover:bg-muted/50'
                          }`}
                        >
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-2">
                              <Building2 className="h-4 w-4 text-muted-foreground" />
                              <span className="font-semibold">{project.name}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <p className="text-sm text-muted-foreground max-w-md truncate">
                              {project.overview || "未設定"}
                            </p>
                          </TableCell>
                          <TableCell>
                            {project.isDeleted ? (
                              <Badge variant="destructive">削除済み</Badge>
                            ) : (
                              <Badge variant="default">有効</Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              {project.isDeleted ? (
                                <>
                                  <AdminOnly>
                                    <Button 
                                      variant="outline" 
                                      size="sm"
                                      onClick={() => restoreMutation.mutate(project.id)}
                                      disabled={restoreMutation.isPending}
                                      className="flex items-center gap-1"
                                    >
                                      <RotateCcw className="h-3.5 w-3.5" />
                                      復活
                                    </Button>
                                  </AdminOnly>
                                  {/* 直接テスト用のボタン */}
                                  <Button 
                                    variant="outline" 
                                    size="sm"
                                    onClick={() => restoreMutation.mutate(project.id)}
                                    disabled={restoreMutation.isPending}
                                    className="flex items-center gap-1 bg-yellow-100 dark:bg-yellow-900"
                                  >
                                    <RotateCcw className="h-3.5 w-3.5" />
                                    復活(テスト)
                                  </Button>
                                </>
                              ) : (
                                <>
                                  <Link href={`/project/${project.id}`}>
                                    <Button variant="default" size="sm" className="flex items-center gap-1">
                                      <ExternalLink className="h-3.5 w-3.5" />
                                      詳細
                                    </Button>
                                  </Link>
                                  <AdminOnly>
                                    <Button 
                                      variant="outline" 
                                      size="sm"
                                      onClick={(e) => {
                                        e.preventDefault();
                                        setLocation(`/project/edit/${project.id}`);
                                      }}
                                    >
                                      <Edit className="h-3.5 w-3.5" />
                                    </Button>
                                  </AdminOnly>
                                </>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="text-center py-8">
                    <p className="text-lg text-muted-foreground mb-4">
                      {searchQuery ? "検索条件に一致するプロジェクトがありません" : "プロジェクトがありません"}
                    </p>
                    <AdminOnly>
                      <Button onClick={() => setLocation('/project/new')}>
                        新規プロジェクトを作成
                      </Button>
                    </AdminOnly>
                  </div>
                )}
            </TabsContent>
          </Tabs>
        )}
      </div>
    </div>
  );
}