import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertCaseSchema, type InsertCase, type Case } from "@shared/schema";
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

  const { data: existingCase, isLoading: isLoadingCase } = useQuery<Case>({
    queryKey: [`/api/cases/${id}`],
    enabled: isEditMode,
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

  if (isEditMode && isLoadingCase) {
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
                      <FormControl>
                        <div className="relative">
                          <Input
                            list="project-options"
                            placeholder="選択または入力してください"
                            {...field}
                          />
                          <datalist id="project-options">
                            <option value="PNEC_SMSK_保守">PNEC_SMSK_共同損サ_保守</option>
                            <option value="PNEC_SMSK_Stage3">PNEC_SMSK_共同損サ_Stage3</option>
                            <option value="PNEC_SMSK_基盤">PNEC_SMSK_共同損サ_基盤</option>
                            <option value="PNEC_SMSK_性能">PNEC_SMSK_共同損サ_性能</option>
                            <option value="INSL_SNSK">INSL_SNSK新種</option>
                            <option value="ITCS_SAIG">ITCS_SAIG_基幹系保守</option>
                            <option value="VACC_SSJN">VACC_SSJN_未来革新Ⅲ期契約管理</option>
                            <option value="IIBM_FWAM">IIBM_FWAM退職共済</option>
                            <option value="SAMPLE_PRJ">サンプルプロジェクト</option>
                          </datalist>
                        </div>
                      </FormControl>
                      <FormDescription>
                        既存のプロジェクトから選択するか、新しいプロジェクト名を入力してください
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
