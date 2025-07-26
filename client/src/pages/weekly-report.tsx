import { useParams } from "wouter";
import { FormProvider } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Send, ShieldCheck } from "lucide-react";
import { useState, useEffect } from "react";
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import { Card, CardContent } from "@/components/ui/card";
import { FormField, FormItem, FormLabel, FormControl } from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { AIAnalysisResult } from "@/components/ai-analysis-result";

import { useWeeklyReportForm } from "@/hooks/use-weekly-report-form";
import { useReportAutoSave } from "@/hooks/use-report-auto-save";
import { useMeetingMinutesGenerator } from "@/hooks/use-meeting-minutes-generator";
import { useAIAnalysis } from "@/hooks/use-ai-analysis";
import { useWebSocket } from "@/hooks/use-websocket";
import { EditingUsersIndicator } from "@/components/editing-users-indicator";

import { ReportHeader } from "@/components/weekly-report/report-header";
import { BasicInfoForm } from "@/components/weekly-report/basic-info-form";
import { TaskDetailsSection } from "@/components/weekly-report/task-details-section";
import { MeetingMinutes } from "@/components/weekly-report/meeting-minutes";
import { MilestoneDialog } from "@/components/milestone-dialog";
import { SampleReportDialog } from "@/components/sample-report-dialog";
import { NavigationConfirmDialog } from "@/components/navigation-confirm-dialog";
import { ConflictResolutionDialog } from "@/components/conflict-resolution-dialog";
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
  const [conflictDialog, setConflictDialog] = useState<{
    open: boolean;
    serverData: any;
  } | null>(null);

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

  const autoSaveHook = useReportAutoSave({ 
    form, 
    isEditMode, 
    id,
    currentVersion: existingReport?.version,
    onVersionConflict: async (message: string) => {
      // 最新のサーバーデータを取得
      try {
        const response = await fetch(`/api/weekly-reports/${id}`, {
          credentials: "include"
        });
        if (response.ok) {
          const serverData = await response.json();
          setConflictDialog({
            open: true,
            serverData
          });
        } else {
          // フォールバック: ページリロード
          window.location.reload();
        }
      } catch (error) {
        console.error("Failed to fetch server data:", error);
        window.location.reload();
      }
    }
  });
  const {
    lastSavedTime,
    isAutosaving,
    formChanged,
    version,
    handleManualAutoSave,
    handleImmediateSave,
    updateVersion,
  } = autoSaveHook;

  const meetingMinutesHook = useMeetingMinutesGenerator({ reportId, isEditMode });
  const aiAnalysisHook = useAIAnalysis();
  
  // WebSocket接続とリアルタイム編集状況管理
  const { isConnected, editingUsers, currentUserId, startEditing, stopEditing } = useWebSocket({ 
    reportId: reportId
  });
  
  // 編集モードでフォームにフォーカスがあたったら編集開始を通知
  useEffect(() => {
    if (isEditMode && reportId && isConnected) {
      const handleFocus = () => {
        console.log('Form focused, starting editing session');
        startEditing();
      };
      
      const handleBlur = () => {
        console.log('Form blurred, stopping editing session');
        stopEditing();
      };
      
      // フォームフィールドのフォーカスイベントを監視
      const formElement = document.querySelector('form');
      if (formElement) {
        formElement.addEventListener('focusin', handleFocus);
        formElement.addEventListener('focusout', handleBlur);
        
        return () => {
          formElement.removeEventListener('focusin', handleFocus);
          formElement.removeEventListener('focusout', handleBlur);
        };
      }
    }
  }, [isEditMode, reportId, isConnected, startEditing, stopEditing]);

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

  // 競合解決のハンドラー
  const handleConflictResolve = async (resolvedData: any) => {
    console.log("🔧 Starting conflict resolution with resolved data:", resolvedData);
    
    try {
      // 先にダイアログを閉じる
      setConflictDialog(null);
      
      // 解決済みデータでフォームを更新
      form.reset(resolvedData);
      
      // サーバーのバージョン番号を更新
      if (conflictDialog?.serverData?.version) {
        console.log("📝 Updating version to:", conflictDialog.serverData.version);
        updateVersion(conflictDialog.serverData.version);
      }
      
      // 少し待ってから保存（フォームの更新を確実にするため）
      setTimeout(async () => {
        try {
          console.log("💾 Attempting immediate save after conflict resolution");
          const success = await handleImmediateSave();
          if (success) {
            console.log("✅ Conflict resolution save successful");
          } else {
            console.log("❌ Conflict resolution save failed");
          }
        } catch (saveError) {
          console.error("💥 Save error after conflict resolution:", saveError);
        }
      }, 100);
      
    } catch (error) {
      console.error("💥 Failed to resolve conflict:", error);
    }
  };

  const handleConflictReload = () => {
    window.location.reload();
  };

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
        
        {/* リアルタイム編集状況表示 */}
        {isEditMode && (
          <div className="container mx-auto px-4 max-w-4xl mb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <EditingUsersIndicator 
                  editingUsers={editingUsers}
                  currentUserId={currentUserId || undefined}
                  className="mb-2"
                />
                {isConnected && (
                  <div className="text-sm text-green-600 flex items-center gap-1">
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                    リアルタイム接続中
                  </div>
                )}
              </div>
              {!isConnected && (
                <div className="text-sm text-amber-600 flex items-center gap-1">
                  <div className="w-2 h-2 bg-amber-500 rounded-full animate-pulse"></div>
                  リアルタイム機能に接続中...
                </div>
              )}
            </div>
          </div>
        )}
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

            {isAdminEditMode && (
              <Card>
                <CardContent className="p-6">
                  <h2 className="text-xl font-semibold mb-4 pb-2 border-b">
                    ■ 管理者確認メール文章
                  </h2>
                  <p className="text-sm text-muted-foreground mb-4">
                    リーダーに不明点を的確にシンプルに確認するためのメール文章を作成してください。
                  </p>
                  <div className="space-y-4">
                    <div>
                      <FormField
                        control={form.control}
                        name="adminConfirmationEmail"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>メール文章</FormLabel>
                            <FormControl>
                              <Textarea
                                placeholder="件名: 週次報告について確認事項があります&#10;&#10;お疲れ様です。&#10;&#10;週次報告を確認させていただきましたが、以下の点について確認したいことがあります。&#10;&#10;【確認事項】&#10;- 〇〇について詳細を教えてください&#10;- △△の進捗状況はいかがでしょうか&#10;&#10;お忙しい中恐縮ですが、ご回答をお願いいたします。"
                                className="min-h-32"
                                value={field.value ?? ""}
                                onChange={field.onChange}
                                onBlur={(e) => {
                                  field.onBlur();
                                  // AI分析を実行
                                  if (e.target.value && aiAnalysisHook.analyzeField) {
                                    aiAnalysisHook.analyzeField('adminConfirmationEmail', e.target.value);
                                  }
                                }}
                              />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                    </div>
                    {aiAnalysisHook.getAnalysisState('adminConfirmationEmail')?.isLoading && (
                      <div className="text-sm text-muted-foreground">
                        AI分析中...
                      </div>
                    )}
                    {aiAnalysisHook.getAnalysisState('adminConfirmationEmail')?.analysis && (
                      <AIAnalysisResult
                        fieldName="adminConfirmationEmail"
                        analysis={aiAnalysisHook.getAnalysisState('adminConfirmationEmail')?.analysis || ''}
                        isLoading={aiAnalysisHook.getAnalysisState('adminConfirmationEmail')?.isLoading ?? false}
                        error={aiAnalysisHook.getAnalysisState('adminConfirmationEmail')?.error || null}
                        onClear={() => aiAnalysisHook.clearAnalysis('adminConfirmationEmail')}
                        onRegenerate={() => aiAnalysisHook.regenerateAnalysis('adminConfirmationEmail', form.getValues('adminConfirmationEmail') ?? '')}
                        conversations={aiAnalysisHook.getAnalysisState('adminConfirmationEmail')?.conversations}
                        isConversationLoading={aiAnalysisHook.getAnalysisState('adminConfirmationEmail')?.isConversationLoading}
                        onSendMessage={(message) => aiAnalysisHook.sendMessage('adminConfirmationEmail', message)}
                        onClearConversations={() => aiAnalysisHook.clearConversations('adminConfirmationEmail')}
                      />
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

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
      
      {conflictDialog && (
        <ConflictResolutionDialog
          open={conflictDialog.open}
          onOpenChange={(open) => {
            if (!open) {
              setConflictDialog(null);
            }
          }}
          localData={form.getValues()}
          serverData={conflictDialog.serverData}
          serverUsername={conflictDialog.serverData?.reporterName || "他のユーザー"}
          onResolve={handleConflictResolve}
          onReload={handleConflictReload}
        />
      )}
    </div>
  );
}
