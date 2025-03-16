import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertCaseSchema, type InsertCase } from "@shared/schema";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { useLocation, Link, useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";

export default function CaseForm() {
  const { id } = useParams<{ id: string }>();
  const isEditMode = !!id;

  const { data: existingCase, isLoading: isLoadingCase } = useQuery({
    queryKey: [`/api/cases/${id}`],
    enabled: isEditMode,
  });

  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<InsertCase>({
    resolver: zodResolver(insertCaseSchema),
    defaultValues: {
      projectName: "",
      caseName: "",
      description: "",
    },
  });

  const onSubmit = async (data: InsertCase) => {
    if (isSubmitting) return;

    try {
      setIsSubmitting(true);
      const url = isEditMode ? `/api/cases/${id}` : "/api/cases";
      const method = isEditMode ? "PUT" : "POST";

      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        throw new Error("送信に失敗しました");
      }

      await response.json();

      toast({
        title: isEditMode ? "案件が更新されました" : "案件が作成されました",
        description: "案件情報が正常に保存されました。",
      });

      setLocation("/cases");
    } catch (error) {
      console.error("Error submitting case:", error);
      toast({
        title: "エラー",
        description: isEditMode ? "案件の更新に失敗しました。" : "案件の作成に失敗しました。",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
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
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
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
                            <SelectValue placeholder="選択してください" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="PNEC_SMSK_保守">
                            PNEC_SMSK_共同損サ_保守
                          </SelectItem>
                          <SelectItem value="PNEC_SMSK_Stage3">
                            PNEC_SMSK_共同損サ_Stage3
                          </SelectItem>
                          <SelectItem value="PNEC_SMSK_基盤">
                            PNEC_SMSK_共同損サ_基盤
                          </SelectItem>
                          <SelectItem value="PNEC_SMSK_性能">
                            PNEC_SMSK_共同損サ_性能
                          </SelectItem>
                          <SelectItem value="INSL_SNSK">
                            INSL_SNSK新種
                          </SelectItem>
                          <SelectItem value="ITCS_SAIG">
                            ITCS_SAIG_基幹系保守
                          </SelectItem>
                          <SelectItem value="VACC_SSJN">
                            VACC_SSJN_未来革新Ⅲ期契約管理
                          </SelectItem>
                          <SelectItem value="IIBM_FWAM">
                            IIBM_FWAM退職共済
                          </SelectItem>
                        </SelectContent>
                      </Select>
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
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex justify-end">
                  <Button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full sm:w-auto"
                  >
                    {isSubmitting
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