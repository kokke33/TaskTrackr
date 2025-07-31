import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Save, ShieldCheck, Target, FileText } from "lucide-react";
import { EditingUsersIndicator } from "@/components/editing-users-indicator";
import { EditingUser } from "@/contexts/WebSocketContext";

type ReportHeaderProps = {
  isEditMode: boolean;
  isAdminEditMode: boolean;
  reportId?: number;
  isAutosaving: boolean;
  formChanged: boolean;
  lastSavedTime: string | null;
  selectedCaseId: number | null;
  editingUsers: EditingUser[];
  currentUserId?: string;
  onManualAutoSave: () => void;
  onCopyFromLastReport: () => void;
  onShowMilestoneDialog: () => void;
  onShowSampleDialog: () => void;
};

export function ReportHeader({
  isEditMode,
  isAdminEditMode,
  reportId,
  isAutosaving,
  formChanged,
  lastSavedTime,
  selectedCaseId,
  editingUsers,
  currentUserId,
  onManualAutoSave,
  onCopyFromLastReport,
  onShowMilestoneDialog,
  onShowSampleDialog,
}: ReportHeaderProps) {
  return (
    <>
      {/* Sticky Header */}
      <div className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-2 sm:px-4">
          <div className="flex min-h-14 sm:h-14 items-center justify-between py-2 sm:py-0">
            <div className="flex items-center gap-2 sm:gap-4 flex-1 min-w-0">
              <h1 className="text-base sm:text-xl font-semibold truncate">
                {isAdminEditMode ? (
                  <span className="flex items-center gap-1 sm:gap-2 text-red-600">
                    <ShieldCheck className="h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0" />
                    <span className="hidden sm:inline">週次報告管理者編集</span>
                    <span className="sm:hidden">管理者編集</span>
                  </span>
                ) : isEditMode ? (
                  <>
                    <span className="hidden sm:inline">週次報告編集</span>
                    <span className="sm:hidden">編集</span>
                  </>
                ) : (
                  <>
                    <span className="hidden sm:inline">週次報告フォーム</span>
                    <span className="sm:hidden">フォーム</span>
                  </>
                )}
              </h1>
              {isEditMode && (
                <div className="hidden sm:block">
                  <EditingUsersIndicator
                    editingUsers={editingUsers}
                    currentUserId={currentUserId}
                  />
                </div>
              )}
            </div>
            <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
              <div className="hidden md:flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={onManualAutoSave}
                  disabled={isAutosaving || !formChanged}
                  className="flex items-center gap-1"
                >
                  <Save className="h-4 w-4" />
                  {isAutosaving ? "保存中..." : "自動保存"}
                </Button>
                <Button
                  type="button"
                  onClick={onShowMilestoneDialog}
                  variant="outline"
                  size="sm"
                  className="flex items-center gap-2 text-blue-600 border-blue-200 hover:bg-blue-50"
                >
                  <Target className="h-4 w-4" />
                  マイルストーン
                </Button>
                <Button
                  type="button"
                  onClick={onShowSampleDialog}
                  variant="outline"
                  size="sm"
                  className="flex items-center gap-2 text-green-600 border-green-200 hover:bg-green-50"
                >
                  <FileText className="h-4 w-4" />
                  記載サンプル
                </Button>
              </div>
              <div className="md:hidden flex items-center gap-1">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={onManualAutoSave}
                  disabled={isAutosaving || !formChanged}
                  className="flex items-center gap-1 px-2"
                >
                  <Save className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  onClick={onShowMilestoneDialog}
                  variant="outline"
                  size="sm"
                  className="flex items-center gap-1 text-blue-600 border-blue-200 hover:bg-blue-50 px-2"
                >
                  <Target className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  onClick={onShowSampleDialog}
                  variant="outline"
                  size="sm"
                  className="flex items-center gap-1 text-green-600 border-green-200 hover:bg-green-50 px-2"
                >
                  <FileText className="h-4 w-4" />
                </Button>
              </div>
              <Link href={isEditMode ? `/reports/${reportId}` : "/reports"}>
                <Button variant="ghost" size="sm" className="px-2 sm:px-3">
                  <span className="hidden sm:inline">戻る</span>
                  <span className="sm:hidden">×</span>
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Form Header inside the main content */}
      <div className="container mx-auto px-2 sm:px-4 py-4 sm:py-8 max-w-4xl">
        <header className="mb-6 sm:mb-8">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
            <h1 className="text-xl sm:text-3xl font-bold text-primary">
              {isAdminEditMode ? (
                <span className="flex items-center gap-2 text-red-600">
                  <ShieldCheck className="h-4 w-4 sm:h-5 sm:w-5" />
                  <span className="hidden sm:inline">週次報告管理者編集</span>
                  <span className="sm:hidden">管理者編集</span>
                </span>
              ) : isEditMode ? (
                <>
                  <span className="hidden sm:inline">週次報告編集</span>
                  <span className="sm:hidden">編集</span>
                </>
              ) : (
                <>
                  <span className="hidden sm:inline">週次報告フォーム</span>
                  <span className="sm:hidden">フォーム</span>
                </>
              )}
            </h1>
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-4">
              {lastSavedTime && (
                <span className="text-xs text-muted-foreground">
                  最終保存: {lastSavedTime}
                </span>
              )}
              {selectedCaseId && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={onCopyFromLastReport}
                  className="flex items-center gap-2 w-full sm:w-auto"
                >
                  <span className="hidden sm:inline">前回の報告をコピー</span>
                  <span className="sm:hidden">前回コピー</span>
                </Button>
              )}
            </div>
          </div>
        </header>
      </div>
    </>
  );
}