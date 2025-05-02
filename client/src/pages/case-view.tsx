
import { useEffect, useState } from "react";
import { useParams, Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { type Case } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { 
  PenSquare, 
  ArrowLeft, 
  Briefcase, 
  Calendar,
  FileText
} from "lucide-react";
import { 
  Breadcrumb, 
  BreadcrumbItem, 
  BreadcrumbLink, 
  BreadcrumbList, 
  BreadcrumbPage, 
  BreadcrumbSeparator 
} from "@/components/ui/breadcrumb";
import { ThemeToggle } from "@/components/theme-toggle";

export default function CaseView() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();

  // 案件データを取得
  const { data: caseData, isLoading } = useQuery<Case>({
    queryKey: [`/api/cases/${id}`],
    enabled: !!id,
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

  if (!caseData) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-8">
          <p className="text-center">案件が見つかりません</p>
          <div className="flex justify-center mt-4">
            <Button onClick={() => setLocation('/cases')}>
              案件一覧に戻る
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-2xl">
        <div className="flex justify-between items-center mb-6">
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink asChild>
                  <Link href="/">ホーム</Link>
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbLink asChild>
                  <Link href="/cases">案件一覧</Link>
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbLink asChild>
                  <Link href={`/project/${encodeURIComponent(caseData.projectName)}`}>
                    {caseData.projectName}
                  </Link>
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>{caseData.caseName}</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
          <ThemeToggle />
        </div>

        <header className="mb-6">
          <div className="flex justify-between items-center">
            <h1 className="text-2xl font-semibold">案件詳細</h1>
            <div className="flex gap-2">
              <Link href="/cases">
                <Button variant="outline" size="sm">
                  <ArrowLeft className="h-4 w-4 mr-2" /> 一覧に戻る
                </Button>
              </Link>
              <Link href={`/case/edit/${id}`}>
                <Button size="sm">
                  <PenSquare className="h-4 w-4 mr-2" /> 編集する
                </Button>
              </Link>
            </div>
          </div>
        </header>

        <Card>
          <CardContent className="p-6">
            <div className="space-y-6">
              <div className="space-y-2">
                <h2 className="text-sm font-medium text-muted-foreground">プロジェクト名</h2>
                <div className="flex items-center gap-2 bg-accent/50 p-2 rounded-md">
                  <Briefcase className="h-4 w-4 text-primary" />
                  <div>{caseData.projectName}</div>
                </div>
              </div>

              <div className="space-y-2">
                <h2 className="text-sm font-medium text-muted-foreground">案件名</h2>
                <div className="bg-accent/50 p-2 rounded-md">
                  <h3 className="text-lg font-semibold">{caseData.caseName}</h3>
                </div>
              </div>

              <div className="space-y-2">
                <h2 className="text-sm font-medium text-muted-foreground">説明</h2>
                <div className="bg-accent/50 p-3 rounded-md min-h-[100px] whitespace-pre-wrap">
                  {caseData.description || "説明はありません"}
                </div>
              </div>

              {caseData.isDeleted && (
                <div className="p-3 bg-destructive/10 text-destructive rounded-md">
                  この案件は削除フラグが立っています。週次報告一覧に表示されません。
                </div>
              )}
            </div>

            <div className="flex justify-between mt-8">
              <Link href={`/reports?caseId=${caseData.id}`}>
                <Button variant="outline" className="flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  この案件の週次報告を表示
                </Button>
              </Link>
              <Link href={`/case/edit/${id}`}>
                <Button className="flex items-center gap-2">
                  <PenSquare className="h-4 w-4" />
                  編集する
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
