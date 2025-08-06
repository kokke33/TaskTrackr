import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertWeeklyReportSchema, type WeeklyReport, type Case } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect, useCallback, useRef } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth";
import { useWebSocket } from "@/contexts/useWebSocket";

type UseWeeklyReportFormProps = {
  id?: string;
  latestVersionFromAutoSave?: number;
};

export function useWeeklyReportForm({ id, latestVersionFromAutoSave }: UseWeeklyReportFormProps) {
  const isEditMode = !!id;
  const reportId = id ? parseInt(id) : undefined;
  const { user } = useAuth();
  const [location, setLocation] = useLocation();
  const urlParams = new URLSearchParams(window.location.search);
  const isAdminEditMode = urlParams.get('adminEdit') === 'true' && user?.isAdmin;
  const queryClient = useQueryClient();
  const { onDataUpdate } = useWebSocket();
  
  // 簡素化：版数コンフリクト関連の状態を削除

  const { data: existingReport, isLoading: isLoadingReport } = useQuery<WeeklyReport>({
    queryKey: [`/api/weekly-reports/${id}`],
    enabled: isEditMode,
  });

  const { data: cases, isLoading: isLoadingCases } = useQuery<Case[]>({
    queryKey: ["/api/cases"],
    staleTime: 0,
  });

  const { toast } = useToast();
  const [selectedCaseId, setSelectedCaseId] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [originalData, setOriginalData] = useState<WeeklyReport | null>(null);
  const [currentVersion, setCurrentVersion] = useState<number>(1);

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
      adminConfirmationEmail: "",
    },
  });

  const { data: latestReport, isLoading: isLoadingLatest } = useQuery<WeeklyReport>({
    queryKey: [`/api/weekly-reports/previous/${selectedCaseId}`, reportId, existingReport?.reportPeriodStart],
    queryFn: async () => {
      let reportPeriodStart: string | undefined;
      if (isEditMode && existingReport) {
        reportPeriodStart = existingReport.reportPeriodStart;
      } else {
        reportPeriodStart = form.getValues("reportPeriodStart");
      }
      if (!reportPeriodStart) {
        const excludeParam = reportId ? `?excludeId=${reportId}` : '';
        return apiRequest(`/api/weekly-reports/latest/${selectedCaseId}${excludeParam}`, { method: "GET" });
      }
      const params = new URLSearchParams({ beforeDate: reportPeriodStart });
      if (reportId) {
        params.append('excludeId', reportId.toString());
      }
      return apiRequest(`/api/weekly-reports/previous/${selectedCaseId}?${params.toString()}`, { method: "GET" });
    },
    enabled: !!selectedCaseId && (!isEditMode || (!!existingReport && !!existingReport.reportPeriodStart)),
  });

  // この useEffect は新しいドラフト復元機能に統合されました

  useEffect(() => {
    if (isAdminEditMode && isEditMode) {
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
        toast({
          title: "エラー",
          description: "管理者編集モードの準備ができていません",
          variant: "destructive",
        });
        setLocation(`/reports/${id}`);
      }
    }
  }, [isAdminEditMode, isEditMode, id, setLocation, toast]);

  // 一時保存機能
  const saveFormData = useCallback(() => {
    if (!reportId) return;
    
    const formData = form.getValues();
    const saveKey = `weekly-report-draft-${reportId}`;
    
    try {
      localStorage.setItem(saveKey, JSON.stringify({
        data: formData,
        timestamp: Date.now(),
        version: existingReport?.version
      }));
    } catch (error) {
      console.error('Failed to save draft:', error);
    }
  }, [form, reportId, existingReport?.version]);

  const loadFormData = useCallback(() => {
    if (!reportId) return false;
    
    const saveKey = `weekly-report-draft-${reportId}`;
    
    try {
      const saved = localStorage.getItem(saveKey);
      if (!saved) return false;
      
      const { data, timestamp, version } = JSON.parse(saved);
      
      // 1時間以上古いドラフトは無視
      if (Date.now() - timestamp > 60 * 60 * 1000) {
        localStorage.removeItem(saveKey);
        return false;
      }
      
      // バージョンが異なる場合は無視（データが更新された）
      if (existingReport && version !== existingReport.version) {
        localStorage.removeItem(saveKey);
        return false;
      }
      
      // フォームデータを復元
      Object.entries(data).forEach(([key, value]) => {
        form.setValue(key as keyof WeeklyReport, value as any);
      });
      
      toast({
        title: "ドラフトを復元しました",
        description: "前回の編集内容を復元しました。",
      });
      
      return true;
    } catch (error) {
      console.error('Failed to load draft:', error);
      return false;
    }
  }, [form, reportId, existingReport?.version, toast]);

  const clearFormData = useCallback(() => {
    if (!reportId) return;
    
    const saveKey = `weekly-report-draft-${reportId}`;
    localStorage.removeItem(saveKey);
  }, [reportId]);

  // 簡素化：版数チェック機能を削除

  // 簡素化：フォーカス復帰時のドラフト保存のみ
  useEffect(() => {
    const handleBlur = () => {
      // フォーカスが離れる時にドラフトを保存
      saveFormData();
    };

    window.addEventListener('blur', handleBlur);
    
    return () => {
      window.removeEventListener('blur', handleBlur);
    };
  }, [saveFormData]);

  // 初回読み込み時にドラフトを復元
  useEffect(() => {
    if (isEditMode && existingReport) {
      // 既存データがロードされた後でドラフトを復元を試行
      const hasRestored = loadFormData();
      if (!hasRestored) {
        // ドラフトがない場合は既存データでフォームを初期化
        Object.entries(existingReport).forEach(([key, value]) => {
          const formValue = value === null || value === undefined ? "" : value;
          form.setValue(key as keyof WeeklyReport, formValue);
        });
        setSelectedCaseId(existingReport.caseId);
      }
    }
  }, [isEditMode, existingReport, loadFormData, form]);

  // 簡素化：WebSocket通知処理を削除（排他制御で事前防止するため不要）

  const mutation = useMutation({
    mutationFn: async (data: WeeklyReport) => {
      if (isAdminEditMode && originalData) {
        return apiRequest(`/api/weekly-reports/${id}/admin-edit-complete`, {
          method: "PUT",
          data: { originalData, updatedData: data },
        });
      }
      const url = isEditMode ? `/api/weekly-reports/${id}` : "/api/weekly-reports";
      const method = isEditMode ? "PUT" : "POST";
      
          // 編集モードの場合は現在のバージョンを含める
      // 自動保存で更新された最新版数を優先的に使用
      let currentVersion = existingReport?.version;
      if (isEditMode && latestVersionFromAutoSave && latestVersionFromAutoSave > (existingReport?.version || 0)) {
        currentVersion = latestVersionFromAutoSave;
        console.log(`🔥 [use-weekly-report-form] Using updated version from auto-save: ${latestVersionFromAutoSave} (instead of existingReport: ${existingReport?.version})`);
      }
      
      const requestData = isEditMode && currentVersion 
        ? { ...data, version: currentVersion }
        : data;
      
      console.log(`🔥 [use-weekly-report-form] Final request data version: ${requestData.version || 'undefined'}`);
      
      return apiRequest(url, { method, data: requestData });
    },
    onSuccess: (result) => {
      // 成功時にドラフトをクリア
      clearFormData();
      
      if (isAdminEditMode) {
        sessionStorage.removeItem(`adminEdit_original_${id}`);
        toast({
          title: "修正完了",
          description: "修正と議事録生成が完了しました",
        });
        // 管理者編集完了時は result.report.id を使用
        setLocation(`/reports/${result.report?.id || id}`);
      } else {
        toast({
          title: isEditMode ? "報告が更新されました" : "報告が送信されました",
          description: isEditMode
            ? "週次報告が正常に更新されました。"
            : "週次報告が正常に送信されました。",
        });
        // 通常の編集・作成時は result.id を使用
        setLocation(`/reports/${result.id}`);
      }
    },
    onError: async (error: any) => {
      console.log('🔥 [use-weekly-report-form] onError triggered:', { error, status: error?.status });
      
      if (error?.status === 409) {
        // 簡素化：楽観的ロック競合エラーを単純なエラーメッセージに変更
        saveFormData(); // 編集内容を保護
        
        toast({
          title: "データ競合エラー",
          description: "他のユーザーがこのレポートを更新しました。ページをリロードして最新版で作業してください。",
          variant: "destructive",
          duration: 10000,
        });
      } else {
        toast({
          title: "エラー",
          description: isAdminEditMode 
            ? "管理者編集の完了に失敗しました。"
            : isEditMode
            ? "週次報告の更新に失敗しました。"
            : "週次報告の送信に失敗しました。",
          variant: "destructive",
        });
      }
    },
    onSettled: () => {
      setIsSubmitting(false);
    },
  });

  const onSubmit = (data: WeeklyReport) => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    mutation.mutate(data);
  };

  // 簡素化：競合解決機能を削除（排他制御で事前防止）

  const copyFromLastReport = () => {
    if (!selectedCaseId || !latestReport) return;

    const fieldsToExclude = [
      "id", 
      "createdAt", 
      "updatedAt",
      "reportPeriodStart", 
      "reportPeriodEnd",
      "adminConfirmationEmail",  // 管理者確認メール（各報告で独立すべき）
      "aiAnalysis",              // AI分析結果（新しい報告内容に基づくべき）
      "version"                  // 楽観的ロック用バージョン（各報告で独立すべき）
    ];
    Object.entries(latestReport).forEach(([key, value]) => {
      if (!fieldsToExclude.includes(key)) {
        form.setValue(key as keyof WeeklyReport, value || "");
      }
    });

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

  return {
    form,
    isEditMode,
    isAdminEditMode,
    reportId,
    existingReport,
    isLoadingReport,
    cases,
    isLoadingCases,
    latestReport,
    isLoadingLatest,
    selectedCaseId,
    setSelectedCaseId,
    isSubmitting,
    onSubmit,
    copyFromLastReport,
    // 一時保存関連
    saveFormData,
    loadFormData,
    clearFormData,
  };
}