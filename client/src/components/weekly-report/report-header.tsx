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
        <div className="container mx-auto px-4">
          <div className="flex h-14 items-center justify-between">
            <div className="flex items-center gap-4">
              <h1 className="text-xl font-semibold">
                {isAdminEditMode ? (
                  <span className="flex items-center gap-2 text-red-600">
                    <ShieldCheck className="h-5 w-5" />
                    週次報告管理者編集
                  </span>
                ) : isEditMode ? "週次報告編集" : "週次報告フォーム"}
              </h1>
              {isEditMode && (
                <EditingUsersIndicator
                  editingUsers={editingUsers}
                  currentUserId={currentUserId}
                />
              )}
            </div>
            <div className="flex items-center gap-2">
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
              <Link href={isEditMode ? `/reports/${reportId}` : "/reports"}>
                <Button variant="ghost" size="sm">
                  戻る
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Form Header inside the main content */}
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <header className="mb-8">
          <div className="flex justify-between items-center">
            <h1 className="text-3xl font-bold text-primary">
              {isAdminEditMode ? (
                <span className="flex items-center gap-2 text-red-600">
                  <ShieldCheck className="h-5 w-5" />
                  週次報告管理者編集
                </span>
              ) : isEditMode ? "週次報告編集" : "週次報告フォーム"}
            </h1>
            <div className="flex items-center gap-4">
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
                  className="flex items-center gap-2"
                >
                  前回の報告をコピー
                </Button>
              )}
            </div>
          </div>
        </header>
      </div>
    </>
  );
}