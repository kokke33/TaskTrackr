import { useParams, useLocation } from "wouter";
import { FormProvider } from "react-hook-form";
import { Button } from "@/components/ui/button";
import type { WeeklyReport } from "@shared/schema";
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
import { useWebSocket } from "@/contexts/useWebSocket"; // 新しいパスに変更
import { EditingUsersIndicator } from "@/components/editing-users-indicator";
import { useFormPerformance } from "@/hooks/use-performance";
import { useToast } from "@/hooks/use-toast";

import { ReportHeader } from "@/components/weekly-report/report-header";
import { BasicInfoForm } from "@/components/weekly-report/basic-info-form";
import { TaskDetailsSection } from "@/components/weekly-report/task-details-section";
import { MeetingMinutes } from "@/components/weekly-report/meeting-minutes";
import { MilestoneDialog } from "@/components/milestone-dialog";
import { SampleReportDialog } from "@/components/sample-report-dialog";
import { NavigationConfirmDialog } from "@/components/navigation-confirm-dialog";
// 簡素化：版数コンフリクトダイアログを削除
import { EditBlockedDialog } from "@/components/edit-blocked-dialog";
import { useNavigationGuard, NavigationGuardAction } from "@/hooks/use-navigation-guard";

export default function WeeklyReport() {
  const { id } = useParams<{ id: string }>();
  const [location, setLocation] = useLocation();
  const [showMilestoneDialog, setShowMilestoneDialog] = useState(false);
  const [showSampleDialog, setShowSampleDialog] = useState(false);
  const [navigationDialog, setNavigationDialog] = useState<{
    open: boolean;
    targetPath: string;
    resolve: (action: NavigationGuardAction) => void;
  } | null>(null);
  const [isSavingForNavigation, setIsSavingForNavigation] = useState(false);
  const [latestAutoSaveVersion, setLatestAutoSaveVersion] = useState<number | undefined>(undefined);
  
  // 簡素化：詳細な競合解決を削除

  // 編集ブロック用のstate
  const [editBlockedDialog, setEditBlockedDialog] = useState<{
    open: boolean;
    message: string;
    editingUsers?: any[];
  }>({ open: false, message: '', editingUsers: [] });
  
  // 編集権限チェック済みフラグ（無限ループ防止）
  const [permissionChecked, setPermissionChecked] = useState(false);

  // パフォーマンス監視
  const { measureFormOperation, measureRender } = useFormPerformance('WeeklyReport');
  const { toast } = useToast();

  const formHook = useWeeklyReportForm({ id, latestVersionFromAutoSave: latestAutoSaveVersion });
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
    initializeFormData,
    isInitializing,
  } = formHook;

  // 簡素化：版数コンフリクト状態の監視を削除

  const autoSaveHook = useReportAutoSave({ 
    form, 
    isEditMode, 
    id,
    currentVersion: existingReport?.version,
    isInitializing,
    onVersionConflict: async (message: string) => {
      // 簡素化：簡単なエラーメッセージのみ
      toast({
        title: "保存エラー",
        description: "他のユーザーがデータを更新しました。ページをリロードしてください。",
        variant: "destructive",
      });
    }
  });
  
  // 自動保存フックからのバージョン更新を監視
  useEffect(() => {
    if (autoSaveHook.version !== latestAutoSaveVersion) {
      console.log(`🔄 [weekly-report] Updating latest auto-save version: ${autoSaveHook.version}`);
      setLatestAutoSaveVersion(autoSaveHook.version);
    }
  }, [autoSaveHook.version, latestAutoSaveVersion]);
  const {
    lastSavedTime,
    isAutosaving,
    formChanged,
    version,
    handleManualAutoSave,
    handleImmediateSave,
    updateVersion,
    resetConflictResolving,
    resetFormChanged,
  } = autoSaveHook;

  const meetingMinutesHook = useMeetingMinutesGenerator({ reportId, isEditMode });
  const aiAnalysisHook = useAIAnalysis();
  
  // WebSocket接続とリアルタイム編集状況管理
  const { lastMessage, sendMessage, status, editingUsers, currentUserId, checkEditingPermission } = useWebSocket();

  // 編集開始前の編集権チェック（無限ループ防止版）
  useEffect(() => {
    if (status === 'open' && isEditMode && reportId && checkEditingPermission && !permissionChecked) {
      console.log('[WeeklyReport] Checking editing permission (once only)...', { reportId });
      
      const checkAndStartEditing = async () => {
        try {
          setPermissionChecked(true); // フラグを即座に立てて重複実行を防止
          
          const result = await checkEditingPermission(reportId);
          
          if (!result.allowed) {
            // 編集が許可されない場合、エラーダイアログを表示
            console.log('[WeeklyReport] Editing not allowed:', result.message);
            setEditBlockedDialog({
              open: true,
              message: result.message || '他のユーザーが編集中です。',
              editingUsers: result.editingUsers || []
            });
            // 強制リロードは行わず、ダイアログでユーザーに選択を委ねる
            return;
          }
          
          // 編集権限が得られた場合、編集開始を通知
          console.log('[WeeklyReport] Editing permission granted, starting editing...', { reportId });
          sendMessage({ type: 'start_editing', reportId: reportId });
          
          // 編集権限確認後にフォームデータを初期化（ドラフト復元を含む）
          if (initializeFormData) {
            console.log('[WeeklyReport] Initializing form data after permission granted');
            initializeFormData();
            
            // 初期化完了後にauto-saveのformChangedもリセット（initializeFormData完了を確実に待機）
            setTimeout(() => {
              resetFormChanged();
              console.log('[WeeklyReport] Auto-save formChanged reset completed');
            }, 350); // initializeFormData の300ms完了を確実に待機
          }
        } catch (error) {
          console.error('[WeeklyReport] Failed to check editing permission:', error);
          setPermissionChecked(false); // エラー時のみリセットしてリトライを許可
          setEditBlockedDialog({
            open: true,
            message: '編集権限の確認中にエラーが発生しました。',
            editingUsers: []
          });
        }
      };

      checkAndStartEditing();

      // コンポーネントがアンマウントされるか、条件が変わる時に編集終了
      return () => {
        console.log('[WeeklyReport] Cleanup effect, stopping editing...', { reportId });
        sendMessage({ type: 'stop_editing', reportId: reportId });
      };
    }
  }, [isEditMode, reportId, status, permissionChecked, initializeFormData]); // initializeFormDataを依存配列に追加

  // lastMessage を監視して編集ユーザー情報を更新
  useEffect(() => {
    if (lastMessage) {
      // WebSocketProviderで既に処理されているため、ここでは追加処理のみ
      // 必要であれば、ここで追加のロジックを実装
      console.log('[DEBUG] weekly-report.tsx: lastMessage received:', lastMessage);
    }
  }, [lastMessage]);

  // [DEBUG] editingUsers の変更を監視
  useEffect(() => {
    console.log('[DEBUG] weekly-report.tsx: editingUsers state updated:', {
      editingUsers,
      currentUserId,
      currentUserIdType: typeof currentUserId,
      editingUsersLength: editingUsers.length
    });
    
    if (editingUsers.length > 0) {
      editingUsers.forEach((user, index) => {
        console.log(`[DEBUG] editingUser[${index}]:`, {
          userId: user.userId,
          userIdType: typeof user.userId,
          username: user.username,
          isCurrentUser: user.userId === currentUserId,
          startTime: user.startTime,
          lastActivity: user.lastActivity
        });
      });
      
      // フィルタリング結果の確認
      const otherUsers = editingUsers.filter(user => String(user.userId) !== String(currentUserId));
      console.log('[DEBUG] weekly-report.tsx: filtered other users:', {
        totalUsers: editingUsers.length,
        otherUsersCount: otherUsers.length,
        otherUsers: otherUsers.map(u => ({ userId: u.userId, username: u.username }))
      });
    }
  }, [editingUsers, currentUserId]);

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

  // 簡素化：詳細な競合解決ハンドラーを削除

  console.log("🔍 Weekly Report - Navigation guard state:", { 
    formChanged, 
    isSubmitting, 
    shouldBlock: formChanged && !isSubmitting,
    permissionChecked,
    isEditMode
  });

  useNavigationGuard({
    shouldBlock: formChanged && !isSubmitting,
    onNavigationAttempt: handleNavigationAttempt,
  });


  if (isLoadingReport || isLoadingCases) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-2 sm:px-4 py-4 sm:py-8">
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
          editingUsers={editingUsers}
          currentUserId={currentUserId || undefined}
          onManualAutoSave={handleManualAutoSave}
          onCopyFromLastReport={copyFromLastReport}
          onShowMilestoneDialog={() => setShowMilestoneDialog(true)}
          onShowSampleDialog={() => setShowSampleDialog(true)}
        />
        <div className="container mx-auto px-2 sm:px-4 max-w-4xl pb-4 sm:pb-2">
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 sm:space-y-8">
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

            <div className="flex justify-end mt-8 mb-16 sm:mb-8">
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

      {/* 簡素化：版数コンフリクトダイアログを削除 */}

      {/* 編集ブロックダイアログ */}
      <EditBlockedDialog
        open={editBlockedDialog.open}
        onOpenChange={(open) => {
          if (!open) {
            // ダイアログが閉じられる場合も閲覧モードに遷移
            setEditBlockedDialog({ open: false, message: '', editingUsers: [] });
            const viewPath = `/reports/${id}`;
            setLocation(viewPath);
          }
        }}
        message={editBlockedDialog.message}
        editingUsers={editBlockedDialog.editingUsers}
      />
    </div>
  );
}
