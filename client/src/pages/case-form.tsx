import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertCaseSchema, type InsertCase, type Case, type Project } from "@shared/schema";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useLocation, Link, useParams } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useEffect } from "react";

export default function CaseForm() {
  const { id } = useParams<{ id: string }>();
  const isEditMode = !!id;
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  // プロジェクト一覧を取得
  const { data: projects, isLoading: isLoadingProjects } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
    staleTime: 0, // 毎回最新のデータを取得
  });

  const { data: existingCase, isLoading: isLoadingCase } = useQuery<Case>({
    queryKey: [`/api/cases/${id}`],
    enabled: isEditMode,
    staleTime: 0, // 毎回最新のデータを取得
    refetchOnMount: true, // コンポーネントマウント時に必ず再取得
  });

  const form = useForm<InsertCase>({
    resolver: zodResolver(insertCaseSchema),
    defaultValues: {
      projectName: "",
      caseName: "",
      description: "",
      isDeleted: false,
    },
  });

  // existingCaseが変更されたときにフォームを更新
  useEffect(() => {
    if (existingCase && 'projectName' in existingCase && 'caseName' in existingCase) {
      form.reset({
        projectName: existingCase.projectName,
        caseName: existingCase.caseName,
        description: existingCase.description || "",
        isDeleted: existingCase.isDeleted || false,
      });
    }
  }, [existingCase, form]);

  const mutation = useMutation({
    mutationFn: async (data: InsertCase) => {
      const endpoint = isEditMode ? `/api/cases/${id}` : "/api/cases";
      const method = isEditMode ? "PUT" : "POST";
      return apiRequest(endpoint, { method, data });
    },
    onSuccess: () => {
      toast({
        title: isEditMode ? "案件が更新されました" : "案件が作成されました",
        description: "案件情報が正常に保存されました。",
      });
      // 個別の案件キャッシュも無効化
      if (isEditMode && id) {
        queryClient.invalidateQueries({ queryKey: [`/api/cases/${id}`] });
      }
      // 一覧キャッシュを無効化
      queryClient.invalidateQueries({ queryKey: ["/api/cases"] });
      setLocation("/cases");
    },
    onError: (error) => {
      console.error("Error submitting case:", error);
      toast({
        title: "エラー",
        description: isEditMode
          ? "案件の更新に失敗しました。"
          : "案件の作成に失敗しました。",
        variant: "destructive",
      });
    },
  });

  const onSubmit = async (data: InsertCase) => {
    mutation.mutate(data);
  };

  if ((isEditMode && isLoadingCase) || isLoadingProjects) {
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
      <div className="container mx-auto px-4 py-8 max-w-2xl">
        <header className="mb-8">
          <div className="flex justify-between items-center">
            <h1 className="text-2xl font-semibold">
              {isEditMode ? "案件編集" : "新規案件作成"}
            </h1>
            <Link href="/cases">
              <Button variant="outline">一覧に戻る</Button>
            </Link>
          </div>
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
                  name="projectName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="required">プロジェクト名</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="プロジェクトを選択" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {projects?.filter(project => !project.isDeleted).map(project => (
                            <SelectItem key={project.id} value={project.name}>
                              {project.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormDescription>
                        既存のプロジェクトから選択してください
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="caseName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="required">案件名</FormLabel>
                      <FormControl>
                        <Input placeholder="例: 事案メール対応" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>説明</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="案件の説明を入力してください"
                          className="h-32"
                          {...field}
                          value={field.value || ""}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {isEditMode && (
                  <FormField
                    control={form.control}
                    name="isDeleted"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                        <div className="space-y-1 leading-none">
                          <FormLabel>削除フラグ</FormLabel>
                          <FormDescription>
                            この案件を削除対象としてマークします。削除フラグが付いた案件は週次報告一覧に表示されなくなります。
                          </FormDescription>
                        </div>
                      </FormItem>
                    )}
                  />
                )}

                <div className="flex justify-end">
                  <Button
                    type="submit"
                    disabled={mutation.isPending}
                    className="w-full sm:w-auto"
                  >
                    {mutation.isPending
                      ? "送信中..."
                      : isEditMode
                        ? "更新する"
                        : "作成する"}
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
