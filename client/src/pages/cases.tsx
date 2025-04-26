import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Case } from "@shared/schema";
import { Card, CardContent } from "@/components/ui/card";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { Plus, AlertCircle } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useState } from "react";

export default function CaseList() {
  const [showDeleted, setShowDeleted] = useState(true);
  
  const { data: cases, isLoading } = useQuery<Case[]>({
    queryKey: ["/api/cases"],
    queryFn: async () => {
      const url = `/api/cases?includeDeleted=${showDeleted}`;
      const response = await fetch(url, {
        credentials: 'include'
      });
      if (!response.ok) {
        throw new Error("案件の取得に失敗しました");
      }
      return response.json();
    },
    staleTime: 0,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
  });

  // プロジェクト名でグループ化
  const groupedCases = cases?.reduce((acc, currentCase) => {
    const projectName = currentCase.projectName;
    if (!acc[projectName]) {
      acc[projectName] = [];
    }
    acc[projectName].push(currentCase);
    return acc;
  }, {} as Record<string, Case[]>) ?? {};

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
          <div className="flex justify-between items-center">
            <h1 className="text-3xl font-bold text-primary">案件一覧</h1>
            <Link href="/case/new">
              <Button className="flex items-center gap-2">
                <Plus className="h-4 w-4" />
                新規案件作成
              </Button>
            </Link>
          </div>
          <div className="flex justify-between items-center mt-2">
            <Link href="/" className="text-sm text-muted-foreground hover:text-primary">
              ホームに戻る
            </Link>
            <div className="flex items-center space-x-2">
              <Switch 
                id="show-deleted" 
                checked={showDeleted} 
                onCheckedChange={setShowDeleted}
              />
              <Label htmlFor="show-deleted" className="text-sm">
                削除済み案件を表示
              </Label>
            </div>
          </div>
        </header>

        <div className="space-y-8">
          {Object.entries(groupedCases).map(([projectName, projectCases]) => (
            <div key={projectName}>
              <h2 className="text-xl font-semibold mb-4">{projectName}</h2>
              <div className="grid gap-4">
                {projectCases.map((case_) => (
                  <Card 
                    key={case_.id} 
                    className={`hover:bg-accent/5 ${case_.isDeleted ? 'border-destructive/30 bg-destructive/5' : ''}`}
                  >
                    <CardContent className="p-4">
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-semibold">{case_.caseName}</p>
                            {case_.isDeleted && (
                              <div className="flex items-center text-destructive text-xs">
                                <AlertCircle className="h-3 w-3 mr-1" />
                                <span>削除済み</span>
                              </div>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground">
                            作成日: {new Date(case_.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          {!case_.isDeleted && (
                            <Link href={`/reports?caseId=${case_.id}`}>
                              <Button variant="outline" size="sm">
                                週次報告一覧
                              </Button>
                            </Link>
                          )}
                          <Link href={`/case/edit/${case_.id}`}>
                            <Button variant="outline" size="sm">
                              {case_.isDeleted ? '復元/編集' : '編集'}
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
