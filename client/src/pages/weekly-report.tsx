import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertWeeklyReportSchema, type WeeklyReport, type Case } from "@shared/schema";
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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect } from "react";
import { useLocation, Link, useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Send, Plus } from "lucide-react";

export default function WeeklyReport() {
  const { id } = useParams<{ id: string }>();
  const isEditMode = !!id;

  const { data: existingReport, isLoading: isLoadingReport } = useQuery<WeeklyReport>({
    queryKey: [`/api/weekly-reports/${id}`],
    enabled: isEditMode,
  });

  // 案件一覧を取得
  const { data: cases, isLoading: isLoadingCases } = useQuery<Case[]>({
    queryKey: ["/api/cases"],
    staleTime: 0,
  });

  const { toast } = useToast();
  const [selectedCaseId, setSelectedCaseId] = useState<number | null>(null);
  const [, setLocation] = useLocation();
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 選択された案件の最新の報告を取得
  const { data: latestReport, isLoading: isLoadingLatest } = useQuery<WeeklyReport>({
    queryKey: [`/api/weekly-reports/latest/${selectedCaseId}`],
    enabled: !!selectedCaseId,
  });

  const form = useForm<WeeklyReport>({
    resolver: zodResolver(insertWeeklyReportSchema),
    defaultValues: {
      caseId: 0,
      progressRate: 0,
      delayIssues: "no",
      newRisks: "no",
      qualityConcerns: "none",
      changes: "no",
      resourceConcerns: "none",
      customerIssues: "none",
      environmentIssues: "none",
      costIssues: "none",
      knowledgeIssues: "none",
      trainingIssues: "none",
      urgentIssues: "none",
      businessOpportunities: "none",
      reportPeriodStart: "",
      reportPeriodEnd: "",
      reporterName: "",
      weeklyTasks: "",
      progressStatus: "",
      issues: "",
      nextWeekPlan: "",
      supportRequests: "",
      delayDetails: "",
      riskSummary: "",
      riskCountermeasures: "",
      riskLevel: "",
      qualityDetails: "",
      testProgress: "",
      changeDetails: "",
      resourceDetails: "",
      customerDetails: "",
      environmentDetails: "",
      costDetails: "",
      knowledgeDetails: "",
      trainingDetails: "",
      urgentDetails: "",
      businessDetails: "",
    },
  });

  useEffect(() => {
    if (isEditMode && existingReport) {
      Object.entries(existingReport).forEach(([key, value]) => {
        form.setValue(key as keyof WeeklyReport, value || "");
      });
      setSelectedCaseId(existingReport.caseId);
    }
  }, [existingReport, form, isEditMode]);

  const onSubmit = async (data: WeeklyReport) => {
    if (isSubmitting) return;

    try {
      setIsSubmitting(true);
      const url = isEditMode ? `/api/weekly-reports/${id}` : "/api/weekly-reports";
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

      const result = await response.json();

      toast({
        title: isEditMode ? "報告が更新されました" : "報告が送信されました",
        description: isEditMode
          ? "週次報告が正常に更新されました。"
          : "週次報告が正常に送信されました。",
      });

      if (result.aiAnalysis) {
        toast({
          title: "AI分析結果が更新されました",
          description: (
            <div className="whitespace-pre-wrap text-sm">
              {result.aiAnalysis}
            </div>
          ),
          duration: null,
        });
      }

      setLocation(`/reports/${result.id}`);
    } catch (error) {
      console.error("Error submitting report:", error);
      toast({
        title: "エラー",
        description: isEditMode
          ? "週次報告の更新に失敗しました。"
          : "週次報告の送信に失敗しました。",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const copyFromLastReport = async () => {
    if (!selectedCaseId || !latestReport) {
      return;
    }

    // 前回の報告から値をコピー
    const fieldsToExclude = ["id", "createdAt", "reportPeriodStart", "reportPeriodEnd"];
    Object.entries(latestReport).forEach(([key, value]) => {
      if (!fieldsToExclude.includes(key)) {
        form.setValue(key as keyof WeeklyReport, value || "");
      }
    });

    // 現在の日付に基づいて報告期間を設定
    const today = new Date();
    const dayOfWeek = today.getDay();
    const monday = new Date(today);
    monday.setDate(today.getDate() - dayOfWeek + 1);
    const friday = new Date(monday);
    friday.setDate(monday.getDate() + 4);

    form.setValue("reportPeriodStart", monday.toISOString().split("T")[0]);
    form.setValue("reportPeriodEnd", friday.toISOString().split("T")[0]);

    toast({
      title: "前回の報告をコピーしました",
      description: "報告内容を確認・編集してください。",
    });
  };

  if ((isEditMode && isLoadingReport) || isLoadingCases) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-8">
          <p className="text-center">読み込み中...</p>
        </div>
      </div>
    );
  }

  // 案件をプロジェクトごとにグループ化
  const groupedCases = cases?.reduce((acc, currentCase) => {
    const projectName = currentCase.projectName;
    if (!acc[projectName]) {
      acc[projectName] = [];
    }
    acc[projectName].push(currentCase);
    return acc;
  }, {} as Record<string, Case[]>) ?? {};

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4">
          <div className="flex h-14 items-center justify-between">
            <h1 className="text-xl font-semibold">
              {isEditMode ? "週次報告編集" : "週次報告フォーム"}
            </h1>
            <Link href="/reports">
              <Button variant="ghost" size="sm">
                戻る
              </Button>
            </Link>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
            {/* 基本情報 */}
            <div className="p-6 bg-card rounded-lg shadow-sm">
              <header className="mb-8">
                <div className="flex flex-col gap-4 mb-2">
                  <h1 className="text-xl font-semibold">
                    {isEditMode ? "週次報告編集" : "週次報告フォーム"}
                  </h1>
                  {selectedCaseId && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={copyFromLastReport}
                      className="w-fit"
                    >
                      前回の報告をコピー
                    </Button>
                  )}
                </div>
              </header>

              <div className="space-y-4">
                <FormField
                  control={form.control}
                  name="reportPeriodStart"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="required">報告期間</FormLabel>
                      <div className="flex gap-2 items-center">
                        <FormControl>
                          <Input
                            type="date"
                            {...field}
                            onChange={(e) => {
                              field.onChange(e);
                              const date = new Date(e.target.value);
                              const endDate = new Date(date);
                              endDate.setDate(date.getDate() + 7);
                              form.setValue(
                                "reportPeriodEnd",
                                endDate.toISOString().split("T")[0],
                              );
                            }}
                          />
                        </FormControl>
                        <span>～</span>
                        <FormControl>
                          <Input
                            type="date"
                            {...form.register("reportPeriodEnd")}
                            disabled
                          />
                        </FormControl>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="caseId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="required">案件</FormLabel>
                      <div className="flex items-center gap-2">
                        <Select
                          onValueChange={(value) => {
                            const caseId = parseInt(value);
                            field.onChange(caseId);
                            setSelectedCaseId(caseId);
                          }}
                          value={field.value?.toString()}
                        >
                          <FormControl>
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder="選択してください" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {Object.entries(groupedCases).map(([projectName, projectCases]) => (
                              <div key={projectName}>
                                <div className="px-2 py-1.5 text-sm font-semibold text-muted-foreground">
                                  {projectName}
                                </div>
                                {projectCases.map((case_) => (
                                  <SelectItem key={case_.id} value={case_.id.toString()}>
                                    {case_.caseName}
                                  </SelectItem>
                                ))}
                              </div>
                            ))}
                          </SelectContent>
                        </Select>
                        <Link href="/case/new">
                          <Button variant="outline" size="icon" type="button">
                            <Plus className="h-4 w-4" />
                          </Button>
                        </Link>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="reporterName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="required">報告者氏名</FormLabel>
                      <FormControl>
                        <Input placeholder="例: 山田太郎" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* 今週の作業内容 */}
            <div className="p-6 bg-card rounded-lg shadow-sm">
              <h2 className="text-xl font-semibold mb-4 pb-2 border-b">
                2. 今週の作業内容
              </h2>

              <FormField
                control={form.control}
                name="weeklyTasks"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="required">今週の作業内容</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="作業項目、計画との差異、遅延理由、リスク評価などを記述してください"
                        className="h-32"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* 進捗状況 */}
            <div className="p-6 bg-card rounded-lg shadow-sm">
              <h2 className="text-xl font-semibold mb-4 pb-2 border-b">
                3. 進捗状況
              </h2>

              <div className="space-y-4">
                <FormField
                  control={form.control}
                  name="progressRate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="required">
                        進捗率 (0～100%)
                      </FormLabel>
                      <div className="flex items-center gap-4">
                        <FormControl>
                          <Input
                            type="range"
                            min="0"
                            max="100"
                            className="w-full"
                            {...field}
                            onChange={(e) =>
                              field.onChange(parseInt(e.target.value))
                            }
                          />
                        </FormControl>
                        <FormControl>
                          <Input
                            type="number"
                            min="0"
                            max="100"
                            className="w-20"
                            {...field}
                            onChange={(e) =>
                              field.onChange(parseInt(e.target.value))
                            }
                          />
                        </FormControl>
                        <span>%</span>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="progressStatus"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="required">
                        計画比の進捗状況
                      </FormLabel>
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
                          <SelectItem value="on-schedule">予定通り</SelectItem>
                          <SelectItem value="slightly-delayed">
                            少し遅れている
                          </SelectItem>
                          <SelectItem value="severely-delayed">
                            大幅に遅れている
                          </SelectItem>
                          <SelectItem value="ahead">前倒しで進行中</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="delayIssues"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="required">
                        進捗遅延・問題点の有無
                      </FormLabel>
                      <FormControl>
                        <RadioGroup
                          onValueChange={field.onChange}
                          defaultValue={field.value}
                          className="flex gap-4"
                        >
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="yes" id="delay-yes" />
                            <label htmlFor="delay-yes">あり</label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="no" id="delay-no" />
                            <label htmlFor="delay-no">なし</label>
                          </div>
                        </RadioGroup>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {form.watch("delayIssues") === "yes" && (
                  <FormField
                    control={form.control}
                    name="delayDetails"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="required">
                          遅延・問題点の詳細
                        </FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="遅延や問題の詳細、原因、影響範囲などを記述してください"
                            className="h-24"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
              </div>
            </div>

            {/* 課題・問題点 */}
            <div className="p-6 bg-card rounded-lg shadow-sm">
              <h2 className="text-xl font-semibold mb-4 pb-2 border-b">
                4. 課題・問題点
              </h2>
              <FormField
                control={form.control}
                name="issues"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="required">課題・問題点</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="現在直面している課題や問題点を記述してください"
                        className="h-24"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* 新たなリスク */}
            <div className="p-6 bg-card rounded-lg shadow-sm">
              <h2 className="text-xl font-semibold mb-4 pb-2 border-b">
                5. 新たなリスク
              </h2>
              <div className="space-y-4">
                <FormField
                  control={form.control}
                  name="newRisks"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="required">
                        新たなリスクの有無
                      </FormLabel>
                      <FormControl>
                        <RadioGroup
                          onValueChange={field.onChange}
                          defaultValue={field.value}
                          className="flex gap-4"
                        >
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="yes" id="risk-yes" />
                            <label htmlFor="risk-yes">あり</label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="no" id="risk-no" />
                            <label htmlFor="risk-no">なし</label>
                          </div>
                        </RadioGroup>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {form.watch("newRisks") === "yes" && (
                  <>
                    <FormField
                      control={form.control}
                      name="riskSummary"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="required">
                            リスクの概要
                          </FormLabel>
                          <FormControl>
                            <Textarea
                              placeholder="新たに発見されたリスクの概要を記述してください"
                              className="h-24"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="riskCountermeasures"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="required">対策</FormLabel>
                          <FormControl>
                            <Textarea
                              placeholder="リスクに対する対策を記述してください"
                              className="h-24"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="riskLevel"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="required">
                            リスクレベル
                          </FormLabel>
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
                              <SelectItem value="high">高</SelectItem>
                              <SelectItem value="medium">中</SelectItem>
                              <SelectItem value="low">低</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </>
                )}
              </div>
            </div>

            {/* 品質 */}
            <div className="p-6 bg-card rounded-lg shadow-sm">
              <h2 className="text-xl font-semibold mb-4 pb-2 border-b">
                6. 品質
              </h2>
              <div className="space-y-4">
                <FormField
                  control={form.control}
                  name="qualityConcerns"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="required">
                        品質懸念事項の有無
                      </FormLabel>
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
                          <SelectItem value="none">なし</SelectItem>
                          <SelectItem value="minor">軽微な懸念あり</SelectItem>
                          <SelectItem value="major">重大な懸念あり</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {form.watch("qualityConcerns") !== "none" && (
                  <FormField
                    control={form.control}
                    name="qualityDetails"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="required">
                          品質懸念事項の詳細
                        </FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="品質に関する懸念事項の詳細を記述してください"
                            className="h-24"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                <FormField
                  control={form.control}
                  name="testProgress"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>テスト進捗状況</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="テストの進捗状況を記述してください"
                          className="h-24"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* 変更管理 */}
            <div className="p-6 bg-card rounded-lg shadow-sm">
              <h2 className="text-xl font-semibold mb-4 pb-2 border-b">
                7. 変更管理
              </h2>
              <div className="space-y-4">
                <FormField
                  control={form.control}
                  name="changes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="required">変更の有無</FormLabel>
                      <FormControl>
                        <RadioGroup
                          onValueChange={field.onChange}
                          defaultValue={field.value}
                          className="flex gap-4"
                        >
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="yes" id="changes-yes" />
                            <label htmlFor="changes-yes">あり</label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="no" id="changes-no" />
                            <label htmlFor="changes-no">なし</label>
                          </div>
                        </RadioGroup>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {form.watch("changes") === "yes" && (
                  <FormField
                    control={form.control}
                    name="changeDetails"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="required">
                          変更内容の詳細
                        </FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="変更内容、影響範囲、対応状況などを記述してください"
                            className="h-24"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
              </div>
            </div>

            {/* 来週の予定 */}
            <div className="p-6 bg-card rounded-lg shadow-sm">
              <h2 className="text-xl font-semibold mb-4 pb-2 border-b">
                8. 来週の予定
              </h2>
              <FormField
                control={form.control}
                name="nextWeekPlan"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="required">来週の作業予定</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="来週予定している作業内容を記述してください"
                        className="h-32"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* 支援・判断要望 */}
            <div className="p-6 bg-card rounded-lg shadow-sm">
              <h2 className="text-xl font-semibold mb-4 pb-2 border-b">
                9. 支援・判断要望
              </h2>
              <FormField
                control={form.control}
                name="supportRequests"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="required">
                      支援・判断の要望事項
                    </FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="必要な支援や判断を仰ぎたい事項を記述してください"
                        className="h-32"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* その他の懸念事項 */}
            <div className="p-6 bg-card rounded-lg shadow-sm">
              <h2 className="text-xl font-semibold mb-4 pb-2 border-b">
                10. その他の懸念事項
              </h2>

              {/* リソース */}
              <div className="mb-6">
                <FormField
                  control={form.control}
                  name="resourceConcerns"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>リソースに関する懸念</FormLabel>
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
                          <SelectItem value="none">なし</SelectItem>
                          <SelectItem value="exists">あり</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {form.watch("resourceConcerns") === "exists" && (
                  <FormField
                    control={form.control}
                    name="resourceDetails"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>詳細</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="リソースに関する懸念事項の詳細を記述してください"
                            className="h-24"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
              </div>

              {/* 顧客 */}
              <div className="mb-6">
                <FormField
                  control={form.control}
                  name="customerIssues"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>顧客に関する懸念</FormLabel>
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
                          <SelectItem value="none">なし</SelectItem>
                          <SelectItem value="exists">あり</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {form.watch("customerIssues") === "exists" && (
                  <FormField
                    control={form.control}
                    name="customerDetails"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>詳細</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="顧客に関する懸念事項の詳細を記述してください"
                            className="h-24"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
              </div>

              {/* 環境 */}
              <div className="mb-6">
                <FormField
                  control={form.control}
                  name="environmentIssues"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>環境に関する懸念</FormLabel>
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
                          <SelectItem value="none">なし</SelectItem>
                          <SelectItem value="exists">あり</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {form.watch("environmentIssues") === "exists" && (
                  <FormField
                    control={form.control}
                    name="environmentDetails"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>詳細</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="環境に関する懸念事項の詳細を記述してください"
                            className="h-24"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
              </div>

              {/* コスト */}
              <div className="mb-6">
                <FormField
                  control={form.control}
                  name="costIssues"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>コストに関する懸念</FormLabel>
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
                          <SelectItem value="none">なし</SelectItem>
                          <SelectItem value="exists">あり</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {form.watch("costIssues") === "exists" && (
                  <FormField
                    control={form.control}
                    name="costDetails"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>詳細</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="コストに関する懸念事項の詳細を記述してください"
                            className="h-24"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
              </div>

              {/* 知識・スキル */}
              <div className="mb-6">
                <FormField
                  control={form.control}
                  name="knowledgeIssues"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>知識・スキルに関する懸念</FormLabel>
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
                          <SelectItem value="none">なし</SelectItem>
                          <SelectItem value="exists">あり</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {form.watch("knowledgeIssues") === "exists" && (
                  <FormField
                    control={form.control}
                    name="knowledgeDetails"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>詳細</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="知識・スキルに関する懸念事項の詳細を記述してください"
                            className="h-24"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
              </div>

              {/* 教育 */}
              <div className="mb-6">
                <FormField
                  control={form.control}
                  name="trainingIssues"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>教育に関する懸念</FormLabel>
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
                          <SelectItem value="none">なし</SelectItem>
                          <SelectItem value="exists">あり</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {form.watch("trainingIssues") === "exists" && (
                  <FormField
                    control={form.control}
                    name="trainingDetails"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="required">教育に関する懸念の詳細</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="教育に関する懸念の詳細を記述してください"
                            className="h-24"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
              </div>
              <div className="mb-6">
                <FormField
                  control={form.control}
                  name="urgentIssues"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>緊急課題に関する懸念</FormLabel>
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
                          <SelectItem value="none">なし</SelectItem>
                          <SelectItem value="exists">あり</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {form.watch("urgentIssues") === "exists" && (
                  <FormField
                    control={form.control}
                    name="urgentDetails"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="required">詳細</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="緊急課題の詳細を記述してください"
                            className="h-24"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
              </div>

              {/* 営業チャンス・顧客ニーズ */}
              <div className="mb-6">
                <FormField
                  control={form.control}
                  name="businessOpportunities"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>営業チャンス・顧客ニーズ</FormLabel>
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
                          <SelectItem value="none">なし</SelectItem>
                          <SelectItem value="exists">あり</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {form.watch("businessOpportunities") === "exists" && (
                  <FormField
                    control={form.control}
                    name="businessDetails"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>詳細</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="営業チャンス・顧客ニーズの詳細を記述してください"
                            className="h-24"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
              </div>
            </div>

            {/* その他の懸念事項の後にAI分析結果を表示 */}
            {isEditMode && existingReport?.aiAnalysis && (
              <Card>
                <CardContent className="p-6">
                  <h2 className="text-xl font-semibold mb-4 pb-2 border-b">
                    ■ AI分析結果
                  </h2>
                  <div className="whitespace-pre-wrap text-sm">
                    {existingReport.aiAnalysis}
                  </div>
                </CardContent>
              </Card>
            )}

            <div className="flex justify-end mt-8">
              <Button
                type="submit"
                className="flex items-center gap-2"
                disabled={isSubmitting}
              >
                <Send className="h-4 w-4" />
                {isSubmitting ? "送信中..." : isEditMode ? "更新" : "送信"}
              </Button>
            </div>
          </form>
        </Form>
      </div>
    </div>
  );
}