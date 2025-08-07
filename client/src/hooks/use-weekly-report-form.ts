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
  const [hasFormChanges, setHasFormChanges] = useState(false); // フォーム変更フラグ
  const [isInitializing, setIsInitializing] = useState(false); // 初期化中フラグ

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

  // フォーム変更検出のためのwatcher
  const watchedValues = form.watch();
  const watchedValuesRef = useRef(watchedValues);
  const initialDataRef = useRef<WeeklyReport | null>(null);

  // フォームデータが実際に変更されたかをチェックする関数
  const checkFormChanges = useCallback(() => {
    if (!initialDataRef.current) return false;
    
    const current = form.getValues();
    const initial = initialDataRef.current;
    
    // 重要なフィールドの変更をチェック
    const importantFields: (keyof WeeklyReport)[] = [
      'weeklyTasks', 'progressStatus', 'issues', 'nextWeekPlan', 
      'supportRequests', 'delayDetails', 'riskSummary', 
      'riskCountermeasures', 'qualityDetails', 'testProgress',
      'changeDetails', 'resourceDetails', 'customerDetails',
      'environmentDetails', 'costDetails', 'knowledgeDetails',
      'trainingDetails', 'urgentDetails', 'businessDetails',
      'adminConfirmationEmail', 'reporterName'
    ];
    
    for (const field of importantFields) {
      const currentValue = (current[field] || '').toString().trim();
      const initialValue = (initial[field] || '').toString().trim();
      if (currentValue !== initialValue) {
        console.log(`[Draft] Form change detected in field '${field}':`, {
          initial: initialValue.substring(0, 50),
          current: currentValue.substring(0, 50),
          isInitializing: isInitializing
        });
        return true;
      }
    }
    
    return false;
  }, [form, isInitializing]);

  // フォーム値の変更を監視（初期化中は完全無効化）
  useEffect(() => {
    // 🔥 重要: 初期化中は変更検知を完全にスキップ
    if (isInitializing) {
      console.log('[Draft] Skipping change detection during initialization - isInitializing:', isInitializing);
      return;
    }
    
    // 初期データが設定されていない場合もスキップ
    if (!initialDataRef.current) {
      console.log('[Draft] Skipping change detection - no initial data reference');
      return;
    }
    
    const hasChanges = checkFormChanges();
    if (hasChanges !== hasFormChanges) {
      setHasFormChanges(hasChanges);
      console.log(`[Draft] Form changes state updated: ${hasChanges} (user action)`);
    }
  }, [watchedValues, checkFormChanges, hasFormChanges, isInitializing]);

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

  // 一時保存機能（実際の変更がある場合のみ）
  const saveFormData = useCallback(() => {
    if (!reportId || !hasFormChanges) return; // 変更がない場合は保存しない
    
    const formData = form.getValues();
    const saveKey = `weekly-report-draft-${reportId}`;
    
    try {
      localStorage.setItem(saveKey, JSON.stringify({
        data: formData,
        timestamp: Date.now(),
        version: existingReport?.version
      }));
      console.log('[Draft] Saved form data with changes');
    } catch (error) {
      console.error('Failed to save draft:', error);
    }
  }, [form, reportId, existingReport?.version, hasFormChanges]);

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
      
      // 復元時刻の計算と表示
      const savedTime = new Date(timestamp);
      const now = new Date();
      const minutesAgo = Math.floor((now.getTime() - savedTime.getTime()) / (1000 * 60));
      
      const timeDescription = minutesAgo < 1 
        ? "1分以内" 
        : minutesAgo < 60 
        ? `${minutesAgo}分前` 
        : `${Math.floor(minutesAgo / 60)}時間前`;
      
      toast({
        title: "ドラフトを復元しました",
        description: `${timeDescription}の編集内容を復元しました。`,
      });
      
      console.log('[Draft] Restored form data from:', savedTime);
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

  // 初期データの設定（編集権限確認後に外部から呼び出される）
  const initializeFormData = useCallback(() => {
    if (isEditMode && existingReport) {
      console.log('[Draft] Starting form initialization');
      
      // 🔥 重要: 最初に初期化フラグを設定して変更検知を無効化
      setIsInitializing(true);
      setHasFormChanges(false); // 変更フラグも事前にリセット
      
      try {
        // 初期データを先に保存（変更検出のため）
        // existingReport の null/undefined を空文字列に変換して初期データとして設定
        const cleanedExistingReport = Object.fromEntries(
          Object.entries(existingReport).map(([key, value]) => [key, value === null || value === undefined ? "" : value])
        ) as WeeklyReport;
        initialDataRef.current = { ...cleanedExistingReport };
        console.log('[Draft] Initial data reference set with cleaned data');
        
        // 既存データがロードされた後でドラフトを復元を試行
        const hasRestored = loadFormData();
        if (!hasRestored) {
          // ドラフトがない場合は既存データでフォームを初期化
          Object.entries(cleanedExistingReport).forEach(([key, value]) => {
            form.setValue(key as keyof WeeklyReport, value as any);
          });
          setSelectedCaseId(existingReport.caseId);
          console.log('[Draft] Form initialized with existing data');
        } else {
          console.log('[Draft] Form initialized with draft data');
        }
        
        // 初期化完了後に十分待ってから変更検出を有効化（300msに延長）
        setTimeout(() => {
          setIsInitializing(false);
          setHasFormChanges(false); // 二重確認でリセット
          console.log('[Draft] Form initialization completed - change detection enabled');
        }, 300);
        
        return true;
      } catch (error) {
        console.error('[Draft] Error during form initialization:', error);
        setIsInitializing(false);
        return false;
      }
    }
    return false;
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
    initializeFormData,
    isInitializing,
  };
}
