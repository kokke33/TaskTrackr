import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertWeeklyReportSchema, type WeeklyReport } from "@shared/schema";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect } from "react";
import { useLocation, Link, useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Send } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export default function WeeklyReport() {
  const { id } = useParams<{ id: string }>();
  const isEditMode = !!id;

  const { data: existingReport, isLoading: isLoadingReport } = useQuery<WeeklyReport>({
    queryKey: [`/api/weekly-reports/${id}`],
    enabled: isEditMode,
    staleTime: 0,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
  });

  const { toast } = useToast();
  const [showOtherProject, setShowOtherProject] = useState(false);
  const [, setLocation] = useLocation();
  const [analysisResult, setAnalysisResult] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false); // Added state for submission

  const form = useForm<WeeklyReport>({
    resolver: zodResolver(insertWeeklyReportSchema),
    defaultValues: {
      progressRate: 0,
      delayIssues: "no",
      newRisks: "no",
      qualityConcerns: "none",
      changes: "no",
      ...existingReport,
    }
  });

  useEffect(() => {
    if (isEditMode && existingReport) {
      Object.entries(existingReport).forEach(([key, value]) => {
        form.setValue(key as keyof WeeklyReport, value);
      });
      setShowOtherProject(existingReport.projectName === "other");
    }
  }, [existingReport, form, isEditMode]);

  const onSubmit = async (data: WeeklyReport) => {
    if (isSubmitting) return; // Already submitting, prevent duplicate submission

    try {
      setIsSubmitting(true); // Set submitting state to true
      const url = isEditMode ? `/api/weekly-reports/${id}` : '/api/weekly-reports';
      const method = isEditMode ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        throw new Error('送信に失敗しました');
      }

      const result = await response.json();

      // Success toast
      toast({
        title: isEditMode ? "報告が更新されました" : "報告が送信されました",
        description: isEditMode ? "週次報告が正常に更新されました。" : "週次報告が正常に送信されました。",
      });

      // AI analysis result handling (updated to use result.aiAnalysis)
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
      console.error('Error submitting report:', error);
      toast({
        title: "エラー",
        description: isEditMode ? "週次報告の更新に失敗しました。" : "週次報告の送信に失敗しました。",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false); // Reset submitting state regardless of success or failure
    }
  };

  if (isEditMode && isLoadingReport) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-8">
          <p className="text-center">読み込み中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <div className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4">
          <div className="flex h-14 items-center justify-between">
            <h1 className="text-xl font-semibold">
              {isEditMode ? "週次報告編集" : "週次報告フォーム"}
            </h1>
            <Link href="/reports">
              <Button variant="ghost" size="sm">戻る</Button>
            </Link>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
            {/* 基本情報 */}
            <div className="p-6 bg-card rounded-lg shadow-sm">
              <h2 className="text-xl font-semibold mb-4 pb-2 border-b">1. 基本情報</h2>

              <div className="space-y-4">
                <FormField
                  control={form.control}
                  name="reportPeriodStart"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="required">報告期間</FormLabel>
                      <div className="flex gap-2 items-center">
                        <FormControl>
                          <Input type="date" {...field} />
                        </FormControl>
                        <span>～</span>
                        <FormControl>
                          <Input
                            type="date"
                            {...form.register("reportPeriodEnd")}
                          />
                        </FormControl>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="projectName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="required">担当現場名</FormLabel>
                      <Select
                        onValueChange={(value) => {
                          field.onChange(value);
                          setShowOtherProject(value === "other");
                        }}
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="選択してください" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="project-a">PNEC_SMSK・SADS_共同損サシステム再構築対応</SelectItem>
                          <SelectItem value="project-b">INSL_SNSK新種</SelectItem>
                          <SelectItem value="project-c">ITCS_SAIG_基幹系保守</SelectItem>
                          <SelectItem value="project-d">VACC_SSJN_未来革新Ⅲ期契約管理</SelectItem>
                          <SelectItem value="project-e">IIBM_FWAM退職共済</SelectItem>
                          <SelectItem value="other">その他（直接入力）</SelectItem>
                        </SelectContent>
                      </Select>
                      {showOtherProject && (
                        <FormControl>
                          <Input
                            {...form.register("otherProject")}
                            placeholder="担当現場名を入力"
                            className="mt-2"
                          />
                        </FormControl>
                      )}
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
              <h2 className="text-xl font-semibold mb-4 pb-2 border-b">2. 今週の作業内容</h2>

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
              <h2 className="text-xl font-semibold mb-4 pb-2 border-b">3. 進捗状況</h2>

              <div className="space-y-4">
                <FormField
                  control={form.control}
                  name="progressRate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="required">進捗率 (0～100%)</FormLabel>
                      <div className="flex items-center gap-4">
                        <FormControl>
                          <Input
                            type="range"
                            min="0"
                            max="100"
                            className="w-full"
                            {...field}
                            onChange={(e) => field.onChange(parseInt(e.target.value))}
                          />
                        </FormControl>
                        <FormControl>
                          <Input
                            type="number"
                            min="0"
                            max="100"
                            className="w-20"
                            {...field}
                            onChange={(e) => field.onChange(parseInt(e.target.value))}
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
                      <FormLabel className="required">計画比の進捗状況</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="選択してください" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="on-schedule">予定通り</SelectItem>
                          <SelectItem value="slightly-delayed">少し遅れている</SelectItem>
                          <SelectItem value="severely-delayed">大幅に遅れている</SelectItem>
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
                      <FormLabel className="required">進捗遅延・問題点の有無</FormLabel>
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
                        <FormLabel className="required">遅延・問題点の詳細</FormLabel>
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
              <h2 className="text-xl font-semibold mb-4 pb-2 border-b">4. 課題・問題点</h2>
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
              <h2 className="text-xl font-semibold mb-4 pb-2 border-b">5. 新たなリスク</h2>
              <div className="space-y-4">
                <FormField
                  control={form.control}
                  name="newRisks"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="required">新たなリスクの有無</FormLabel>
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
                          <FormLabel className="required">リスクの概要</FormLabel>
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
                          <FormLabel className="required">リスクレベル</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
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
              <h2 className="text-xl font-semibold mb-4 pb-2 border-b">6. 品質</h2>
              <div className="space-y-4">
                <FormField
                  control={form.control}
                  name="qualityConcerns"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="required">品質懸念事項の有無</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
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
                        <FormLabel className="required">品質懸念事項の詳細</FormLabel>
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
              <h2 className="text-xl font-semibold mb-4 pb-2 border-b">7. 変更管理</h2>
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
                        <FormLabel className="required">変更内容の詳細</FormLabel>
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
              <h2 className="text-xl font-semibold mb-4 pb-2 border-b">8. 来週の予定</h2>
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
              <h2 className="text-xl font-semibold mb-4 pb-2 border-b">9. 支援・判断要望</h2>
              <FormField
                control={form.control}
                name="supportRequests"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="required">支援・判断の要望事項</FormLabel>
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
              <h2 className="text-xl font-semibold mb-4 pb-2 border-b">10. その他の懸念事項</h2>

              {/* リソース */}
              <div className="mb-6">
                <FormField
                  control={form.control}
                  name="resourceConcerns"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>リソースに関する懸念</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
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
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
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
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
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
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
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
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
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
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
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
                        <FormLabel>詳細</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="教育に関する懸念事項の詳細を記述してください"
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

              {/* 緊急課題 */}
              <div className="mb-6">
                <FormField
                  control={form.control}
                  name="urgentIssues"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>緊急課題に関する懸念</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
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
                        <FormLabel>詳細</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="緊急課題に関する懸念事項の詳細を記述してください"
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
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
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
            {isEditMode && (
              <Card className="mt-8">
                <CardContent className="p-6">
                  <h2 className="text-xl font-semibold mb-4 pb-2 border-b">■ AI分析結果</h2>
                  <div className="whitespace-pre-wrap text-sm">
                    {analysisResult || "報告を更新すると、AIによる分析結果が表示されます。"}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* 送信ボタン */}
            <div className="sticky bottom-8 right-8 float-right z-50">
              <Button
                type="submit"
                className="shadow-lg hover:shadow-xl transition-shadow duration-200 flex items-center gap-2"
                size="lg"
                disabled={isSubmitting} // Disable button while submitting
              >
                <Send className="h-4 w-4" />
                {isSubmitting ? "送信中..." : (isEditMode ? "更新" : "送信")}
              </Button>
            </div>
          </form>
        </Form>
      </div>
    </div>
  );
}