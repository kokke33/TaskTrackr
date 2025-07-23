import { useParams } from "wouter";
import { FormProvider } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Send, ShieldCheck } from "lucide-react";
import { useState } from "react";
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import { Card, CardContent } from "@/components/ui/card";

import { useWeeklyReportForm } from "@/hooks/use-weekly-report-form";
import { useReportAutoSave } from "@/hooks/use-report-auto-save";
import { useMeetingMinutesGenerator } from "@/hooks/use-meeting-minutes-generator";
import { useAIAnalysis } from "@/hooks/use-ai-analysis";

import { ReportHeader } from "@/components/weekly-report/report-header";
import { BasicInfoForm } from "@/components/weekly-report/basic-info-form";
import { TaskDetailsSection } from "@/components/weekly-report/task-details-section";
import { MeetingMinutes } from "@/components/weekly-report/meeting-minutes";
import { MilestoneDialog } from "@/components/milestone-dialog";
import { SampleReportDialog } from "@/components/sample-report-dialog";
import { NavigationConfirmDialog } from "@/components/navigation-confirm-dialog";
import { useNavigationGuard, NavigationGuardAction } from "@/hooks/use-navigation-guard";

export default function WeeklyReport() {
  const { id } = useParams<{ id: string }>();
  const [showMilestoneDialog, setShowMilestoneDialog] = useState(false);
  const [showSampleDialog, setShowSampleDialog] = useState(false);
  const [navigationDialog, setNavigationDialog] = useState<{
    open: boolean;
    targetPath: string;
    resolve: (action: NavigationGuardAction) => void;
  } | null>(null);
  const [isSavingForNavigation, setIsSavingForNavigation] = useState(false);

  const formHook = useWeeklyReportForm({ id });
  const {
    form,
    isEditMode,
    isAdminEditMode,
    reportId,
    existingReport,
    isLoadingReport,
    cases,
    isLoadingCases,
    latestReport,
    selectedCaseId,
    setSelectedCaseId,
    isSubmitting,
    onSubmit,
    copyFromLastReport,
  } = formHook;

  const autoSaveHook = useReportAutoSave({ form, isEditMode, id });
  const {
    lastSavedTime,
    isAutosaving,
    formChanged,
    handleManualAutoSave,
    handleImmediateSave,
  } = autoSaveHook;

  const meetingMinutesHook = useMeetingMinutesGenerator({ reportId, isEditMode });
  const aiAnalysisHook = useAIAnalysis();

  // ナビゲーションガードのセットアップ
  const handleNavigationAttempt = async (targetPath: string): Promise<NavigationGuardAction> => {
    return new Promise((resolve) => {
      setNavigationDialog({
        open: true,
        targetPath,
        resolve,
      });
    });
  };

  const handleNavigationAction = async (action: NavigationGuardAction) => {
    if (!navigationDialog) return;

    // ダイアログを即座に閉じる
    setNavigationDialog(null);

    if (action === "save") {
      setIsSavingForNavigation(true);
      try {
        const success = await handleImmediateSave();
        navigationDialog.resolve(success ? "save" : "cancel");
      } catch (error) {
        console.error("Save failed:", error);
        navigationDialog.resolve("cancel");
      } finally {
        setIsSavingForNavigation(false);
      }
    } else {
      // discard や cancel の場合は即座に resolve
      navigationDialog.resolve(action);
    }
  };

  console.log("🔍 Weekly Report - Navigation guard state:", { 
    formChanged, 
    isSubmitting, 
    shouldBlock: formChanged && !isSubmitting 
  });

  useNavigationGuard({
    shouldBlock: formChanged && !isSubmitting,
    onNavigationAttempt: handleNavigationAttempt,
  });

  if (isLoadingReport || isLoadingCases) {
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
      <FormProvider {...form}>
        <ReportHeader
          isEditMode={isEditMode}
          isAdminEditMode={isAdminEditMode ?? false}
          reportId={reportId}
          isAutosaving={isAutosaving}
          formChanged={formChanged}
          lastSavedTime={lastSavedTime}
          selectedCaseId={selectedCaseId}
          onManualAutoSave={handleManualAutoSave}
          onCopyFromLastReport={copyFromLastReport}
          onShowMilestoneDialog={() => setShowMilestoneDialog(true)}
          onShowSampleDialog={() => setShowSampleDialog(true)}
        />
        <div className="container mx-auto px-4 max-w-4xl">
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
            <BasicInfoForm
              cases={cases || []}
              selectedCaseId={selectedCaseId}
              onSelectCase={setSelectedCaseId}
            />
            <TaskDetailsSection
              latestReport={latestReport}
              existingReport={existingReport}
              aiAnalysis={aiAnalysisHook}
            />
            
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

            <MeetingMinutes
              meetings={meetingMinutesHook.meetings || []}
              editingMeetings={meetingMinutesHook.editingMeetings}
              isUpdating={meetingMinutesHook.isUpdating}
              onStartEditing={meetingMinutesHook.startEditingMeeting}
              onCancelEditing={meetingMinutesHook.cancelEditingMeeting}
              onSave={meetingMinutesHook.saveMeeting}
              onUpdateField={meetingMinutesHook.updateMeetingField}
            />

            <div className="flex justify-end mt-8">
              <Button
                type="submit"
                className={`flex items-center gap-2 ${
                  isAdminEditMode ?? false ? "bg-red-600 hover:bg-red-700" : ""
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
        </div>
      </FormProvider>

      <MilestoneDialog
        open={showMilestoneDialog}
        onOpenChange={setShowMilestoneDialog}
        milestone={cases?.find(c => c.id === selectedCaseId)?.milestone || ""}
        projectName={cases?.find(c => c.id === selectedCaseId)?.projectName || ""}
        caseName={cases?.find(c => c.id === selectedCaseId)?.caseName || ""}
      />
      <SampleReportDialog
        open={showSampleDialog}
        onOpenChange={setShowSampleDialog}
      />

      <NavigationConfirmDialog
        open={navigationDialog?.open ?? false}
        onAction={handleNavigationAction}
        targetPath={navigationDialog?.targetPath}
        isSaving={isSavingForNavigation}
      />
    </div>
  );
}
