import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { WeeklyReport } from "@shared/schema";
import { Card, CardContent } from "@/components/ui/card";
import { ThemeToggle } from "@/components/theme-toggle";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function WeeklyReportList() {
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
                        <Link href={`/reports/${report.id}`}>
                          <div className="flex justify-between items-start">
                            <div>
                              <p className="font-semibold">
                                {report.projectName === "other" ? report.otherProject : report.projectName}
                              </p>
                              <p className="text-sm text-muted-foreground">{report.reporterName}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-sm">
                                {new Date(report.reportPeriodStart).toLocaleDateString()} ～{" "}
                                {new Date(report.reportPeriodEnd).toLocaleDateString()}
                              </p>
                              <p className="text-sm text-muted-foreground">
                                進捗率: {report.progressRate}%
                              </p>
                            </div>
                          </div>
                        </Link>
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