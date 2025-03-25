import { useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { WeeklyReport, Case } from "@shared/schema";
import { Card, CardContent } from "@/components/ui/card";
import { ThemeToggle } from "@/components/theme-toggle";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Copy, List, Plus, ChevronRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect } from "react";

export default function WeeklyReportList() {
  const { toast } = useToast();
  const [locationPath, locationSearch] = useLocation();
  const [selectedProject, setSelectedProject] = useState<string | null>(null);
  const [selectedCase, setSelectedCase] = useState<number | null>(null);
  
  // URLパラメータから初期値を設定
  useEffect(() => {
    if (locationSearch) {
      // URLSearchParamsはブラウザのみで動作するため、クライアントサイドのみで実行
      try {
        const searchParams = new URLSearchParams(locationSearch);
        
        const projectNameParam = searchParams.get('projectName');
        if (projectNameParam) {
          setSelectedProject(decodeURIComponent(projectNameParam));
        }
        
        const caseIdParam = searchParams.get('caseId');
        if (caseIdParam) {
          const caseId = parseInt(caseIdParam);
          if (!isNaN(caseId)) {
            setSelectedCase(caseId);
          }
        }
      } catch (err) {
        console.error('Error parsing URL parameters:', err);
      }
    }
  }, [locationSearch]);
  
  // すべての週次報告を取得
  const { data: reports, isLoading: isLoadingReports } = useQuery<WeeklyReport[]>({
    queryKey: ["/api/weekly-reports"],
    staleTime: 0,
  });

  // すべての案件を取得
  const { data: cases, isLoading: isLoadingCases } = useQuery<Case[]>({
    queryKey: ["/api/cases"],
    staleTime: 0,
  });
  
  // 選択された案件に紐づく週次報告を取得
  const { data: caseReports, isLoading: isLoadingCaseReports } = useQuery<WeeklyReport[]>({
    queryKey: [`/api/weekly-reports/by-case/${selectedCase}`],
    staleTime: 0,
    enabled: selectedCase !== null,
  });

  if (isLoadingReports || isLoadingCases || (selectedCase !== null && isLoadingCaseReports)) {
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

  // プロジェクト名でユニークなリストを作成
  const projectNames = Array.from(new Set(cases?.map(case_ => case_.projectName) || []));
  
  // プロジェクトごとに案件をグループ化
  const projectCasesMap = cases?.reduce((acc, case_) => {
    const projectName = case_.projectName;
    if (!acc[projectName]) {
      acc[projectName] = [];
    }
    acc[projectName].push(case_);
    return acc;
  }, {} as Record<string, Case[]>) ?? {};

  // 初めて画面を開いた時、最初のプロジェクトを選択状態にする
  if (projectNames.length > 0 && selectedProject === null) {
    setSelectedProject(projectNames[0]);
  }

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

  // 案件を選択した時の処理
  const handleCaseSelect = (caseId: number) => {
    setSelectedCase(caseId);
  };

  // プロジェクトを変更した時に案件選択をリセット
  const handleProjectChange = (projectName: string) => {
    setSelectedProject(projectName);
    setSelectedCase(null);
  };

  // 案件選択をリセットする処理
  const resetCaseSelection = () => {
    setSelectedCase(null);
  };

  return (
    <div className="min-h-screen bg-background">
      <ThemeToggle />

      <div className="container mx-auto px-4 py-8">
        <header className="mb-8">
          <div className="flex justify-between items-center mb-4">
            <h1 className="text-3xl font-bold text-primary">週次報告一覧</h1>
            <div className="flex items-center gap-4">
              <Link href="/report/new">
                <Button variant="outline" size="sm" className="flex items-center gap-2">
                  <Plus className="h-4 w-4" />
                  新規報告作成
                </Button>
              </Link>
              <Link href="/cases">
                <Button variant="outline" size="sm" className="flex items-center gap-2">
                  <List className="h-4 w-4" />
                  案件一覧
                </Button>
              </Link>
            </div>
          </div>
          <div className="flex justify-start">
            <Link href="/">
              <Button variant="ghost" size="sm">
                ホームに戻る
              </Button>
            </Link>
          </div>
        </header>

        {/* ナビゲーションパンくず */}
        {selectedCase !== null && (
          <div className="flex items-center gap-2 mb-4">
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={resetCaseSelection}
              className="text-muted-foreground hover:text-foreground"
            >
              {selectedProject}
            </Button>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium">
              {caseMap.get(selectedCase)?.caseName}
            </span>
          </div>
        )}

        {/* プロジェクト選択タブ - 案件が選択されていない場合のみ表示 */}
        {selectedCase === null && (
          <Tabs
            value={selectedProject || undefined}
            onValueChange={handleProjectChange}
            className="w-full"
          >
            <TabsList className="w-full min-h-fit justify-start mb-4 flex flex-wrap gap-2 p-4">
              {projectNames.map((projectName) => (
                <TabsTrigger key={projectName} value={projectName}>
                  {projectName}
                </TabsTrigger>
              ))}
            </TabsList>

            {/* プロジェクト内の案件一覧 */}
            {projectNames.map((projectName) => (
              <TabsContent key={projectName} value={projectName}>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {projectCasesMap[projectName]?.map((case_) => (
                    <Card 
                      key={case_.id} 
                      className="hover:bg-accent/5 cursor-pointer"
                      onClick={() => handleCaseSelect(case_.id)}
                    >
                      <CardContent className="p-4">
                        <div className="flex justify-between items-center">
                          <div>
                            <p className="font-semibold">{case_.caseName}</p>
                            <p className="text-sm text-muted-foreground">
                              {case_.description || "説明なし"}
                            </p>
                          </div>
                          <ChevronRight className="h-5 w-5 text-muted-foreground" />
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </TabsContent>
            ))}
          </Tabs>
        )}

        {/* 選択された案件の週次報告一覧 */}
        {selectedCase !== null && caseReports && (
          <div className="mt-4">
            {caseReports.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                この案件の報告はまだありません
              </p>
            ) : (
              <div className="grid gap-4">
                {caseReports.map((report) => {
                  const case_ = caseMap.get(report.caseId);
                  if (!case_) return null;

                  return (
                    <Card key={report.id} className="hover:bg-accent/5">
                      <CardContent className="p-4">
                        <div className="flex justify-between items-start">
                          <Link href={`/reports/${report.id}`}>
                            <div>
                              <p className="font-semibold">{case_.caseName}</p>
                              <p className="text-sm text-muted-foreground">
                                {report.reporterName}
                              </p>
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
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}