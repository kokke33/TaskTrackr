import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "wouter";
import { WeeklyReport } from "@shared/schema";
import { Card, CardContent } from "@/components/ui/card";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { Edit } from "lucide-react";

export default function WeeklyReportDetail() {
  const { id } = useParams<{ id: string }>();
  const { data: report, isLoading } = useQuery<WeeklyReport>({
    queryKey: [`/api/weekly-reports/${id}`],
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

  if (!report) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-8">
          <p className="text-center">報告が見つかりません</p>
          <div className="text-center mt-4">
            <Link href="/reports">
              <Button variant="outline">一覧に戻る</Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const renderSection = (title: string, content: string | null | undefined) => {
    if (!content) return null;
    return (
      <div className="mb-4">
        <h3 className="font-semibold mb-2">{title}</h3>
        <p className="whitespace-pre-wrap">{content}</p>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-background">
      <ThemeToggle />

      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <header className="mb-8">
          <div className="flex justify-between items-center">
            <h1 className="text-3xl font-bold text-primary">週次報告詳細</h1>
            <div className="flex gap-4">
              <Link href={`/report/edit/${id}`}>
                <Button className="flex items-center gap-2">
                  <Edit className="h-4 w-4" />
                  編集
                </Button>
              </Link>
              <Link href="/reports">
                <Button variant="outline">一覧に戻る</Button>
              </Link>
            </div>
          </div>
        </header>

        <div className="space-y-6">
          <Card>
            <CardContent className="p-6">
              <h2 className="text-xl font-semibold mb-4 pb-2 border-b">1. 基本情報</h2>
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">報告期間</p>
                  <p>
                    {new Date(report.reportPeriodStart).toLocaleDateString()} ～{" "}
                    {new Date(report.reportPeriodEnd).toLocaleDateString()}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">担当現場名</p>
                  <p>{report.projectName === "other" ? report.otherProject : report.projectName}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">報告者名</p>
                  <p>{report.reporterName}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <h2 className="text-xl font-semibold mb-4 pb-2 border-b">2. 今週の作業内容</h2>
              {renderSection("作業内容", report.weeklyTasks)}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <h2 className="text-xl font-semibold mb-4 pb-2 border-b">3. 進捗状況</h2>
              <div className="space-y-4">
                <div>
                  <p className="text-sm text-muted-foreground">進捗率</p>
                  <p>{report.progressRate}%</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">進捗状況</p>
                  <p>{report.progressStatus}</p>
                </div>
                {report.delayIssues === "yes" && renderSection("遅延・問題点の詳細", report.delayDetails)}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <h2 className="text-xl font-semibold mb-4 pb-2 border-b">4. 課題・問題点</h2>
              {renderSection("課題・問題点", report.issues)}
            </CardContent>
          </Card>

          {report.newRisks === "yes" && (
            <Card>
              <CardContent className="p-6">
                <h2 className="text-xl font-semibold mb-4 pb-2 border-b">5. 新たなリスク</h2>
                <div className="space-y-4">
                  {renderSection("リスクの概要", report.riskSummary)}
                  {renderSection("対策", report.riskCountermeasures)}
                  <div>
                    <p className="text-sm text-muted-foreground">リスクレベル</p>
                    <p>{report.riskLevel}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardContent className="p-6">
              <h2 className="text-xl font-semibold mb-4 pb-2 border-b">6. 品質</h2>
              <div className="space-y-4">
                <div>
                  <p className="text-sm text-muted-foreground">品質懸念事項の有無</p>
                  <p>{report.qualityConcerns}</p>
                </div>
                {report.qualityConcerns !== "none" && renderSection("品質懸念事項の詳細", report.qualityDetails)}
                {renderSection("テスト進捗状況", report.testProgress)}
              </div>
            </CardContent>
          </Card>

          {report.changes === "yes" && (
            <Card>
              <CardContent className="p-6">
                <h2 className="text-xl font-semibold mb-4 pb-2 border-b">7. 変更管理</h2>
                {renderSection("変更内容の詳細", report.changeDetails)}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardContent className="p-6">
              <h2 className="text-xl font-semibold mb-4 pb-2 border-b">8. 来週の予定</h2>
              {renderSection("来週の作業予定", report.nextWeekPlan)}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <h2 className="text-xl font-semibold mb-4 pb-2 border-b">9. 支援・判断要望</h2>
              {renderSection("支援・判断の要望事項", report.supportRequests)}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <h2 className="text-xl font-semibold mb-4 pb-2 border-b">10. その他の懸念事項</h2>
              <div className="space-y-6">
                {report.resourceConcerns === "exists" && (
                  <div>
                    <h3 className="font-semibold mb-2">リソースに関する懸念</h3>
                    {renderSection("詳細", report.resourceDetails)}
                  </div>
                )}
                {report.customerIssues === "exists" && (
                  <div>
                    <h3 className="font-semibold mb-2">顧客に関する懸念</h3>
                    {renderSection("詳細", report.customerDetails)}
                  </div>
                )}
                {report.environmentIssues === "exists" && (
                  <div>
                    <h3 className="font-semibold mb-2">環境に関する懸念</h3>
                    {renderSection("詳細", report.environmentDetails)}
                  </div>
                )}
                {report.costIssues === "exists" && (
                  <div>
                    <h3 className="font-semibold mb-2">コストに関する懸念</h3>
                    {renderSection("詳細", report.costDetails)}
                  </div>
                )}
                {report.knowledgeIssues === "exists" && (
                  <div>
                    <h3 className="font-semibold mb-2">知識・スキルに関する懸念</h3>
                    {renderSection("詳細", report.knowledgeDetails)}
                  </div>
                )}
                {report.trainingIssues === "exists" && (
                  <div>
                    <h3 className="font-semibold mb-2">教育に関する懸念</h3>
                    {renderSection("詳細", report.trainingDetails)}
                  </div>
                )}
                {report.urgentIssues === "exists" && (
                  <div>
                    <h3 className="font-semibold mb-2">緊急課題に関する懸念</h3>
                    {renderSection("詳細", report.urgentDetails)}
                  </div>
                )}
                {report.businessOpportunities === "exists" && (
                  <div>
                    <h3 className="font-semibold mb-2">営業チャンス・顧客ニーズ</h3>
                    {renderSection("詳細", report.businessDetails)}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}