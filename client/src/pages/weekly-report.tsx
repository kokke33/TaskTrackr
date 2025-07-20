import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertWeeklyReportSchema, type WeeklyReport, type Case } from "@shared/schema";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect, useRef, useCallback } from "react";
import { useLocation, Link, useParams } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Send, Plus, Save, ShieldCheck, Target, FileText } from "lucide-react";
import { useAuth } from "@/lib/auth";
import CaseSelectorModal from "@/components/case-selector-modal";
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import { MilestoneDialog } from "@/components/milestone-dialog";
import { SampleReportDialog } from "@/components/sample-report-dialog";
import { AIAnalysisResult } from "@/components/ai-analysis-result";
import { useAIAnalysis } from "@/hooks/use-ai-analysis";
import { PreviousReportTooltip } from "@/components/previous-report-tooltip";

export default function WeeklyReport() {
  const { id } = useParams<{ id: string }>();
  const isEditMode = !!id;
  const reportId = id ? parseInt(id) : undefined;
  const { user } = useAuth();
  
  // URLパラメータから管理者編集モードを検出
  const [location] = useLocation();
  const urlParams = new URLSearchParams(window.location.search);
  const isAdminEditMode = urlParams.get('adminEdit') === 'true' && user?.isAdmin;
  
  // デバッグログ
  console.log('Debug - URL search:', window.location.search);
  console.log('Debug - adminEdit param:', urlParams.get('adminEdit'));
  console.log('Debug - user isAdmin:', user?.isAdmin);
  console.log('Debug - isAdminEditMode:', isAdminEditMode);

  const { data: existingReport, isLoading: isLoadingReport } = useQuery<WeeklyReport>({
    queryKey: [`/api/weekly-reports/${id}`],
    enabled: isEditMode,
  });

  // 案件一覧を取得
  const { data: cases, isLoading: isLoadingCases } = useQuery<Case[]>({
    queryKey: ["/api/cases"],
    staleTime: 0,
  });

  // 議事録を取得（編集モードの場合のみ）
  const { data: meetings } = useQuery<any[]>({
    queryKey: [`/api/weekly-reports/${id}/meetings`],
    enabled: isEditMode,
  });

  const { toast } = useToast();
  const [selectedCaseId, setSelectedCaseId] = useState<number | null>(null);
  const [, setLocation] = useLocation();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lastSavedTime, setLastSavedTime] = useState<string | null>(null);
  const [isAutosaving, setIsAutosaving] = useState(false);
  const queryClient = useQueryClient();
  
  // 管理者編集モード用の状態
  const [originalData, setOriginalData] = useState<WeeklyReport | null>(null);
  
  // 議事録編集の状態管理
  const [editingMeetings, setEditingMeetings] = useState<{[key: number]: {title: string, content: string}}>({});
  // 自動保存タイマーのためのref
  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);
  // フォームが変更されたかどうかの状態
  const [formChanged, setFormChanged] = useState(false);
  
  // 案件選択モーダルの状態
  const [isCaseSelectorOpen, setIsCaseSelectorOpen] = useState(false);
  
  // マイルストーンダイアログの状態管理
  const [showMilestoneDialog, setShowMilestoneDialog] = useState(false);
  
  // 記載サンプルダイアログの状態管理
  const [showSampleDialog, setShowSampleDialog] = useState(false);

  // AI分析機能
  const { analyzeField, clearAnalysis, getAnalysisState, regenerateAnalysis } = useAIAnalysis();

  // 議事録更新のミューテーション
  const updateMeetingMutation = useMutation({
    mutationFn: async ({ meetingId, title, content }: { meetingId: number, title: string, content: string }) => {
      const response = await fetch(`/api/weekly-reports/meetings/${meetingId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ title, content }),
        credentials: 'include',
      });
      
      if (!response.ok) {
        throw new Error('議事録の更新に失敗しました');
      }
      
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/weekly-reports/${id}/meetings`] });
      toast({
        title: "成功",
        description: "議事録が更新されました",
      });
    },
    onError: (error) => {
      toast({
        title: "エラー",
        description: "議事録の更新に失敗しました",
        variant: "destructive",
      });
    },
  });

  // 議事録編集のヘルパー関数
  const startEditingMeeting = (meetingId: number, title: string, content: string) => {
    setEditingMeetings(prev => ({
      ...prev,
      [meetingId]: { title, content }
    }));
  };

  const cancelEditingMeeting = (meetingId: number) => {
    setEditingMeetings(prev => {
      const newState = { ...prev };
      delete newState[meetingId];
      return newState;
    });
  };

  const saveMeeting = (meetingId: number) => {
    const editData = editingMeetings[meetingId];
    if (editData) {
      updateMeetingMutation.mutate({
        meetingId,
        title: editData.title,
        content: editData.content
      });
      cancelEditingMeeting(meetingId);
    }
  };

  const updateMeetingField = (meetingId: number, field: 'title' | 'content', value: string) => {
    setEditingMeetings(prev => ({
      ...prev,
      [meetingId]: {
        ...prev[meetingId],
        [field]: value
      }
    }));
  };

  // フォームの初期化
  const form = useForm<WeeklyReport>({
    resolver: zodResolver(insertWeeklyReportSchema),
    defaultValues: {
      caseId: 0,
      progressRate: 0,
      delayIssues: "no",
      newRisks: "no",
      qualityConcerns: "none",
      changes: "no",
      resourceConcerns: "none",
      customerIssues: "none",
      environmentIssues: "none",
      costIssues: "none",
      knowledgeIssues: "none",
      trainingIssues: "none",
      urgentIssues: "none",
      businessOpportunities: "none",
      reportPeriodStart: "",
      reportPeriodEnd: "",
      reporterName: "",
      weeklyTasks: "",
      progressStatus: "",
      issues: "",
      nextWeekPlan: "",
      supportRequests: "",
      delayDetails: "",
      riskSummary: "",
      riskCountermeasures: "",
      riskLevel: "",
      qualityDetails: "",
      testProgress: "",
      changeDetails: "",
      resourceDetails: "",
      customerDetails: "",
      environmentDetails: "",
      costDetails: "",
      knowledgeDetails: "",
      trainingDetails: "",
      urgentDetails: "",
      businessDetails: "",
    },
  });

  // 選択された案件の前回報告を取得（編集対象の報告期間より前の最新報告）
  const { data: latestReport, isLoading: isLoadingLatest } = useQuery<WeeklyReport>({
    queryKey: [`/api/weekly-reports/previous/${selectedCaseId}`, reportId, existingReport?.reportPeriodStart],
    queryFn: async () => {
      // 編集モードでは必ずexistingReportのreportPeriodStartを使用
      let reportPeriodStart: string | undefined;
      
      if (isEditMode && existingReport) {
        reportPeriodStart = existingReport.reportPeriodStart;
        console.log("前回報告取得 - 編集モード:", {
          editingReportId: reportId,
          editingReportPeriod: reportPeriodStart,
          selectedCaseId
        });
      } else {
        reportPeriodStart = form.getValues("reportPeriodStart");
        console.log("前回報告取得 - 新規作成モード:", {
          formReportPeriod: reportPeriodStart,
          selectedCaseId
        });
      }
      
      if (!reportPeriodStart) {
        // 報告期間が設定されていない場合は従来の最新報告を取得
        const excludeParam = reportId ? `?excludeId=${reportId}` : '';
        console.log("前回報告取得 - 最新報告フォールバック:", excludeParam);
        return apiRequest(`/api/weekly-reports/latest/${selectedCaseId}${excludeParam}`, { method: "GET" });
      }
      
      // 報告期間が設定されている場合は、その日付より前の前回報告を取得
      const params = new URLSearchParams({
        beforeDate: reportPeriodStart
      });
      if (reportId) {
        params.append('excludeId', reportId.toString());
      }
      
      console.log("前回報告取得 - 期間ベース:", {
        beforeDate: reportPeriodStart,
        excludeId: reportId,
        url: `/api/weekly-reports/previous/${selectedCaseId}?${params.toString()}`
      });
      
      try {
        const result = await apiRequest(`/api/weekly-reports/previous/${selectedCaseId}?${params.toString()}`, { method: "GET" });
        console.log("前回報告取得成功:", result);
        return result;
      } catch (error) {
        console.error("前回報告取得エラー:", error);
        throw error;
      }
    },
    enabled: !!selectedCaseId && (!isEditMode || (!!existingReport && !!existingReport.reportPeriodStart)),
  });

  // latestReportデータの確認用ログ
  useEffect(() => {
    if (latestReport) {
      console.log("latestReport取得完了:", {
        id: latestReport.id,
        hasWeeklyTasks: !!latestReport.weeklyTasks,
        hasIssues: !!latestReport.issues,
        weeklyTasksLength: latestReport.weeklyTasks?.length,
        issuesLength: latestReport.issues?.length,
        reportPeriod: `${latestReport.reportPeriodStart} - ${latestReport.reportPeriodEnd}`,
        // デバッグ用: 現在編集中の報告との比較
        isEditingReport: latestReport.id === reportId,
        editingReportId: reportId,
        editingReportPeriod: existingReport ? `${existingReport.reportPeriodStart} - ${existingReport.reportPeriodEnd}` : 'なし'
      });
    } else {
      console.log("latestReport:", latestReport, "isLoading:", isLoadingLatest, "selectedCaseId:", selectedCaseId);
    }
  }, [latestReport, isLoadingLatest, reportId, existingReport]);

  // フィールド名マッピング（日本語 → 英語フィールド名）
  const fieldNameMapping: Record<string, keyof WeeklyReport> = {
    "今週の作業内容": "weeklyTasks",
    "遅延・問題点の詳細": "delayDetails",
    "課題・問題点": "issues",
    "リスクの概要": "riskSummary",
    "新たなリスク（総合分析）": "riskSummary", // 総合分析は同じフィールドを使用
    "品質懸念事項の詳細": "qualityDetails",
    "品質（総合分析）": "qualityDetails", // 総合分析は同じフィールドを使用
    "変更内容の詳細": "changeDetails",
    "来週の作業予定": "nextWeekPlan",
    "支援・判断の要望事項": "supportRequests",
    "リソース懸念事項": "resourceDetails",
    "顧客懸念事項": "customerDetails",
    "環境懸念事項": "environmentDetails",
    "コスト懸念事項": "costDetails",
    "知識・スキル懸念事項": "knowledgeDetails",
    "教育懸念事項": "trainingDetails",
    "緊急課題の詳細": "urgentDetails",
    "営業チャンス・顧客ニーズ": "businessDetails",
  };

  // 再生成機能のヘルパー関数
  const createRegenerateHandler = useCallback((fieldName: string) => {
    return () => {
      console.log("createRegenerateHandler called for field:", fieldName);
      
      // 日本語フィールド名を英語フィールド名にマッピング
      const englishFieldName = fieldNameMapping[fieldName];
      if (!englishFieldName) {
        console.error("Field mapping not found for:", fieldName);
        return;
      }
      
      const formValues = form.getValues();
      const currentValue = formValues[englishFieldName] as string;
      const originalValue = originalData?.[englishFieldName] as string;
      const previousReportValue = latestReport?.[englishFieldName] as string;
      
      console.log("regenerate values:", {
        fieldName,
        englishFieldName,
        currentValue,
        currentValueLength: currentValue?.length,
        originalValue,
        previousReportValue
      });
      
      if (currentValue && currentValue.trim().length >= 10) {
        console.log("Calling regenerateAnalysis...");
        regenerateAnalysis(fieldName, currentValue, originalValue, previousReportValue);
      } else {
        console.log("Skipping regeneration - content too short or empty");
      }
    };
  }, [form, regenerateAnalysis, originalData, latestReport]);

  // 自動保存処理
  const autoSave = useCallback(async () => {
    if (!formChanged) return;

    try {
      setIsAutosaving(true);
      const data = form.getValues();

      // 編集モードと新規作成モードで異なるエンドポイントを使用
      let url = "/api/weekly-reports/autosave";
      let method = "POST";

      if (isEditMode && id) {
        url = `/api/weekly-reports/${id}/autosave`;
        method = "PUT";
      }

      const response = await fetch(url, {
        method: method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
        credentials: "include", // 重要: クッキーを送信するために必要
      });

      if (!response.ok) {
        throw new Error("自動保存に失敗しました");
      }

      const result = await response.json();
      const now = new Date().toLocaleTimeString();
      setLastSavedTime(now);
      setFormChanged(false);

      // 新規作成モードで自動保存が成功し、IDが返ってきた場合は、
      // 編集モードに切り替えるためにIDをセット
      if (!isEditMode && result.id) {
        // URLを変更せずに内部状態だけ更新
        window.history.replaceState(null, '', `/report/edit/${result.id}`);
      }

      console.log("Auto-saved at:", now, result);
    } catch (error) {
      console.error("Error auto-saving report:", error);
    } finally {
      setIsAutosaving(false);
    }
  }, [isEditMode, id, form, formChanged]);

  // フォーム変更の監視
  useEffect(() => {
    const subscription = form.watch((value, { name, type }) => {
      if (type === "change") {
        setFormChanged(true);
      }
    });
    return () => subscription.unsubscribe();
  }, [form]);

  // 自動保存タイマーの設定
  useEffect(() => {
    // 編集モードでも新規作成モードでも自動保存を有効にする
    // 5分ごとに自動保存する
    autoSaveTimerRef.current = setInterval(() => {
      autoSave();
    }, 5 * 60 * 1000);

    // クリーンアップ
    return () => {
      if (autoSaveTimerRef.current) {
        clearInterval(autoSaveTimerRef.current);
      }
    };
  }, [autoSave]);

  // 明示的に自動保存を行う関数
  const handleManualAutoSave = async () => {
    await autoSave();
    toast({
      title: "自動保存しました",
      description: `${new Date().toLocaleTimeString()}に保存されました`,
    });
  };

  useEffect(() => {
    if (isEditMode && existingReport) {
      Object.entries(existingReport).forEach(([key, value]) => {
        form.setValue(key as keyof WeeklyReport, value || "");
      });
      setSelectedCaseId(existingReport.caseId);
    }
  }, [existingReport, form, isEditMode]);

  // 管理者編集モード用のuseEffect
  useEffect(() => {
    if (isAdminEditMode && isEditMode) {
      // セッションストレージから元データを取得
      const storedOriginalData = sessionStorage.getItem(`adminEdit_original_${id}`);
      if (storedOriginalData) {
        try {
          const parsedData = JSON.parse(storedOriginalData);
          setOriginalData(parsedData);
          toast({
            title: "管理者編集モード",
            description: "管理者編集モードが有効になりました",
          });
        } catch (error) {
          console.error('Failed to parse stored original data:', error);
          toast({
            title: "エラー",
            description: "元データの取得に失敗しました",
            variant: "destructive",
          });
        }
      } else {
        // セッションストレージにデータがない場合、詳細画面に戻る
        toast({
          title: "エラー",
          description: "管理者編集モードの準備ができていません",
          variant: "destructive",
        });
        setLocation(`/reports/${id}`);
      }
    }
  }, [isAdminEditMode, isEditMode, id, setLocation]);

  const onSubmit = async (data: WeeklyReport) => {
    if (isSubmitting) return;

    try {
      setIsSubmitting(true);
      
      // 管理者編集モードの場合は専用のエンドポイントを使用
      if (isAdminEditMode && originalData) {
        const response = await fetch(`/api/weekly-reports/${id}/admin-edit-complete`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            originalData,
            updatedData: data
          }),
          credentials: "include",
        });

        if (!response.ok) {
          throw new Error("管理者編集の完了に失敗しました");
        }

        const result = await response.json();

        // セッションストレージをクリア
        sessionStorage.removeItem(`adminEdit_original_${id}`);

        toast({
          title: "修正完了",
          description: "修正と議事録生成が完了しました",
        });
        setLocation(`/reports/${id}`);
        return;
      }

      // 通常の編集・新規作成
      const url = isEditMode ? `/api/weekly-reports/${id}` : "/api/weekly-reports";
      const method = isEditMode ? "PUT" : "POST";

      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error("送信に失敗しました");
      }

      const result = await response.json();

      toast({
        title: isEditMode ? "報告が更新されました" : "報告が送信されました",
        description: isEditMode
          ? "週次報告が正常に更新されました。"
          : "週次報告が正常に送信されました。",
      });

      setLocation(`/reports/${result.id}`);
    } catch (error) {
      console.error("Error submitting report:", error);
      toast({
        title: "エラー",
        description: isAdminEditMode 
          ? "管理者編集の完了に失敗しました。"
          : isEditMode
          ? "週次報告の更新に失敗しました。"
          : "週次報告の送信に失敗しました。",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const copyFromLastReport = async () => {
    if (!selectedCaseId || !latestReport) {
      return;
    }

    // 前回の報告から値をコピー
    const fieldsToExclude = ["id", "createdAt", "reportPeriodStart", "reportPeriodEnd"];
    Object.entries(latestReport).forEach(([key, value]) => {
      if (!fieldsToExclude.includes(key)) {
        form.setValue(key as keyof WeeklyReport, value || "");
      }
    });

    // 現在の日付に基づいて報告期間を設定
    const today = new Date();
    const dayOfWeek = today.getDay();
    const monday = new Date(today);
    monday.setDate(today.getDate() - dayOfWeek + 1);
    const friday = new Date(monday);
    friday.setDate(monday.getDate() + 4);

    form.setValue("reportPeriodStart", monday.toISOString().split("T")[0]);
    form.setValue("reportPeriodEnd", friday.toISOString().split("T")[0]);

    toast({
      title: "前回の報告をコピーしました",
      description: "報告内容を確認・編集してください。",
    });
  };

  if ((isEditMode && isLoadingReport) || isLoadingCases) {
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
      {/* Header */}
      <div className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4">
          <div className="flex h-14 items-center justify-between">
            <h1 className="text-xl font-semibold">
              {isAdminEditMode ? (
                <span className="flex items-center gap-2 text-red-600">
                  <ShieldCheck className="h-5 w-5" />
                  週次報告管理者編集
                </span>
              ) : isEditMode ? "週次報告編集" : "週次報告フォーム"}
            </h1>
            <div className="flex items-center gap-2">
              <Button 
                type="button"
                onClick={() => setShowMilestoneDialog(true)}
                variant="outline"
                size="sm"
                className="flex items-center gap-2 text-blue-600 border-blue-200 hover:bg-blue-50"
              >
                <Target className="h-4 w-4" />
                マイルストーン
              </Button>
              <Button
                type="button"
                onClick={() => setShowSampleDialog(true)}
                variant="outline"
                size="sm"
                className="flex items-center gap-2 text-green-600 border-green-200 hover:bg-green-50"
              >
                <FileText className="h-4 w-4" />
                記載サンプル
              </Button>
              <Link href={isEditMode ? `/reports/${id}` : "/reports"}>
                <Button variant="ghost" size="sm">
                  戻る
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
            {/* 基本情報 */}
            <div className="p-6 bg-card rounded-lg shadow-sm">
              <header className="mb-8">
                <div className="flex flex-col gap-4 mb-2">
                  <div className="flex items-center justify-between">
                    <h1 className="text-3xl font-bold text-primary">
                      {isAdminEditMode ? (
                        <span className="flex items-center gap-2 text-red-600">
                          <ShieldCheck className="h-5 w-5" />
                          週次報告管理者編集
                        </span>
                      ) : isEditMode ? "週次報告編集" : "週次報告フォーム"}
                    </h1>
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleManualAutoSave}
                        disabled={isAutosaving || !formChanged}
                        className="flex items-center gap-1"
                      >
                        <Save className="h-4 w-4" />
                        {isAutosaving ? "保存中..." : "自動保存"}
                      </Button>
                      {lastSavedTime && (
                        <span className="text-xs text-muted-foreground">
                          最終保存: {lastSavedTime}
                        </span>
                      )}
                    </div>
                  </div>
                  {selectedCaseId && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={copyFromLastReport}
                      className="w-fit"
                    >
                      前回の報告をコピー
                    </Button>
                  )}
                </div>
              </header>

              <div className="space-y-4">
                <FormField
                  control={form.control}
                  name="reportPeriodStart"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="required">報告期間</FormLabel>
                      <div className="flex gap-2 items-center">
                        <FormControl>
                          <Input
                            type="date"
                            {...field}
                            onChange={(e) => {
                              field.onChange(e);
                              const date = new Date(e.target.value);
                              const endDate = new Date(date);
                              endDate.setDate(date.getDate() + 7);
                              form.setValue(
                                "reportPeriodEnd",
                                endDate.toISOString().split("T")[0],
                              );
                            }}
                          />
                        </FormControl>
                        <span>～</span>
                        <FormControl>
                          <Input
                            type="date"
                            {...form.register("reportPeriodEnd")}
                            disabled
                          />
                        </FormControl>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="caseId"
                  render={({ field }) => {
                    const selectedCase = cases?.find(c => c.id === field.value);
                    
                    return (
                      <FormItem>
                        <FormLabel className="required">案件</FormLabel>
                        <div className="flex items-center gap-2">
                          <FormControl>
                            <Button
                              type="button"
                              variant="outline"
                              className="w-full justify-start text-left font-normal"
                              onClick={() => setIsCaseSelectorOpen(true)}
                            >
                              {selectedCase ? (
                                <div className="flex flex-col items-start">
                                  <span className="font-medium">{selectedCase.caseName}</span>
                                  <span className="text-xs text-muted-foreground">{selectedCase.projectName}</span>
                                </div>
                              ) : (
                                <span className="text-muted-foreground">案件を選択してください</span>
                              )}
                            </Button>
                          </FormControl>
                          <Link href="/case/new">
                            <Button variant="outline" size="icon" type="button">
                              <Plus className="h-4 w-4" />
                            </Button>
                          </Link>
                        </div>
                        <FormMessage />
                      </FormItem>
                    );
                  }}
                />

                <FormField
                  control={form.control}
                  name="reporterName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="required">報告者氏名</FormLabel>
                      <FormControl>
                        <Input placeholder="例: 山田太郎" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* 今週の作業内容 */}
            <div className="p-6 bg-card rounded-lg shadow-sm">
              <h2 className="text-xl font-semibold mb-4 pb-2 border-b">
                2. 今週の作業内容
              </h2>

              <FormField
                control={form.control}
                name="weeklyTasks"
                render={({ field }) => (
                  <FormItem>
                    <div className="flex items-center">
                      <FormLabel className="required">今週の作業内容</FormLabel>
                      <PreviousReportTooltip 
                        previousContent={latestReport?.weeklyTasks}
                        fieldName="今週の作業内容"
                      />
                    </div>
                    <FormControl>
                      <Textarea
                        placeholder="作業項目、計画との差異、遅延理由、リスク評価などを記述してください"
                        className="h-32"
                        {...field}
                        onBlur={(e) => {
                          field.onBlur?.();
                          console.log("AI分析実行 - 今週の作業内容:", {
                            currentValue: e.target.value,
                            existingReport: existingReport?.weeklyTasks,
                            latestReport: latestReport?.weeklyTasks,
                            latestReportExists: !!latestReport
                          });
                          analyzeField("今週の作業内容", e.target.value, existingReport?.weeklyTasks || undefined, latestReport?.weeklyTasks || undefined);
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                    <AIAnalysisResult
                      analysis={getAnalysisState("今週の作業内容").analysis}
                      isLoading={getAnalysisState("今週の作業内容").isLoading}
                      error={getAnalysisState("今週の作業内容").error}
                      onClear={() => clearAnalysis("今週の作業内容")}
                      onRegenerate={createRegenerateHandler("今週の作業内容")}
                      fieldName="今週の作業内容"
                    />
                  </FormItem>
                )}
              />
            </div>

            {/* 進捗状況 */}
            <div className="p-6 bg-card rounded-lg shadow-sm">
              <h2 className="text-xl font-semibold mb-4 pb-2 border-b">
                3. 進捗状況
              </h2>

              <div className="space-y-4">
                <FormField
                  control={form.control}
                  name="progressRate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="required">
                        進捗率 (0～100%)
                      </FormLabel>
                      <div className="flex items-center gap-4">
                        <FormControl>
                          <Input
                            type="range"
                            min="0"
                            max="100"
                            className="w-full"
                            {...field}
                            onChange={(e) =>
                              field.onChange(parseInt(e.target.value))
                            }
                          />
                        </FormControl>
                        <FormControl>
                          <Input
                            type="number"
                            min="0"
                            max="100"
                            className="w-20"
                            {...field}
                            onChange={(e) =>
                              field.onChange(parseInt(e.target.value))
                            }
                          />
                        </FormControl>
                        <span>%</span>
                      </div>
                      <div className="text-sm text-muted-foreground mt-2">
                        <p className="mb-1">進捗率の計算方法の例:</p>
                        <ul className="list-disc pl-5 space-y-1">
                          <li>マイルストーンベース: 達成したマイルストーン ÷ 全マイルストーン数</li>
                          <li>タスクベース: 完了したタスク数 ÷ 全タスク数</li>
                          <li>工数ベース: 消費した工数 ÷ 計画工数</li>
                          <li>成果物ベース: 完成した成果物の割合</li>
                        </ul>
                        <p className="mt-2">※ 一貫した計算方法を使用することで、週ごとの比較が容易になります。</p>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="progressStatus"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="required">
                        計画比の進捗状況
                      </FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="選択してください" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="on-schedule">予定通り（計画の±5%以内）</SelectItem>
                          <SelectItem value="slightly-delayed">
                            少し遅れている（計画より5〜15%遅延）
                          </SelectItem>
                          <SelectItem value="severely-delayed">
                            大幅に遅れている（計画より15%以上遅延）
                          </SelectItem>
                          <SelectItem value="ahead">前倒しで進行中（計画より5%以上前倒し）</SelectItem>
                        </SelectContent>
                      </Select>
                      <div className="text-sm text-muted-foreground mt-2">
                        進捗状況は、計画工数や計画タスク数との比較、または主要なマイルストーンの達成予定日との比較に基づいて評価してください。
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="delayIssues"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="required">
                        進捗遅延・問題点の有無
                      </FormLabel>
                      <FormControl>
                        <RadioGroup
                          onValueChange={field.onChange}
                          defaultValue={field.value}
                          className="flex gap-4"
                        >
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="yes" id="delay-yes" />
                            <label htmlFor="delay-yes">あり</label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="no" id="delay-no" />
                            <label htmlFor="delay-no">なし</label>
                          </div>
                        </RadioGroup>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {form.watch("delayIssues") === "yes" && (
                  <FormField
                    control={form.control}
                    name="delayDetails"
                    render={({ field }) => (
                      <FormItem>
                        <div className="flex items-center">
                          <FormLabel className="required">
                            遅延・問題点の詳細
                          </FormLabel>
                          <PreviousReportTooltip 
                            previousContent={latestReport?.delayDetails}
                            fieldName="遅延・問題点の詳細"
                          />
                        </div>
                        <FormControl>
                          <Textarea
                            placeholder="遅延や問題の詳細、原因、影響範囲などを記述してください"
                            className="h-24"
                            {...field}
                            value={field.value ?? ""} // nullの場合は空文字列を渡す
                            onBlur={(e) => {
                              field.onBlur?.();
                              analyzeField("遅延・問題点の詳細", e.target.value, existingReport?.delayDetails || undefined, latestReport?.delayDetails || undefined);
                            }}
                          />
                        </FormControl>
                        <FormMessage />
                        <AIAnalysisResult
                          fieldName="遅延・問題点の詳細"
                          analysis={getAnalysisState("遅延・問題点の詳細").analysis}
                          isLoading={getAnalysisState("遅延・問題点の詳細").isLoading}
                          error={getAnalysisState("遅延・問題点の詳細").error}
                          onClear={() => clearAnalysis("遅延・問題点の詳細")}
                          onRegenerate={createRegenerateHandler("遅延・問題点の詳細")}
                        />
                      </FormItem>
                    )}
                  />
                )}
              </div>
            </div>

            {/* 課題・問題点 */}
            <div className="p-6 bg-card rounded-lg shadow-sm">
              <h2 className="text-xl font-semibold mb-4 pb-2 border-b">
                4. 課題・問題点
              </h2>
              <FormField
                control={form.control}
                name="issues"
                render={({ field }) => (
                  <FormItem>
                    <div className="flex items-center">
                      <FormLabel className="required">課題・問題点</FormLabel>
                      <PreviousReportTooltip 
                        previousContent={latestReport?.issues}
                        fieldName="課題・問題点"
                      />
                    </div>
                    <FormControl>
                      <Textarea
                        placeholder="現在直面している課題や問題点を記述してください"
                        className="h-24"
                        {...field}
                        onBlur={(e) => {
                          field.onBlur?.();
                          console.log("AI分析実行 - 課題・問題点:", {
                            currentValue: e.target.value,
                            existingReport: existingReport?.issues,
                            latestReport: latestReport?.issues,
                            latestReportExists: !!latestReport
                          });
                          analyzeField("課題・問題点", e.target.value, existingReport?.issues || undefined, latestReport?.issues || undefined);
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                    <AIAnalysisResult
                      analysis={getAnalysisState("課題・問題点").analysis}
                      isLoading={getAnalysisState("課題・問題点").isLoading}
                      error={getAnalysisState("課題・問題点").error}
                      onClear={() => clearAnalysis("課題・問題点")}
                      onRegenerate={createRegenerateHandler("課題・問題点")}
                      fieldName="課題・問題点"
                    />
                  </FormItem>
                )}
              />
            </div>

            {/* 新たなリスク */}
            <div className="p-6 bg-card rounded-lg shadow-sm">
              <h2 className="text-xl font-semibold mb-4 pb-2 border-b">
                5. 新たなリスク
              </h2>
              <div className="space-y-4">
                <FormField
                  control={form.control}
                  name="newRisks"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="required">
                        新たなリスクの有無
                      </FormLabel>
                      <FormControl>
                        <RadioGroup
                          onValueChange={field.onChange}
                          defaultValue={field.value}
                          className="flex gap-4"
                        >
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="yes" id="risk-yes" />
                            <label htmlFor="risk-yes">あり</label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="no" id="risk-no" />
                            <label htmlFor="risk-no">なし</label>
                          </div>
                        </RadioGroup>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {form.watch("newRisks") === "yes" && (
                  <>
                    <FormField
                      control={form.control}
                      name="riskSummary"
                      render={({ field }) => (
                        <FormItem>
                          <div className="flex items-center">
                            <FormLabel className="required">
                              リスクの概要
                            </FormLabel>
                            <PreviousReportTooltip 
                              previousContent={latestReport?.riskSummary}
                              fieldName="リスクの概要"
                            />
                          </div>
                          <FormControl>
                            <Textarea
                              placeholder="新たに発見されたリスクの概要を記述してください"
                              className="h-24"
                              {...field}
                              value={field.value ?? ""}
                              onBlur={field.onBlur}
                            />
                          </FormControl>
                          <FormMessage />
                          <AIAnalysisResult
                            fieldName="リスクの概要"
                            analysis={getAnalysisState("リスクの概要").analysis}
                            isLoading={getAnalysisState("リスクの概要").isLoading}
                            error={getAnalysisState("リスクの概要").error}
                            onClear={() => clearAnalysis("リスクの概要")}
                            onRegenerate={createRegenerateHandler("リスクの概要")}
                          />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="riskCountermeasures"
                      render={({ field }) => (
                        <FormItem>
                          <div className="flex items-center">
                            <FormLabel className="required">対策</FormLabel>
                            <PreviousReportTooltip 
                              previousContent={latestReport?.riskCountermeasures}
                              fieldName="リスク対策"
                            />
                          </div>
                          <FormControl>
                            <Textarea
                              placeholder="リスクに対する対策を記述してください"
                              className="h-24"
                              {...field}
                              value={field.value ?? ""}
                              onBlur={(e) => {
                                field.onBlur?.();
                                // リスクの概要と対策を組み合わせてAI分析
                                const riskSummary = form.getValues("riskSummary") || "";
                                const riskCountermeasures = e.target.value || "";
                                const combinedContent = `【リスクの概要】\n${riskSummary}\n\n【対策】\n${riskCountermeasures}`;
                                
                                // 前回報告の組み合わせコンテンツも作成
                                const prevRiskSummary = latestReport?.riskSummary || "";
                                const prevRiskCountermeasures = latestReport?.riskCountermeasures || "";
                                const prevCombinedContent = prevRiskSummary || prevRiskCountermeasures 
                                  ? `【リスクの概要】\n${prevRiskSummary}\n\n【対策】\n${prevRiskCountermeasures}`
                                  : undefined;
                                
                                // 既存報告の組み合わせコンテンツも作成
                                const existingRiskSummary = existingReport?.riskSummary || "";
                                const existingRiskCountermeasures = existingReport?.riskCountermeasures || "";
                                const existingCombinedContent = existingRiskSummary || existingRiskCountermeasures
                                  ? `【リスクの概要】\n${existingRiskSummary}\n\n【対策】\n${existingRiskCountermeasures}`
                                  : undefined;
                                
                                analyzeField("新たなリスク（総合分析）", combinedContent, existingCombinedContent, prevCombinedContent);
                              }}
                            />
                          </FormControl>
                          <FormMessage />
                          <AIAnalysisResult
                            fieldName="新たなリスク（総合分析）"
                            analysis={getAnalysisState("新たなリスク（総合分析）").analysis}
                            isLoading={getAnalysisState("新たなリスク（総合分析）").isLoading}
                            error={getAnalysisState("新たなリスク（総合分析）").error}
                            onClear={() => clearAnalysis("新たなリスク（総合分析）")}
                            onRegenerate={createRegenerateHandler("新たなリスク（総合分析）")}
                          />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="riskLevel"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="required">
                            リスクレベル
                          </FormLabel>
                          <Select
                            onValueChange={field.onChange}
                            defaultValue={field.value ?? ""}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="選択してください" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="high">高</SelectItem>
                              <SelectItem value="medium">中</SelectItem>
                              <SelectItem value="low">低</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </>
                )}
              </div>
            </div>

            {/* 品質 */}
            <div className="p-6 bg-card rounded-lg shadow-sm">
              <h2 className="text-xl font-semibold mb-4 pb-2 border-b">
                6. 品質
              </h2>
              <div className="space-y-4">
                <FormField
                  control={form.control}
                  name="qualityConcerns"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="required">
                        品質懸念事項の有無
                      </FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="選択してください" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="none">なし</SelectItem>
                          <SelectItem value="minor">軽微な懸念あり</SelectItem>
                          <SelectItem value="major">重大な懸念あり</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {form.watch("qualityConcerns") !== "none" && (
                  <FormField
                    control={form.control}
                    name="qualityDetails"
                    render={({ field }) => (
                      <FormItem>
                        <div className="flex items-center">
                          <FormLabel className="required">
                            品質懸念事項の詳細
                          </FormLabel>
                          <PreviousReportTooltip 
                            previousContent={latestReport?.qualityDetails}
                            fieldName="品質懸念事項の詳細"
                          />
                        </div>
                        <FormControl>
                          <Textarea
                            placeholder="品質に関する懸念事項の詳細を記述してください"
                            className="h-24"
                            {...field}
                            value={field.value ?? ""}
                            onBlur={field.onBlur}
                          />
                        </FormControl>
                        <FormMessage />
                        <AIAnalysisResult
                          fieldName="品質懸念事項の詳細"
                          analysis={getAnalysisState("品質懸念事項の詳細").analysis}
                          isLoading={getAnalysisState("品質懸念事項の詳細").isLoading}
                          error={getAnalysisState("品質懸念事項の詳細").error}
                          onClear={() => clearAnalysis("品質懸念事項の詳細")}
                          onRegenerate={createRegenerateHandler("品質懸念事項の詳細")}
                        />
                      </FormItem>
                    )}
                  />
                )}

                <FormField
                  control={form.control}
                  name="testProgress"
                  render={({ field }) => (
                    <FormItem>
                      <div className="flex items-center">
                        <FormLabel>進捗状況</FormLabel>
                        <PreviousReportTooltip 
                          previousContent={latestReport?.testProgress}
                          fieldName="進捗状況"
                        />
                      </div>
                      <FormControl>
                        <Textarea
                          placeholder="進捗状況を記述してください"
                          className="h-24"
                          {...field}
                          value={field.value ?? ""}
                          onBlur={(e) => {
                            field.onBlur?.();
                            // 品質懸念事項の詳細と進捗状況を組み合わせてAI分析
                            const qualityDetails = form.getValues("qualityDetails") || "";
                            const testProgress = e.target.value || "";
                            const combinedContent = `【品質懸念事項の詳細】\n${qualityDetails}\n\n【進捗状況】\n${testProgress}`;
                            
                            // 前回報告の組み合わせコンテンツも作成
                            const prevQualityDetails = latestReport?.qualityDetails || "";
                            const prevTestProgress = latestReport?.testProgress || "";
                            const prevCombinedContent = prevQualityDetails || prevTestProgress
                              ? `【品質懸念事項の詳細】\n${prevQualityDetails}\n\n【進捗状況】\n${prevTestProgress}`
                              : undefined;
                            
                            // 既存報告の組み合わせコンテンツも作成
                            const existingQualityDetails = existingReport?.qualityDetails || "";
                            const existingTestProgress = existingReport?.testProgress || "";
                            const existingCombinedContent = existingQualityDetails || existingTestProgress
                              ? `【品質懸念事項の詳細】\n${existingQualityDetails}\n\n【進捗状況】\n${existingTestProgress}`
                              : undefined;
                            
                            analyzeField("品質（総合分析）", combinedContent, existingCombinedContent, prevCombinedContent);
                          }}
                        />
                      </FormControl>
                      <FormMessage />
                      <AIAnalysisResult
                        fieldName="品質（総合分析）"
                        analysis={getAnalysisState("品質（総合分析）").analysis}
                        isLoading={getAnalysisState("品質（総合分析）").isLoading}
                        error={getAnalysisState("品質（総合分析）").error}
                        onClear={() => clearAnalysis("品質（総合分析）")}
                        onRegenerate={createRegenerateHandler("品質（総合分析）")}
                      />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* 変更管理 */}
            <div className="p-6 bg-card rounded-lg shadow-sm">
              <h2 className="text-xl font-semibold mb-4 pb-2 border-b">
                7. 変更管理
              </h2>
              <div className="space-y-4">
                <FormField
                  control={form.control}
                  name="changes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="required">変更の有無</FormLabel>
                      <FormControl>
                        <RadioGroup
                          onValueChange={field.onChange}
                          defaultValue={field.value}
                          className="flex gap-4"
                        >
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="yes" id="changes-yes" />
                            <label htmlFor="changes-yes">あり</label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="no" id="changes-no" />
                            <label htmlFor="changes-no">なし</label>
                          </div>
                        </RadioGroup>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {form.watch("changes") === "yes" && (
                  <FormField
                    control={form.control}
                    name="changeDetails"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="required">
                          変更内容の詳細
                        </FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="変更内容、影響範囲、対応状況などを記述してください"
                            className="h-24"
                            {...field}
                            value={field.value ?? ""}
                            onBlur={(e) => {
                              field.onBlur?.();
                              analyzeField("変更内容の詳細", e.target.value, existingReport?.changeDetails || undefined, latestReport?.changeDetails || undefined);
                            }}
                          />
                        </FormControl>
                        <FormMessage />
                        <AIAnalysisResult
                          fieldName="変更内容の詳細"
                          analysis={getAnalysisState("変更内容の詳細").analysis}
                          isLoading={getAnalysisState("変更内容の詳細").isLoading}
                          error={getAnalysisState("変更内容の詳細").error}
                          onClear={() => clearAnalysis("変更内容の詳細")}
                          onRegenerate={createRegenerateHandler("変更内容の詳細")}
                        />
                      </FormItem>
                    )}
                  />
                )}
              </div>
            </div>

            {/* 来週の予定 */}
            <div className="p-6 bg-card rounded-lg shadow-sm">
              <h2 className="text-xl font-semibold mb-4 pb-2 border-b">
                8. 来週の予定
              </h2>
              <FormField
                control={form.control}
                name="nextWeekPlan"
                render={({ field }) => (
                  <FormItem>
                    <div className="flex items-center">
                      <FormLabel className="required">来週の作業予定</FormLabel>
                      <PreviousReportTooltip 
                        previousContent={latestReport?.nextWeekPlan}
                        fieldName="来週の作業予定"
                      />
                    </div>
                    <FormControl>
                      <Textarea
                        placeholder="来週予定している作業内容を記述してください"
                        className="h-32"
                        {...field}
                        onBlur={(e) => {
                          field.onBlur?.();
                          analyzeField("来週の作業予定", e.target.value, existingReport?.nextWeekPlan || undefined, latestReport?.nextWeekPlan || undefined);
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                    <AIAnalysisResult
                      analysis={getAnalysisState("来週の作業予定").analysis}
                      isLoading={getAnalysisState("来週の作業予定").isLoading}
                      error={getAnalysisState("来週の作業予定").error}
                      onClear={() => clearAnalysis("来週の作業予定")}
                      onRegenerate={createRegenerateHandler("来週の作業予定")}
                      fieldName="来週の作業予定"
                    />
                  </FormItem>
                )}
              />
            </div>

            {/* 支援・判断要望 */}
            <div className="p-6 bg-card rounded-lg shadow-sm">
              <h2 className="text-xl font-semibold mb-4 pb-2 border-b">
                9. 支援・判断要望
              </h2>
              <FormField
                control={form.control}
                name="supportRequests"
                render={({ field }) => (
                  <FormItem>
                    <div className="flex items-center">
                      <FormLabel className="required">
                        支援・判断の要望事項
                      </FormLabel>
                      <PreviousReportTooltip 
                        previousContent={latestReport?.supportRequests}
                        fieldName="支援・判断の要望事項"
                      />
                    </div>
                    <FormControl>
                      <Textarea
                        placeholder="必要な支援や判断を仰ぎたい事項を記述してください"
                        className="h-32"
                        {...field}
                        onBlur={(e) => {
                          field.onBlur?.();
                          analyzeField("支援・判断の要望事項", e.target.value, existingReport?.supportRequests || undefined, latestReport?.supportRequests || undefined);
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                    <AIAnalysisResult
                      analysis={getAnalysisState("支援・判断の要望事項").analysis}
                      isLoading={getAnalysisState("支援・判断の要望事項").isLoading}
                      error={getAnalysisState("支援・判断の要望事項").error}
                      onClear={() => clearAnalysis("支援・判断の要望事項")}
                      onRegenerate={createRegenerateHandler("支援・判断の要望事項")}
                      fieldName="支援・判断の要望事項"
                    />
                  </FormItem>
                )}
              />
            </div>

            {/* その他の懸念事項 */}
            <div className="p-6 bg-card rounded-lg shadow-sm">
              <h2 className="text-xl font-semibold mb-4 pb-2 border-b">
                10. その他の懸念事項
              </h2>

              {/* リソース */}
              <div className="mb-6">
                <FormField
                  control={form.control}
                  name="resourceConcerns"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>リソースに関する懸念</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value ?? ""}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="選択してください" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="none">なし</SelectItem>
                          <SelectItem value="exists">あり</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {form.watch("resourceConcerns") === "exists" && (
                  <FormField
                    control={form.control}
                    name="resourceDetails"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>詳細</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="リソースに関する懸念事項の詳細を記述してください"
                            className="h-24"
                            {...field}
                            value={field.value ?? ""}
                            onBlur={(e) => {
                              field.onBlur?.();
                              analyzeField("リソース懸念事項", e.target.value, existingReport?.resourceDetails || undefined, latestReport?.resourceDetails || undefined);
                            }}
                          />
                        </FormControl>
                        <FormMessage />
                        <AIAnalysisResult
                          fieldName="リソース懸念事項"
                          analysis={getAnalysisState("リソース懸念事項").analysis}
                          isLoading={getAnalysisState("リソース懸念事項").isLoading}
                          error={getAnalysisState("リソース懸念事項").error}
                          onClear={() => clearAnalysis("リソース懸念事項")}
                          onRegenerate={createRegenerateHandler("リソース懸念事項")}
                        />
                      </FormItem>
                    )}
                  />
                )}
              </div>

              {/* 顧客 */}
              <div className="mb-6">
                <FormField
                  control={form.control}
                  name="customerIssues"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>顧客に関する懸念</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value ?? ""}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="選択してください" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="none">なし</SelectItem>
                          <SelectItem value="exists">あり</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {form.watch("customerIssues") === "exists" && (
                  <FormField
                    control={form.control}
                    name="customerDetails"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>詳細</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="顧客に関する懸念事項の詳細を記述してください"
                            className="h-24"
                            {...field}
                            value={field.value ?? ""}
                            onBlur={(e) => {
                              field.onBlur?.();
                              analyzeField("顧客懸念事項", e.target.value, existingReport?.customerDetails || undefined, latestReport?.customerDetails || undefined);
                            }}
                          />
                        </FormControl>
                        <FormMessage />
                        <AIAnalysisResult
                          fieldName="顧客懸念事項"
                          analysis={getAnalysisState("顧客懸念事項").analysis}
                          isLoading={getAnalysisState("顧客懸念事項").isLoading}
                          error={getAnalysisState("顧客懸念事項").error}
                          onClear={() => clearAnalysis("顧客懸念事項")}
                          onRegenerate={createRegenerateHandler("顧客懸念事項")}
                        />
                      </FormItem>
                    )}
                  />
                )}
              </div>

              {/* 環境 */}
              <div className="mb-6">
                <FormField
                  control={form.control}
                  name="environmentIssues"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>環境に関する懸念</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value ?? ""}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="選択してください" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="none">なし</SelectItem>
                          <SelectItem value="exists">あり</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {form.watch("environmentIssues") === "exists" && (
                  <FormField
                    control={form.control}
                    name="environmentDetails"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>詳細</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="環境に関する懸念事項の詳細を記述してください"
                            className="h-24"
                            {...field}
                            value={field.value ?? ""}
                            onBlur={(e) => {
                              field.onBlur?.();
                              analyzeField("環境懸念事項", e.target.value, existingReport?.environmentDetails || undefined, latestReport?.environmentDetails || undefined);
                            }}
                          />
                        </FormControl>
                        <FormMessage />
                        <AIAnalysisResult
                          fieldName="環境懸念事項"
                          analysis={getAnalysisState("環境懸念事項").analysis}
                          isLoading={getAnalysisState("環境懸念事項").isLoading}
                          error={getAnalysisState("環境懸念事項").error}
                          onClear={() => clearAnalysis("環境懸念事項")}
                          onRegenerate={createRegenerateHandler("環境懸念事項")}
                        />
                      </FormItem>
                    )}
                  />
                )}
              </div>

              {/* コスト */}
              <div className="mb-6">
                <FormField
                  control={form.control}
                  name="costIssues"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>コストに関する懸念</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value ?? ""}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="選択してください" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="none">なし</SelectItem>
                          <SelectItem value="exists">あり</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {form.watch("costIssues") === "exists" && (
                  <FormField
                    control={form.control}
                    name="costDetails"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>詳細</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="コストに関する懸念事項の詳細を記述してください"
                            className="h-24"
                            {...field}
                            value={field.value ?? ""}
                            onBlur={(e) => {
                              field.onBlur?.();
                              analyzeField("コスト懸念事項", e.target.value, existingReport?.costDetails || undefined, latestReport?.costDetails || undefined);
                            }}
                          />
                        </FormControl>
                        <FormMessage />
                        <AIAnalysisResult
                          fieldName="コスト懸念事項"
                          analysis={getAnalysisState("コスト懸念事項").analysis}
                          isLoading={getAnalysisState("コスト懸念事項").isLoading}
                          error={getAnalysisState("コスト懸念事項").error}
                          onClear={() => clearAnalysis("コスト懸念事項")}
                          onRegenerate={createRegenerateHandler("コスト懸念事項")}
                        />
                      </FormItem>
                    )}
                  />
                )}
              </div>

              {/* 知識・スキル */}
              <div className="mb-6">
                <FormField
                  control={form.control}
                  name="knowledgeIssues"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>知識・スキルに関する懸念</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value ?? ""}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="選択してください" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="none">なし</SelectItem>
                          <SelectItem value="exists">あり</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {form.watch("knowledgeIssues") === "exists" && (
                  <FormField
                    control={form.control}
                    name="knowledgeDetails"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>詳細</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="知識・スキルに関する懸念事項の詳細を記述してください"
                            className="h-24"
                            {...field}
                            value={field.value ?? ""}
                            onBlur={(e) => {
                              field.onBlur?.();
                              analyzeField("知識・スキル懸念事項", e.target.value, existingReport?.knowledgeDetails || undefined, latestReport?.knowledgeDetails || undefined);
                            }}
                          />
                        </FormControl>
                        <FormMessage />
                        <AIAnalysisResult
                          fieldName="知識・スキル懸念事項"
                          analysis={getAnalysisState("知識・スキル懸念事項").analysis}
                          isLoading={getAnalysisState("知識・スキル懸念事項").isLoading}
                          error={getAnalysisState("知識・スキル懸念事項").error}
                          onClear={() => clearAnalysis("知識・スキル懸念事項")}
                          onRegenerate={createRegenerateHandler("知識・スキル懸念事項")}
                        />
                      </FormItem>
                    )}
                  />
                )}
              </div>

              {/* 教育 */}
              <div className="mb-6">
                <FormField
                  control={form.control}
                  name="trainingIssues"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>教育に関する懸念</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value ?? ""}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="選択してください" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="none">なし</SelectItem>
                          <SelectItem value="exists">あり</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {form.watch("trainingIssues") === "exists" && (
                  <FormField
                    control={form.control}
                    name="trainingDetails"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="required">教育に関する懸念の詳細</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="教育に関する懸念の詳細を記述してください"
                            className="h-24"
                            {...field}
                            value={field.value ?? ""}
                            onBlur={(e) => {
                              field.onBlur?.();
                              analyzeField("教育懸念事項", e.target.value, existingReport?.trainingDetails || undefined, latestReport?.trainingDetails || undefined);
                            }}
                          />
                        </FormControl>
                        <FormMessage />
                        <AIAnalysisResult
                          fieldName="教育懸念事項"
                          analysis={getAnalysisState("教育懸念事項").analysis}
                          isLoading={getAnalysisState("教育懸念事項").isLoading}
                          error={getAnalysisState("教育懸念事項").error}
                          onClear={() => clearAnalysis("教育懸念事項")}
                          onRegenerate={createRegenerateHandler("教育懸念事項")}
                        />
                      </FormItem>
                    )}
                  />
                )}
              </div>
              <div className="mb-6">
                <FormField
                  control={form.control}
                  name="urgentIssues"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>緊急課題に関する懸念</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value ?? ""}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="選択してください" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="none">なし</SelectItem>
                          <SelectItem value="exists">あり</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {form.watch("urgentIssues") === "exists" && (
                  <FormField
                    control={form.control}
                    name="urgentDetails"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="required">詳細</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="緊急課題の詳細を記述してください"
                            className="h-24"
                            {...field}
                            value={field.value ?? ""}
                            onBlur={(e) => {
                              field.onBlur?.();
                              analyzeField("緊急課題の詳細", e.target.value, existingReport?.urgentDetails || undefined, latestReport?.urgentDetails || undefined);
                            }}
                          />
                        </FormControl>
                        <FormMessage />
                        <AIAnalysisResult
                          fieldName="緊急課題の詳細"
                          analysis={getAnalysisState("緊急課題の詳細").analysis}
                          isLoading={getAnalysisState("緊急課題の詳細").isLoading}
                          error={getAnalysisState("緊急課題の詳細").error}
                          onClear={() => clearAnalysis("緊急課題の詳細")}
                          onRegenerate={createRegenerateHandler("緊急課題の詳細")}
                        />
                      </FormItem>
                    )}
                  />
                )}
              </div>

              {/* 営業チャンス・顧客ニーズ */}
              <div className="mb-6">
                <FormField
                  control={form.control}
                  name="businessOpportunities"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>営業チャンス・顧客ニーズ</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value ?? ""}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="選択してください" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="none">なし</SelectItem>
                          <SelectItem value="exists">あり</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {form.watch("businessOpportunities") === "exists" && (
                  <FormField
                    control={form.control}
                    name="businessDetails"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>詳細</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="営業チャンス・顧客ニーズの詳細を記述してください"
                            className="h-24"
                            {...field}
                            value={field.value ?? ""}
                            onBlur={(e) => {
                              field.onBlur?.();
                              analyzeField("営業チャンス・顧客ニーズ", e.target.value, existingReport?.businessDetails || undefined, latestReport?.businessDetails || undefined);
                            }}
                          />
                        </FormControl>
                        <FormMessage />
                        <AIAnalysisResult
                          fieldName="営業チャンス・顧客ニーズ"
                          analysis={getAnalysisState("営業チャンス・顧客ニーズ").analysis}
                          isLoading={getAnalysisState("営業チャンス・顧客ニーズ").isLoading}
                          error={getAnalysisState("営業チャンス・顧客ニーズ").error}
                          onClear={() => clearAnalysis("営業チャンス・顧客ニーズ")}
                          onRegenerate={createRegenerateHandler("営業チャンス・顧客ニーズ")}
                        />
                      </FormItem>
                    )}
                  />
                )}
              </div>
            </div>

            {/* その他の懸念事項の後にAI分析結果を表示 */}
            {isEditMode && existingReport?.aiAnalysis && (
              <Card>
                <CardContent className="p-6">
                  <h2 className="text-xl font-semibold mb-4 pb-2 border-b">
                    ■ AI分析結果
                  </h2>
                  <div className="prose prose-sm max-w-none">
                    <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>{existingReport.aiAnalysis}</ReactMarkdown>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* 議事録表示セクション（編集モード且つ議事録が存在する場合） */}
            {isEditMode && meetings && meetings.length > 0 && (
              <Card className="mt-8">
                <CardContent className="p-6">
                  <h2 className="text-xl font-semibold mb-4 pb-2 border-b">■ 確認会議事録</h2>
                  {meetings.map((meeting, index) => (
                    <div key={meeting.id} className="mb-6 last:mb-0">
                      {meetings.length > 1 && (
                        <h3 className="text-lg font-medium mb-3 text-gray-700">
                          {meetings.length - index}回目の修正 ({new Date(meeting.createdAt).toLocaleDateString('ja-JP')})
                        </h3>
                      )}
                      <div className="bg-gray-50 rounded-lg p-4">
                        {editingMeetings[meeting.id] ? (
                          // 編集モード
                          <div className="mb-4">
                            <div className="mb-4">
                              <label className="block text-sm font-medium mb-2">タイトル:</label>
                              <input
                                type="text"
                                value={editingMeetings[meeting.id].title}
                                onChange={(e) => updateMeetingField(meeting.id, 'title', e.target.value)}
                                className="w-full p-2 border rounded"
                              />
                            </div>
                            <div className="mb-4">
                              <label className="block text-sm font-medium mb-2">内容:</label>
                              <Textarea
                                value={editingMeetings[meeting.id].content}
                                onChange={(e) => updateMeetingField(meeting.id, 'content', e.target.value)}
                                className="min-h-[200px]"
                              />
                            </div>
                            <div className="flex gap-2">
                              <Button 
                                type="button"
                                size="sm" 
                                onClick={() => saveMeeting(meeting.id)}
                                disabled={updateMeetingMutation.isPending}
                              >
                                {updateMeetingMutation.isPending ? "保存中..." : "保存"}
                              </Button>
                              <Button 
                                type="button"
                                size="sm" 
                                variant="outline" 
                                onClick={() => cancelEditingMeeting(meeting.id)}
                              >
                                キャンセル
                              </Button>
                            </div>
                          </div>
                        ) : (
                          // 表示モード
                          <div className="mb-4">
                            <div className="flex justify-between items-center mb-2">
                              <h4 className="font-medium">{meeting.title}</h4>
                              <Button 
                                type="button"
                                size="sm" 
                                variant="outline"
                                onClick={() => startEditingMeeting(meeting.id, meeting.title, meeting.content)}
                              >
                                編集
                              </Button>
                            </div>
                            <div className="prose prose-sm max-w-none bg-white p-3 rounded border">
                              <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>{meeting.content}</ReactMarkdown>
                            </div>
                          </div>
                        )}
                        
                        <div className="mt-3 text-sm text-gray-500">
                          修正者: {meeting.modifiedBy} | 
                          日時: {new Date(meeting.createdAt).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })}
                        </div>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            <div className="flex justify-end mt-8">
              <Button
                type="submit"
                className={`flex items-center gap-2 ${
                  isAdminEditMode ? "bg-red-600 hover:bg-red-700" : ""
                }`}
                disabled={isSubmitting}
              >
                {isAdminEditMode ? (
                  <ShieldCheck className="h-4 w-4" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                {isSubmitting 
                  ? "処理中..." 
                  : isAdminEditMode 
                  ? "修正完了・議事録生成" 
                  : isEditMode 
                  ? "更新" 
                  : "送信"
                }
              </Button>
            </div>
          </form>
        </Form>
      </div>

      {/* 案件選択モーダル */}
      <CaseSelectorModal
        isOpen={isCaseSelectorOpen}
        onClose={() => setIsCaseSelectorOpen(false)}
        onSelect={(selectedCase) => {
          form.setValue("caseId", selectedCase.id);
          setSelectedCaseId(selectedCase.id);
        }}
        cases={cases || []}
        selectedCaseId={selectedCaseId || undefined}
      />

      {/* マイルストーンダイアログ */}
      <MilestoneDialog
        open={showMilestoneDialog}
        onOpenChange={setShowMilestoneDialog}
      />

      {/* 記載サンプルダイアログ */}
      <SampleReportDialog
        open={showSampleDialog}
        onOpenChange={setShowSampleDialog}
      />
    </div>
  );
}
