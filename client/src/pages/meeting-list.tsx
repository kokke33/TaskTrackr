import { useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { Case, ManagerMeeting, WeeklyReportMeeting } from "@shared/schema";
import { Card, CardContent } from "@/components/ui/card";
import { ThemeToggle } from "@/components/theme-toggle";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { ChevronRight, FileText, Home, Briefcase, Calendar, Users, FileEdit } from "lucide-react";
import { 
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator
} from "@/components/ui/breadcrumb";
import { useState, useEffect, useMemo } from "react";
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import { format } from "date-fns";
import { ja } from "date-fns/locale";

// 統合された議事録の型定義
type MeetingRecord = {
  id: number;
  title: string;
  meetingDate: string;
  content: string;
  type: 'manager' | 'weeklyReport';
  projectId?: number;
  projectName?: string;
  caseId?: number;
  caseName?: string;
  createdAt: string;
  modifiedBy?: string;
  weeklyReportId?: number;
};

export default function MeetingList() {
  const [location] = useLocation();
  const [selectedProject, setSelectedProject] = useState<string | null>(null);
  const [selectedCase, setSelectedCase] = useState<number | null>(null);
  const [selectedMeetingType, setSelectedMeetingType] = useState<'all' | 'manager' | 'weeklyReport'>('all');

  // URLパラメータから初期値を設定
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const url = new URL(window.location.href);
        const projectNameParam = url.searchParams.get('projectName');
        const caseIdParam = url.searchParams.get('caseId');
        const typeParam = url.searchParams.get('type');

        if (projectNameParam) {
          setSelectedProject(decodeURIComponent(projectNameParam));
        }

        if (caseIdParam) {
          const caseId = parseInt(caseIdParam);
          if (!isNaN(caseId)) {
            setSelectedCase(caseId);
          }
        }

        if (typeParam && (typeParam === 'manager' || typeParam === 'weeklyReport')) {
          setSelectedMeetingType(typeParam);
        }
      } catch (err) {
        console.error('Error parsing URL parameters:', err);
      }
    }
  }, [location]);

  // すべての案件を取得
  const { data: cases, isLoading: isLoadingCases } = useQuery<Case[]>({
    queryKey: ["/api/cases"],
    staleTime: 10 * 60 * 1000, // 10分間キャッシュ
  });

  // すべてのプロジェクトを取得（projectNameからprojectIdの逆引き用）
  const { data: projects, isLoading: isLoadingProjects } = useQuery<any[]>({
    queryKey: ["/api/projects"],
    staleTime: 2 * 60 * 1000, // 2分間キャッシュ（短縮）
  });

  // マネージャ定例議事録を取得
  const { data: managerMeetings, isLoading: isLoadingManagerMeetings } = useQuery<ManagerMeeting[]>({
    queryKey: ["/api/manager-meetings"],
    staleTime: 1 * 60 * 1000, // 1分間キャッシュ（短縮）
  });

  // 週次報告会議議事録を取得
  const { data: weeklyReportMeetings, isLoading: isLoadingWeeklyMeetings } = useQuery<WeeklyReportMeeting[]>({
    queryKey: ["/api/weekly-report-meetings"],  
    staleTime: 5 * 60 * 1000, // 5分間キャッシュ
  });

  // 選択された案件に紐づく週次報告会議議事録を取得
  const { data: caseWeeklyMeetings, isLoading: isLoadingCaseWeeklyMeetings } = useQuery<WeeklyReportMeeting[]>({
    queryKey: [`/api/weekly-report-meetings/by-case/${selectedCase}`],
    staleTime: 0,
    enabled: selectedCase !== null,
  });

  // 案件情報をIDでマップ化
  const caseMap = useMemo(() => 
    new Map(cases?.map(case_ => [case_.id, case_]) || []), 
    [cases]
  );

  // プロジェクト名でユニークなリストを作成し、アルファベット順にソート
  const projectNames = Array.from(new Set(cases?.map(case_ => case_.projectName) || []))
    .sort((a, b) => a.localeCompare(b, 'ja'));

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

  // 統合された議事録リストを作成
  const unifiedMeetings = useMemo((): MeetingRecord[] => {
    const meetings: MeetingRecord[] = [];

    // データが不完全な場合は空の配列を返す
    if (!cases || !managerMeetings) {
      console.log('[DEBUG] 必要なデータが不足しています:', {
        hasCases: !!cases,
        hasManagerMeetings: !!managerMeetings,
        hasProjects: !!projects
      });
      return meetings;
    }

    // 選択されたプロジェクトに該当する案件を取得
    const selectedProjectCases = cases?.filter(c => c.projectName === selectedProject) || [];
    const selectedProjectIds = Array.from(new Set(selectedProjectCases.map(c => c.projectName)));

    // マネージャ定例議事録を追加
    if (managerMeetings) {
      let targetProjectIds: number[] = [];
      let targetProjectName: string = '';
      
      console.log('[DEBUG] マネ定議事録抽出開始:', {
        selectedCase,
        selectedProject,
        managerMeetingsCount: managerMeetings.length,
        casesCount: cases?.length,
        projectsCount: projects?.length
      });
      
      if (selectedCase && cases) {
        // 案件選択時：選択された案件が属するプロジェクトの定例議事録を表示
        const selectedCaseData = cases.find(c => c.id === selectedCase);
        
        if (selectedCaseData) {
          console.log('[DEBUG] 選択された案件データ:', {
            caseId: selectedCaseData.id,
            caseName: selectedCaseData.caseName,
            projectName: selectedCaseData.projectName
          });
          
          // projectId の複数パターンでの取得を試行
          // 案件テーブルにはprojectIdフィールドが存在しないため、projectNameから逆引きする
          let projectId: number | undefined;
          
          // パターン1: projectNameからprojectIdを逆引き
          if (projects && selectedCaseData.projectName) {
            const matchingProject = projects.find(p => p.name === selectedCaseData.projectName);
            projectId = matchingProject?.id;
            console.log('[DEBUG] プロジェクト名による逆引き結果:', {
              searchName: selectedCaseData.projectName,
              foundProject: matchingProject,
              projectId
            });
          }
          
          // パターン2: プロジェクトデータが取得できない場合のフォールバック
          // 全てのマネ定議事の中から同じプロジェクト名を持つものを検索
          if (!projectId && selectedCaseData.projectName) {
            const matchingMeeting = managerMeetings.find(meeting => {
              // 議事録のタイトルにプロジェクト名が含まれているかチェック
              return meeting.title.includes(selectedCaseData.projectName);
            });
            
            if (matchingMeeting) {
              projectId = matchingMeeting.projectId;
              console.log('[DEBUG] マネ定議事録からのプロジェクトID推定:', {
                searchName: selectedCaseData.projectName,
                foundMeetingTitle: matchingMeeting.title,
                inferredProjectId: projectId
              });
            }
          }
          
          if (projectId) {
            targetProjectIds = [projectId];
            targetProjectName = selectedCaseData.projectName;
            console.log('[DEBUG] 案件選択時の対象プロジェクトID設定:', {
              targetProjectIds,
              targetProjectName
            });
          } else {
            console.warn('[DEBUG] プロジェクトIDが特定できませんでした:', selectedCaseData);
          }
        }
      } else if (selectedProject) {
        // 案件未選択時：選択されたプロジェクトの定例議事録を表示
        const selectedProjectCases = cases?.filter(c => c.projectName === selectedProject);
        
        // 複数のケースから projectId を収集
        // 案件テーブルにはprojectIdフィールドが存在しないため、projectNameから逆引きする
        const projectIdSet = new Set<number>();
        
        // projectName による逆引きも試行
        if (projectIdSet.size === 0 && projects) {
          const matchingProject = projects.find(p => p.name === selectedProject);
          if (matchingProject?.id) {
            projectIdSet.add(matchingProject.id);
          }
        }
        
        // さらにフォールバック: マネ定議事録からプロジェクトIDを推定
        if (projectIdSet.size === 0 && selectedProject) {
          const matchingMeetings = managerMeetings.filter(meeting => 
            meeting.title.includes(selectedProject)
          );
          
          matchingMeetings.forEach(meeting => {
            if (meeting.projectId) {
              projectIdSet.add(meeting.projectId);
            }
          });
          
          if (matchingMeetings.length > 0) {
            console.log('[DEBUG] マネ定議事録からプロジェクトIDを推定:', {
              selectedProject,
              matchingMeetingsCount: matchingMeetings.length,
              inferredProjectIds: Array.from(projectIdSet)
            });
          }
        }
        
        targetProjectIds = Array.from(projectIdSet);
        targetProjectName = selectedProject;
        
        console.log('[DEBUG] プロジェクト選択時の対象プロジェクトID設定:', {
          selectedProject,
          selectedProjectCasesCount: selectedProjectCases?.length,
          targetProjectIds,
          targetProjectName
        });
      }
      
      console.log('[DEBUG] 最終的な対象プロジェクトID:', targetProjectIds);
      
      if (targetProjectIds.length > 0) {
        let matchedCount = 0;
        managerMeetings.forEach(meeting => {
          console.log('[DEBUG] 議事録チェック:', {
            meetingId: meeting.id,
            meetingTitle: meeting.title,
            meetingProjectId: meeting.projectId,
            targetProjectIds,
            isMatch: targetProjectIds.includes(meeting.projectId)
          });
          
          // 議事録のprojectIdが対象プロジェクトに属するかチェック
          if (targetProjectIds.includes(meeting.projectId)) {
            matchedCount++;
            meetings.push({
              id: meeting.id,
              title: meeting.title,
              meetingDate: meeting.meetingDate,
              content: meeting.content,
              type: 'manager',
              projectId: meeting.projectId,
              projectName: targetProjectName,
              createdAt: meeting.createdAt.toISOString(),
            });
          }
        });
        
        console.log('[DEBUG] マネ定議事録抽出結果:', {
          totalManagerMeetings: managerMeetings.length,
          matchedCount,
          addedToMeetings: matchedCount
        });
      } else {
        console.log('[DEBUG] 対象プロジェクトIDが特定できないため、マネ定議事録は表示されません');
      }
    }

    // 週次報告会議議事録を追加（案件選択時のみ）
    if (selectedCase && caseWeeklyMeetings) {
      caseWeeklyMeetings.forEach(meeting => {
        const case_ = caseMap.get(selectedCase);
        meetings.push({
          id: meeting.id,
          title: meeting.title,
          meetingDate: meeting.meetingDate,
          content: meeting.content,
          type: 'weeklyReport',
          caseId: selectedCase,
          caseName: case_?.caseName,
          projectName: case_?.projectName,
          createdAt: meeting.createdAt.toISOString(),
          modifiedBy: meeting.modifiedBy,
          weeklyReportId: meeting.weeklyReportId,
        });
      });
    }

    // 開催日順にソート（新しい順）
    return meetings
      .filter(meeting => {
        if (selectedMeetingType === 'all') return true;
        return meeting.type === selectedMeetingType;
      })
      .sort((a, b) => new Date(b.meetingDate).getTime() - new Date(a.meetingDate).getTime());
  }, [managerMeetings, caseWeeklyMeetings, selectedProject, selectedCase, selectedMeetingType, cases, caseMap, projects]);

  // ローディング状態のチェック
  const isLoading = isLoadingCases || isLoadingProjects || isLoadingManagerMeetings || isLoadingWeeklyMeetings || 
    (selectedCase !== null && isLoadingCaseWeeklyMeetings);

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

  // 議事録タイプのフィルター変更
  const handleMeetingTypeChange = (type: 'all' | 'manager' | 'weeklyReport') => {
    setSelectedMeetingType(type);
  };

  // ローディング中の表示
  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-8 max-w-5xl">
          <p className="text-center">読み込み中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <ThemeToggle />

      <div className="container mx-auto px-4 py-8 max-w-5xl">
        <header className="mb-8">
          <div className="flex justify-between items-center mb-4">
            <h1 className="text-3xl font-bold text-primary">
              {selectedCase !== null ? "案件別議事録一覧" : "議事録一覧"}
            </h1>
            <div className="flex items-center gap-4">
              <Link href="/reports">
                <Button variant="outline" size="sm" className="flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  週次報告一覧
                </Button>
              </Link>
              <Link href="/cases">
                <Button variant="outline" size="sm" className="flex items-center gap-2">
                  <Briefcase className="h-4 w-4" />
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

        {/* パンくずリスト */}
        <Breadcrumb className="mt-2 mb-4">
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link href="/">
                  <span className="flex items-center gap-1">
                    <Home className="h-3.5 w-3.5" />
                    ホーム
                  </span>
                </Link>
              </BreadcrumbLink>
            </BreadcrumbItem>

            <BreadcrumbSeparator />

            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link href="/cases">
                  <span className="flex items-center gap-1">
                    <Briefcase className="h-3.5 w-3.5" />
                    案件一覧
                  </span>
                </Link>
              </BreadcrumbLink>
            </BreadcrumbItem>

            {selectedCase === null ? (
              <>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbPage>
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3.5 w-3.5" />
                      議事録一覧
                    </span>
                  </BreadcrumbPage>
                </BreadcrumbItem>
              </>
            ) : (
              <>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbLink asChild>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={resetCaseSelection}
                      className="flex items-center gap-1 h-auto p-0"
                    >
                      <Calendar className="h-3.5 w-3.5" />
                      議事録一覧
                    </Button>
                  </BreadcrumbLink>
                </BreadcrumbItem>

                <BreadcrumbSeparator />

                <BreadcrumbItem>
                  <BreadcrumbPage>
                    {caseMap.get(selectedCase)?.caseName}
                  </BreadcrumbPage>
                </BreadcrumbItem>
              </>
            )}
          </BreadcrumbList>
        </Breadcrumb>

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
                <div className="mb-6">
                  <h2 className="text-xl font-semibold mb-4">{projectName}の案件一覧</h2>
                  
                  {/* マネージャ定例議事録がある場合は表示 */}
                  {managerMeetings && managerMeetings.length > 0 && (
                    <div className="mb-4">
                      <Card className="border-blue-200 bg-blue-50 dark:bg-blue-950 dark:border-blue-800">
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <Users className="h-5 w-5 text-blue-600" />
                              <div>
                                <p className="font-semibold text-blue-900 dark:text-blue-100">
                                  {projectName} - マネージャ定例議事録
                                </p>
                                <p className="text-sm text-blue-600 dark:text-blue-300">
                                  プロジェクト全体の定例会議議事録
                                </p>
                              </div>
                            </div>
                            <Link href={`/project/name/${encodeURIComponent(projectName)}`}>
                              <Button variant="outline" size="sm" className="flex items-center gap-2">
                                <FileEdit className="h-4 w-4" />
                                詳細表示
                              </Button>
                            </Link>
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  )}
                  
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
                </div>
              </TabsContent>
            ))}
          </Tabs>
        )}

        {/* 選択された案件の議事録一覧 */}
        {selectedCase !== null && (
          <div className="mt-4">
            {/* 議事録タイプフィルター */}
            <div className="mb-4 flex gap-2">
              <Button
                variant={selectedMeetingType === 'all' ? 'default' : 'outline'}
                size="sm"
                onClick={() => handleMeetingTypeChange('all')}
              >
                すべて
              </Button>
              <Button
                variant={selectedMeetingType === 'manager' ? 'default' : 'outline'}
                size="sm"
                onClick={() => handleMeetingTypeChange('manager')}
              >
                定例会議
              </Button>
              <Button
                variant={selectedMeetingType === 'weeklyReport' ? 'default' : 'outline'}
                size="sm"
                onClick={() => handleMeetingTypeChange('weeklyReport')}
              >
                週次報告会議
              </Button>
            </div>

            {unifiedMeetings.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                この案件の議事録はまだありません
              </p>
            ) : (
              <div className="grid gap-4">
                {unifiedMeetings.map((meeting) => (
                  <Card key={`${meeting.type}-${meeting.id}`} className="hover:bg-accent/5">
                    <CardContent className="p-4">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            {meeting.type === 'manager' ? (
                              <Users className="h-4 w-4 text-blue-600" />
                            ) : (
                              <FileText className="h-4 w-4 text-green-600" />
                            )}
                            <span className="text-xs px-2 py-1 rounded-full bg-muted text-muted-foreground">
                              {meeting.type === 'manager' ? 'マネージャ定例' : '週次報告会議'}
                            </span>
                          </div>
                          <h3 className="font-semibold text-lg mb-2">{meeting.title}</h3>
                          <div className="text-sm text-muted-foreground mb-3">
                            <p>開催日: {format(new Date(meeting.meetingDate), 'yyyy年MM月dd日', { locale: ja })}</p>
                            {meeting.modifiedBy && (
                              <p>作成者: {meeting.modifiedBy}</p>
                            )}
                          </div>
                          <div className="prose prose-sm max-w-none dark:prose-invert">
                            <ReactMarkdown 
                              remarkPlugins={[remarkGfm]} 
                              rehypePlugins={[rehypeRaw]}
                            >
                              {meeting.content.length > 200 
                                ? `${meeting.content.substring(0, 200)}...` 
                                : meeting.content}
                            </ReactMarkdown>
                          </div>
                        </div>
                        <div className="ml-4 flex flex-col gap-2">
                          {meeting.type === 'manager' && meeting.projectId ? (
                            <Link href={`/project/${meeting.projectId}`}>
                              <Button variant="outline" size="sm">
                                プロジェクト詳細
                              </Button>
                            </Link>
                          ) : (
                            <Link href={`/reports/${meeting.weeklyReportId || meeting.id}?scrollTo=meetings`}>
                              <Button variant="outline" size="sm">
                                詳細表示
                              </Button>
                            </Link>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}