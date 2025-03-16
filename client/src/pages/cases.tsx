import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Case } from "@shared/schema";
import { Card, CardContent } from "@/components/ui/card";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { useAuth } from "@/lib/auth";

export default function CaseList() {
  const { isAuthenticated } = useAuth();

  const { data: cases, isLoading } = useQuery<Case[]>({
    queryKey: ["/api/cases"],
    staleTime: 0,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
    enabled: isAuthenticated, // 認証済みの場合のみクエリを実行
  });

  if (!isAuthenticated) {
    return null; // 未認証の場合は何も表示しない
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-8">
          <p className="text-center">読み込み中...</p>
        </div>
      </div>
    );
  }

  // プロジェクト名でグループ化
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
      <ThemeToggle />

      <div className="container mx-auto px-4 py-8">
        <header className="mb-8">
          <div className="flex justify-between items-center">
            <h1 className="text-3xl font-bold text-primary">案件一覧</h1>
            <Link href="/case/new">
              <Button className="flex items-center gap-2">
                <Plus className="h-4 w-4" />
                新規案件作成
              </Button>
            </Link>
          </div>
          <Link href="/" className="text-sm text-muted-foreground hover:text-primary">
            ホームに戻る
          </Link>
        </header>

        <div className="space-y-8">
          {Object.entries(groupedCases).map(([projectName, projectCases]) => (
            <div key={projectName}>
              <h2 className="text-xl font-semibold mb-4">{projectName}</h2>
              <div className="grid gap-4">
                {projectCases.map((case_) => (
                  <Card key={case_.id} className="hover:bg-accent/5">
                    <CardContent className="p-4">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-semibold">{case_.caseName}</p>
                          <p className="text-sm text-muted-foreground">
                            作成日: {new Date(case_.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <Link href={`/reports?caseId=${case_.id}`}>
                            <Button variant="outline" size="sm">
                              週次報告一覧
                            </Button>
                          </Link>
                          <Link href={`/case/edit/${case_.id}`}>
                            <Button variant="outline" size="sm">
                              編集
                            </Button>
                          </Link>
                        </div>
                      </div>
                      {case_.description && (
                        <p className="mt-2 text-sm text-muted-foreground">
                          {case_.description}
                        </p>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}