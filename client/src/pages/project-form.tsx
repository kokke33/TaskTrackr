import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useParams, useLocation, Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { insertProjectSchema, type Project, type InsertProject } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb";
import { ThemeToggle } from "@/components/theme-toggle";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Home, FolderKanban, Loader2, ShieldAlert } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/lib/auth";

// Zodスキーマを拡張
const projectFormSchema = insertProjectSchema.extend({});

type ProjectFormData = z.infer<typeof projectFormSchema>;

export default function ProjectForm() {
  const params = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const isEditing = !!params.id;
  const projectId = isEditing ? parseInt(params.id) : null;

  // 管理者権限チェック
  useEffect(() => {
    // ユーザー情報がロードされた後に管理者権限をチェック
    if (user && !user.isAdmin) {
      toast({
        title: "権限エラー",
        description: "プロジェクト管理は管理者のみが行えます",
        variant: "destructive",
      });
      setLocation("/projects");
    }
  }, [user, setLocation, toast]);

  // プロジェクト詳細を取得（編集時のみ）
  const { data: project, isLoading: isLoadingProject, error } = useQuery<Project>({
    queryKey: [`/api/projects/${projectId}`],
    enabled: isEditing,
    queryFn: async ({ queryKey }) => {
      return await apiRequest<Project>(`${queryKey[0]}?edit=true`, { method: "GET" });
    }
  });

  // フォーム設定
  const form = useForm<ProjectFormData>({
    resolver: zodResolver(projectFormSchema),
    defaultValues: {
      name: "",
      overview: "",
      organization: "",
      personnel: "",
      progress: "",
      businessDetails: "",
      issues: "",
      documents: "",
      handoverNotes: "",
      remarks: "",
      isDeleted: false,
    },
  });

  // 編集時にデータをフォームに設定
  useEffect(() => {
    if (project) {
      form.reset({
        name: project.name,
        overview: project.overview ?? "",
        organization: project.organization ?? "",
        personnel: project.personnel ?? "",
        progress: project.progress ?? "",
        businessDetails: project.businessDetails ?? "",
        issues: project.issues ?? "",
        documents: project.documents ?? "",
        handoverNotes: project.handoverNotes ?? "",
        remarks: project.remarks ?? "",
        isDeleted: project.isDeleted,
      });
    }
  }, [project, form]);

  // プロジェクト作成ミューテーション
  const createMutation = useMutation({
    mutationFn: async (data: InsertProject) => {
      return apiRequest("/api/projects", {
        method: "POST",
        data: data,
      });
    },
    onSuccess: () => {
      toast({
        title: "プロジェクトを作成しました",
        description: "プロジェクトの作成が完了しました",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      setLocation("/projects");
    },
    onError: (error: Error) => {
      toast({
        title: "エラーが発生しました",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // プロジェクト更新ミューテーション
  const updateMutation = useMutation({
    mutationFn: async (data: InsertProject) => {
      return apiRequest(`/api/projects/${projectId}`, {
        method: "PUT",
        data: data,
      });
    },
    onSuccess: () => {
      toast({
        title: "プロジェクトを更新しました",
        description: "プロジェクトの更新が完了しました",
      });
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}`] });
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      setLocation(`/project/${projectId}`);
    },
    onError: (error: Error) => {
      toast({
        title: "エラーが発生しました",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // フォーム送信ハンドラ
  const onSubmit = async (data: ProjectFormData) => {
    if (isEditing) {
      updateMutation.mutate(data);
    } else {
      createMutation.mutate(data);
    }
  };

  // 削除ミューテーション
  const deleteMutation = useMutation({
    mutationFn: async () => {
      return apiRequest(`/api/projects/${projectId}`, {
        method: "DELETE",
      });
    },
    onSuccess: () => {
      toast({
        title: "プロジェクトを削除しました",
        description: "プロジェクトの削除が完了しました",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      setLocation("/projects");
    },
    onError: (error: Error) => {
      toast({
        title: "エラーが発生しました",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // 削除確認
  const handleDelete = () => {
    if (window.confirm("このプロジェクトを削除してもよろしいですか？")) {
      deleteMutation.mutate();
    }
  };

  // エラー発生時の表示
  if (error) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-8">
          <div className="text-center">
            <ShieldAlert className="mx-auto h-12 w-12 text-destructive mb-4" />
            <h2 className="text-xl font-bold mb-2">アクセスエラー</h2>
            <p className="mb-6">{error instanceof Error ? error.message : "プロジェクト情報の取得に失敗しました"}</p>
            <Button onClick={() => setLocation("/projects")}>
              プロジェクト一覧へ戻る
            </Button>
          </div>
        </div>
      </div>
    );
  }
  
  // 読み込み中の表示
  if (isEditing && isLoadingProject) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-8">
          <p className="text-center">読み込み中...</p>
        </div>
      </div>
    );
  }

  const isPending = createMutation.isPending || updateMutation.isPending || deleteMutation.isPending;

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-3xl">
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
                  {isEditing ? "プロジェクト編集" : "新規プロジェクト"}
                </BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
          <ThemeToggle />
        </div>

        <header className="mb-6">
          <h1 className="text-2xl font-bold">
            {isEditing ? "プロジェクト編集" : "新規プロジェクト作成"}
          </h1>
        </header>

        <Card>
          <CardContent className="p-6">
            <Form {...form}>
              <form
                onSubmit={form.handleSubmit(onSubmit)}
                className="space-y-6"
              >
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="required">プロジェクト名</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="例: PNEC_財務システム刷新"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Tabs defaultValue="basic" className="w-full">
                  <TabsList className="mb-4">
                    <TabsTrigger value="basic">基本情報</TabsTrigger>
                    <TabsTrigger value="resources">体制・要員</TabsTrigger>
                    <TabsTrigger value="progress">進捗・業務</TabsTrigger>
                    <TabsTrigger value="issues">課題・ドキュメント</TabsTrigger>
                  </TabsList>

                  <TabsContent value="basic" className="space-y-4">
                    <FormField
                      control={form.control}
                      name="overview"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>プロジェクト概要</FormLabel>
                          <FormControl>
                            <Textarea
                              placeholder="プロジェクトの目的、背景、範囲などを記載してください"
                              className="min-h-32"
                              {...field}
                              value={field.value ?? ""}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </TabsContent>

                  <TabsContent value="resources" className="space-y-4">
                    <FormField
                      control={form.control}
                      name="organization"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>体制と関係者</FormLabel>
                          <FormControl>
                            <Textarea
                              placeholder="プロジェクト体制や主要関係者を記載してください"
                              className="min-h-32"
                              {...field}
                              value={field.value ?? ""}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="personnel"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>要員・契約情報</FormLabel>
                          <FormControl>
                            <Textarea
                              placeholder="要員計画や契約に関する情報を記載してください"
                              className="min-h-32"
                              {...field}
                              value={field.value ?? ""}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </TabsContent>

                  <TabsContent value="progress" className="space-y-4">
                    <FormField
                      control={form.control}
                      name="progress"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>現状の進捗・スケジュール</FormLabel>
                          <FormControl>
                            <Textarea
                              placeholder="現在の進捗状況やスケジュール情報を記載してください"
                              className="min-h-32"
                              {...field}
                              value={field.value ?? ""}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="businessDetails"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>業務・システム内容</FormLabel>
                          <FormControl>
                            <Textarea
                              placeholder="業務内容やシステムの詳細を記載してください"
                              className="min-h-32"
                              {...field}
                              value={field.value ?? ""}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </TabsContent>

                  <TabsContent value="issues" className="space-y-4">
                    <FormField
                      control={form.control}
                      name="issues"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>課題・リスク・懸念点</FormLabel>
                          <FormControl>
                            <Textarea
                              placeholder="現在の課題やリスク、懸念点を記載してください"
                              className="min-h-32"
                              {...field}
                              value={field.value ?? ""}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="documents"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>ドキュメント・ナレッジ</FormLabel>
                          <FormControl>
                            <Textarea
                              placeholder="関連するドキュメントやナレッジ情報を記載してください"
                              className="min-h-32"
                              {...field}
                              value={field.value ?? ""}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="handoverNotes"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>引き継ぎ時の優先確認事項</FormLabel>
                          <FormControl>
                            <Textarea
                              placeholder="引き継ぎ時に確認すべき重要事項を記載してください"
                              className="min-h-32"
                              {...field}
                              value={field.value ?? ""}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="remarks"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>その他特記事項</FormLabel>
                          <FormControl>
                            <Textarea
                              placeholder="その他、特記すべき事項があれば記載してください"
                              className="min-h-32"
                              {...field}
                              value={field.value ?? ""}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </TabsContent>
                </Tabs>

                <div className="flex justify-between pt-6">
                  <div>
                    {isEditing && (
                      <Button
                        type="button"
                        variant="destructive"
                        onClick={handleDelete}
                        disabled={isPending}
                      >
                        削除
                      </Button>
                    )}
                  </div>
                  <div className="flex space-x-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => isEditing ? setLocation(`/project/${projectId}`) : setLocation('/projects')}
                      disabled={isPending}
                    >
                      キャンセル
                    </Button>
                    <Button type="submit" disabled={isPending}>
                      {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      {isEditing ? "更新" : "作成"}
                    </Button>
                  </div>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
