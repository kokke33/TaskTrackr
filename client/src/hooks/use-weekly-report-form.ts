import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertWeeklyReportSchema, type WeeklyReport, type Case } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth";

type UseWeeklyReportFormProps = {
  id?: string;
};

export function useWeeklyReportForm({ id }: UseWeeklyReportFormProps) {
  const isEditMode = !!id;
  const reportId = id ? parseInt(id) : undefined;
  const { user } = useAuth();
  const [location, setLocation] = useLocation();
  const urlParams = new URLSearchParams(window.location.search);
  const isAdminEditMode = urlParams.get('adminEdit') === 'true' && user?.isAdmin;

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

  useEffect(() => {
    if (isEditMode && existingReport) {
      Object.entries(existingReport).forEach(([key, value]) => {
        form.setValue(key as keyof WeeklyReport, value || "");
      });
      setSelectedCaseId(existingReport.caseId);
    }
  }, [existingReport, form, isEditMode]);

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
      return apiRequest(url, { method, data });
    },
    onSuccess: (result) => {
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
    onError: () => {
      toast({
        title: "エラー",
        description: isAdminEditMode 
          ? "管理者編集の完了に失敗しました。"
          : isEditMode
          ? "週次報告の更新に失敗しました。"
          : "週次報告の送信に失敗しました。",
        variant: "destructive",
      });
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

  const copyFromLastReport = () => {
    if (!selectedCaseId || !latestReport) return;

    const fieldsToExclude = ["id", "createdAt", "reportPeriodStart", "reportPeriodEnd"];
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
  };
}