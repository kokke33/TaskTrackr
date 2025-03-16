import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { WeeklyReport, Case } from "@shared/schema";
import { Card, CardContent } from "@/components/ui/card";
import { ThemeToggle } from "@/components/theme-toggle";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Copy } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function WeeklyReportList() {
  const { toast } = useToast();
  const { data: reports, isLoading: isLoadingReports } = useQuery<WeeklyReport[]>({
    queryKey: ["/api/weekly-reports"],
    staleTime: 0,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
  });

  const { data: cases, isLoading: isLoadingCases } = useQuery<Case[]>({
    queryKey: ["/api/cases"],
    staleTime: 0,
  });

  if (isLoadingReports || isLoadingCases) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-8">
          <p className="text-center">読み込み中...</p>
        </div>
      </div>
    );
  }

  // 案件情報をIDでマップ化
  const caseMap = new Map(cases?.map(case_ => [case_.id, case_]));

  // プロジェクトごとにレポートをグループ化
  const projectGroups = cases?.reduce((acc, case_) => {
    const reports_ = reports?.filter(r => r.caseId === case_.id) ?? [];
    const projectName = case_.projectName;
    if (!acc[projectName]) {
      acc[projectName] = [];
    }
    acc[projectName].push(...reports_);
    return acc;
  }, {} as Record<string, WeeklyReport[]>) ?? {};

  const copyToClipboard = (report: WeeklyReport) => {
    const case_ = caseMap.get(report.caseId);
    if (!case_) return;

    const progressStatusMap = {
      "on-schedule": "予定通り",
      "slightly-delayed": "少し遅れている",
      "severely-delayed": "大幅に遅れている",
      ahead: "前倒しで進行中",
    };

    const qualityConcernsMap = {
      none: "なし",
      minor: "軽微な懸念あり",
      major: "重大な懸念あり",
    };

    const riskLevelMap = {
      high: "高",
      medium: "中",
      low: "低",
    };

    const csvHeaders = [
      "報告期間開始",
      "報告期間終了",
      "プロジェクト名",
      "案件名",
      "報告者名",
      "今週の作業内容",
      "進捗率",
      "進捗状況",
      "遅延・問題点の有無",
      "遅延・問題点の詳細",
      "課題・問題点",
      "新たなリスクの有無",
      "リスクの概要",
      "リスク対策",
      "リスクレベル",
      "品質懸念事項の有無",
      "品質懸念事項の詳細",
      "テスト進捗状況",
      "変更の有無",
      "変更内容の詳細",
      "来週の作業予定",
      "支援・判断の要望事項",
      "リソースに関する懸念",
      "リソースの詳細",
      "顧客に関する懸念",
      "顧客の詳細",
      "環境に関する懸念",
      "環境の詳細",
      "コストに関する懸念",
      "コストの詳細",
      "知識・スキルに関する懸念",
      "知識・スキルの詳細",
      "教育に関する懸念",
      "教育の詳細",
      "緊急課題に関する懸念",
      "緊急課題の詳細",
      "営業チャンス・顧客ニーズ",
      "営業チャンス・顧客ニーズの詳細",
    ].join(",");

    const csvData = [
      csvHeaders,
      [
        report.reportPeriodStart,
        report.reportPeriodEnd,
        case_.projectName,
        case_.caseName,
        report.reporterName,
        report.weeklyTasks || "",
        `${report.progressRate}%`,
        progressStatusMap[
          report.progressStatus as keyof typeof progressStatusMap
        ] || report.progressStatus,
        report.delayIssues === "yes" ? "あり" : "なし",
        report.delayDetails || "",
        report.issues || "",
        report.newRisks === "yes" ? "あり" : "なし",
        report.riskSummary || "",
        report.riskCountermeasures || "",
        report.riskLevel
          ? riskLevelMap[report.riskLevel as keyof typeof riskLevelMap]
          : "",
        qualityConcernsMap[
          report.qualityConcerns as keyof typeof qualityConcernsMap
        ] || "",
        report.qualityDetails || "",
        report.testProgress || "",
        report.changes === "yes" ? "あり" : "なし",
        report.changeDetails || "",
        report.nextWeekPlan || "",
        report.supportRequests || "",
        report.resourceConcerns === "exists" ? "あり" : "なし",
        report.resourceDetails || "",
        report.customerIssues === "exists" ? "あり" : "なし",
        report.customerDetails || "",
        report.environmentIssues === "exists" ? "あり" : "なし",
        report.environmentDetails || "",
        report.costIssues === "exists" ? "あり" : "なし",
        report.costDetails || "",
        report.knowledgeIssues === "exists" ? "あり" : "なし",
        report.knowledgeDetails || "",
        report.trainingIssues === "exists" ? "あり" : "なし",
        report.trainingDetails || "",
        report.urgentIssues === "exists" ? "あり" : "なし",
        report.urgentDetails || "",
        report.businessOpportunities === "exists" ? "あり" : "なし",
        report.businessDetails || "",
      ].join(","),
    ].join("\n");

    navigator.clipboard
      .writeText(csvData)
      .then(() => {
        toast({
          title: "コピー完了",
          description: "報告内容をCSV形式でクリップボードにコピーしました。",
        });
      })
      .catch(() => {
        toast({
          title: "エラー",
          description: "クリップボードへのコピーに失敗しました。",
          variant: "destructive",
        });
      });
  };

  return (
    <div className="min-h-screen bg-background">
      <ThemeToggle />

      <div className="container mx-auto px-4 py-8">
        <header className="mb-8">
          <div className="flex justify-between items-center">
            <h1 className="text-3xl font-bold text-primary">週次報告一覧</h1>
            <Link
              href="/report/new"
              className="text-sm text-muted-foreground hover:text-primary"
            >
              新規報告作成
            </Link>
          </div>
          <Link
            href="/"
            className="text-sm text-muted-foreground hover:text-primary"
          >
            ホームに戻る
          </Link>
        </header>

        <Tabs
          defaultValue={
            new URLSearchParams(window.location.search).get("project") ||
            Object.keys(projectGroups)[0]
          }
          className="w-full"
        >
          <TabsList className="w-full min-h-fit justify-start mb-4 flex flex-wrap gap-2 p-4">
            {Object.keys(projectGroups).map((projectName) => (
              <TabsTrigger key={projectName} value={projectName}>
                {projectName}
              </TabsTrigger>
            ))}
          </TabsList>

          {Object.entries(projectGroups).map(([projectName, projectReports]) => (
            <TabsContent key={projectName} value={projectName}>
              {projectReports.length === 0 ? (
                <p className="text-center text-muted-foreground">
                  このプロジェクトの報告はまだありません
                </p>
              ) : (
                <div className="grid gap-4">
                  {projectReports.map((report) => {
                    const case_ = caseMap.get(report.caseId);
                    if (!case_) return null;

                    return (
                      <Card key={report.id} className="hover:bg-accent/5">
                        <CardContent className="p-4">
                          <div className="flex justify-between items-start">
                            <Link href={`/reports/${report.id}`}>
                              <div>
                                <p className="font-semibold">
                                  {case_.caseName}
                                </p>
                                <p className="text-sm text-muted-foreground">
                                  {report.reporterName}
                                </p>
                              </div>
                            </Link>
                            <div className="flex flex-col items-end gap-2">
                              <div className="text-right">
                                <p className="text-sm">
                                  {new Date(
                                    report.reportPeriodStart,
                                  ).toLocaleDateString()}{" "}
                                  ～{" "}
                                  {new Date(
                                    report.reportPeriodEnd,
                                  ).toLocaleDateString()}
                                </p>
                                <p className="text-sm text-muted-foreground">
                                  進捗率: {report.progressRate}%
                                </p>
                              </div>
                              <Button
                                variant="outline"
                                size="sm"
                                className="flex items-center gap-2"
                                onClick={() => copyToClipboard(report)}
                              >
                                <Copy className="h-4 w-4" />
                                CSVコピー
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </div>
  );
}