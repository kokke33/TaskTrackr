import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { WeeklyReport } from "@shared/schema";
import { Card, CardContent } from "@/components/ui/card";
import { ThemeToggle } from "@/components/theme-toggle";

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

  return (
    <div className="min-h-screen bg-background">
      <ThemeToggle />
      
      <div className="container mx-auto px-4 py-8">
        <header className="mb-8">
          <h1 className="text-3xl font-bold text-primary">週次報告一覧</h1>
          <Link href="/" className="text-sm text-muted-foreground hover:text-primary">
            新規報告作成
          </Link>
        </header>

        <div className="grid gap-4">
          {reports?.map((report) => (
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
      </div>
    </div>
  );
}
