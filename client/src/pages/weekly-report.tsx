import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { weeklyReportSchema, type WeeklyReportFormData } from "@/lib/validations/weekly-report";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ThemeToggle } from "@/components/theme-toggle";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";

export default function WeeklyReport() {
  const { toast } = useToast();
  const [showOtherProject, setShowOtherProject] = useState(false);

  const form = useForm<WeeklyReportFormData>({
    resolver: zodResolver(weeklyReportSchema),
    defaultValues: {
      progressRate: 0,
      delayIssues: "no",
      newRisks: "no",
      qualityConcerns: "none",
      changes: "no",
    }
  });

  const onSubmit = async (data: WeeklyReportFormData) => {
    try {
      await fetch('/api/weekly-reports', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      toast({
        title: "報告が送信されました",
        description: "週次報告が正常に送信されました。",
      });
    } catch (error) {
      toast({
        title: "エラー",
        description: "週次報告の送信に失敗しました。",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <ThemeToggle />

      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <header className="mb-8 text-center">
          <h1 className="text-3xl font-bold mb-2 text-primary">週次報告フォーム</h1>
          <p className="text-muted-foreground">
            プロジェクトの週次進捗を報告するためのフォームです。必須項目には<span className="text-destructive">*</span>が付いています。
          </p>
        </header>

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
                          <SelectItem value="project-a">プロジェクトA</SelectItem>
                          <SelectItem value="project-b">プロジェクトB</SelectItem>
                          <SelectItem value="project-c">プロジェクトC</SelectItem>
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

            {/* Submit Button */}
            <Button
              type="submit"
              className="w-full"
              size="lg"
            >
              報告を送信
            </Button>
          </form>
        </Form>
      </div>
    </div>
  );
}