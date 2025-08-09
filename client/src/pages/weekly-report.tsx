import { useParams, useLocation } from "wouter";
import { FormProvider } from "react-hook-form";
import { Button } from "@/components/ui/button";
import type { WeeklyReport } from "@shared/schema";
import { Send, ShieldCheck } from "lucide-react";
import { useState, useEffect, useCallback } from "react";
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
import { useWebSocket } from "@/contexts/useWebSocket";
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
    isLoadingLatest,
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
    isSubmitting, // メイン送信中フラグを連携
    onVersionConflict: async (message: string) => {
      // 簡素化：簡単なエラーメッセージのみ
      toast({
        title: "保存エラー",
        description: "他のユーザーがデータを更新しました。ページをリロードしてください。",
        variant: "destructive",
        duration: 1000,
      });
    }
  });
  
  // 自動保存フックからのバージョン更新を監視
  useEffect(() => {
    if (autoSaveHook.version !== latestAutoSaveVersion) {
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
      const checkAndStartEditing = async () => {
        try {
          setPermissionChecked(true); // フラグを即座に立てて重複実行を防止
          
          const result = await checkEditingPermission(reportId);
          
          if (!result.allowed) {
            // 編集が許可されない場合、エラーダイアログを表示
            setEditBlockedDialog({
              open: true,
              message: result.message || '他のユーザーが編集中です。',
              editingUsers: result.editingUsers || []
            });
            // 強制リロードは行わず、ダイアログでユーザーに選択を委ねる
            return;
          }
          
          // 編集権限が得られた場合、編集開始を通知
          sendMessage({ type: 'start_editing', reportId: reportId });
          
          // 編集権限確認後にフォームデータを初期化（ドラフト復元を含む）
          if (initializeFormData) {
            initializeFormData();
            
            // 初期化完了後にauto-saveのformChangedもリセット（initializeFormData完了を確実に待機）
            setTimeout(() => {
              resetFormChanged();
            }, 350); // initializeFormData の300ms完了を確実に待機
          }
        } catch (error) {
          if (process.env.NODE_ENV === 'development') {
            console.error('[WeeklyReport] Failed to check editing permission:', error);
          }
          setPermissionChecked(false); // エラー時のみリセットしてリトライを許可
          setEditBlockedDialog({
            open: true,
            message: '編集権限の確認中にエラーが発生しました。',
            editingUsers: []
          });
        }
      };

      checkAndStartEditing();

      // コンポーネントがアンマウントされる時に編集終了
      return () => {
        if (isEditMode && reportId && sendMessage && permissionChecked) {
          sendMessage({ type: 'stop_editing', reportId: reportId });
        }
      };
    }
  }, [isEditMode, reportId, status, permissionChecked, initializeFormData, sendMessage]); // sendMessageを依存配列に追加

  // 編集ブロックダイアログが表示されている場合にのみ編集権限を再チェック
  useEffect(() => {
    if (editBlockedDialog.open && status === 'open' && reportId && checkEditingPermission) {
      const interval = setInterval(async () => {
        try {
          const result = await checkEditingPermission(reportId);
          
          // 他のユーザーが編集を終了した場合
          if (result.allowed) {
            setEditBlockedDialog({ open: false, message: '', editingUsers: [] });
            
            // 編集開始処理を実行
            sendMessage({ type: 'start_editing', reportId: reportId });
            if (initializeFormData) {
              initializeFormData();
              setTimeout(() => {
                resetFormChanged();
              }, 350);
            }
          }
        } catch (error) {
          if (process.env.NODE_ENV === 'development') {
            console.error('[WeeklyReport] Failed to re-check editing permission:', error);
          }
        }
      }, 3000); // 3秒ごとに再チェック

      return () => clearInterval(interval);
    }
  }, [editBlockedDialog.open, status, reportId, checkEditingPermission, sendMessage, initializeFormData]);

  // コンポーネントアンマウント時の排他ロック解除（確実な実行のため）
  useEffect(() => {
    // アンマウント時に確実に排他ロック解除
    return () => {
      if (isEditMode && reportId && sendMessage) {
        try {
          sendMessage({ type: 'stop_editing', reportId: reportId });
        } catch (error) {
          if (process.env.NODE_ENV === 'development') {
            console.error('[WeeklyReport] Failed to send stop editing on unmount:', error);
          }
        }
      }
    };
  }, []); // 空の依存配列でアンマウント時のみ実行

  // ページ離脱時の排他ロック解除（フォールバック対応）
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (isEditMode && reportId && sendMessage) {
        try {
          // 同期的にメッセージ送信（beforeunload時の制約対応）
          sendMessage({ type: 'stop_editing', reportId: reportId });
          
          // Beacon APIで確実にサーバーに通知（可能であれば）
          if (navigator.sendBeacon) {
            const data = JSON.stringify({ type: 'stop_editing', reportId: reportId });
            navigator.sendBeacon('/api/websocket-fallback', data);
          }
        } catch (error) {
          if (process.env.NODE_ENV === 'development') {
            console.error('[WeeklyReport] Failed to send stop editing on page unload:', error);
          }
        }
      }
    };

    if (isEditMode && reportId) {
      window.addEventListener('beforeunload', handleBeforeUnload);
      return () => {
        window.removeEventListener('beforeunload', handleBeforeUnload);
      };
    }
  }, [isEditMode, reportId, sendMessage]);

  // lastMessage を監視して編集ユーザー情報を更新
  useEffect(() => {
    if (lastMessage) {
      // editing_users メッセージを受信した場合、状態を更新
      if (lastMessage.type === 'editing_users') {
      }
    }
  }, [lastMessage]);

  // editingUsers の変更を監視して編集ブロックダイアログを制御
  useEffect(() => {
    if (editingUsers.length > 0) {
      // 編集ブロックダイアログが表示されている場合、他のユーザーが編集を終了したかチェック
      const otherUsers = editingUsers.filter(user => String(user.userId) !== String(currentUserId));
      if (editBlockedDialog.open && otherUsers.length === 0) {
        setEditBlockedDialog({ open: false, message: '', editingUsers: [] });
      }
    }
  }, [editingUsers, currentUserId, editBlockedDialog.open]);

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

  // 編集終了処理
  const handleStopEditing = useCallback(() => {
    if (isEditMode && reportId && sendMessage) {
      if (process.env.NODE_ENV === 'development') {
        console.log('[WeeklyReport] Stopping editing due to navigation...', { reportId });
      }
      sendMessage({ type: 'stop_editing', reportId: reportId });
    }
  }, [isEditMode, reportId, sendMessage]);

  const handleNavigationAction = async (action: NavigationGuardAction) => {
    if (!navigationDialog) return;

    // ダイアログを即座に閉じる
    setNavigationDialog(null);

    if (action === "save") {
      setIsSavingForNavigation(true);
      try {
        const success = await handleImmediateSave();
        if (success) {
          // 保存成功時も編集終了処理を実行
          handleStopEditing();
        }
        navigationDialog.resolve(success ? "save" : "cancel");
      } catch (error) {
        console.error("Save failed:", error);
        navigationDialog.resolve("cancel");
      } finally {
        setIsSavingForNavigation(false);
      }
    } else if (action === "discard") {
      // 編集を破棄してナビゲーションする前に編集終了処理を実行
      handleStopEditing();
      navigationDialog.resolve("discard");
    } else {
      // cancel の場合は即座に resolve
      navigationDialog.resolve(action);
    }
  };

  // 簡素化：詳細な競合解決ハンドラーを削除

  // 開発環境でフォーム変更がある場合のみNavigation guard状態を出力
  if (process.env.NODE_ENV === 'development' && formChanged) {
    console.log("🔍 Weekly Report - Navigation guard state:", {
      formChanged,
      isSubmitting,
      shouldBlock: (formChanged || (isEditMode && permissionChecked)) && !isSubmitting,
      permissionChecked,
      isEditMode
    });
  }

  useNavigationGuard({
    shouldBlock: (formChanged || (isEditMode && permissionChecked)) && !isSubmitting,
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
          latestReport={latestReport}
          isLoadingLatest={isLoadingLatest}
          editingUsers={editingUsers}
          currentUserId={currentUserId || undefined}
          onManualAutoSave={handleManualAutoSave}
          onCopyFromLastReport={copyFromLastReport}
          onShowMilestoneDialog={() => setShowMilestoneDialog(true)}
          onShowSampleDialog={() => setShowSampleDialog(true)}
          onStopEditing={handleStopEditing}
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
            // ダイアログが閉じられる場合も編集終了処理を実行してから閲覧モードに遷移
            handleStopEditing();
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
