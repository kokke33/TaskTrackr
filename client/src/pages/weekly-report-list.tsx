import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { WeeklyReport } from "@shared/schema";
import { Card, CardContent } from "@/components/ui/card";
import { ThemeToggle } from "@/components/theme-toggle";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Copy } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function WeeklyReportList() {
  const { toast } = useToast();
  const { data: reports, isLoading } = useQuery<WeeklyReport[]>({
    queryKey: ["/api/weekly-reports"],
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

  // プロジェクトごとにレポートをグループ化
  const projectGroups = {
    "project-a": reports?.filter(r => r.projectName === "project-a") ?? [],
    "project-b": reports?.filter(r => r.projectName === "project-b") ?? [],
    "project-c": reports?.filter(r => r.projectName === "project-c") ?? [],
    "other": reports?.filter(r => r.projectName === "other") ?? [],
  };

  const copyToClipboard = (report: WeeklyReport) => {
    const csvData = [
      "報告期間開始,報告期間終了,プロジェクト名,報告者名,進捗率,進捗状況",
      `${report.reportPeriodStart},${report.reportPeriodEnd},${report.projectName === "other" ? report.otherProject : report.projectName},${report.reporterName},${report.progressRate}%,${report.progressStatus}`
    ].join("\n");

    navigator.clipboard.writeText(csvData).then(() => {
      toast({
        title: "コピー完了",
        description: "報告内容をCSV形式でクリップボードにコピーしました。",
      });
    }).catch(() => {
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
            <Link href="/report/new" className="text-sm text-muted-foreground hover:text-primary">
              新規報告作成
            </Link>
          </div>
          <Link href="/" className="text-sm text-muted-foreground hover:text-primary">
            ホームに戻る
          </Link>
        </header>

        <Tabs defaultValue="project-a" className="w-full">
          <TabsList className="w-full justify-start mb-4">
            <TabsTrigger value="project-a">プロジェクトA</TabsTrigger>
            <TabsTrigger value="project-b">プロジェクトB</TabsTrigger>
            <TabsTrigger value="project-c">プロジェクトC</TabsTrigger>
            <TabsTrigger value="other">その他</TabsTrigger>
          </TabsList>

          {Object.entries(projectGroups).map(([projectId, projectReports]) => (
            <TabsContent key={projectId} value={projectId}>
              {projectReports.length === 0 ? (
                <p className="text-center text-muted-foreground">
                  このプロジェクトの報告はまだありません
                </p>
              ) : (
                <div className="grid gap-4">
                  {projectReports.map((report) => (
                    <Card key={report.id} className="hover:bg-accent/5">
                      <CardContent className="p-4">
                        <div className="flex justify-between items-start">
                          <Link href={`/reports/${report.id}`}>
                            <div>
                              <p className="font-semibold">
                                {report.projectName === "other" ? report.otherProject : report.projectName}
                              </p>
                              <p className="text-sm text-muted-foreground">{report.reporterName}</p>
                            </div>
                          </Link>
                          <div className="flex flex-col items-end gap-2">
                            <div className="text-right">
                              <p className="text-sm">
                                {new Date(report.reportPeriodStart).toLocaleDateString()} ～{" "}
                                {new Date(report.reportPeriodEnd).toLocaleDateString()}
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
                  ))}
                </div>
              )}
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </div>
  );
}