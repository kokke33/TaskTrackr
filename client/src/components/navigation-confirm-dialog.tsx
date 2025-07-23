import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Save, Trash2, X, Loader2 } from "lucide-react";
import { NavigationGuardAction } from "@/hooks/use-navigation-guard";

type NavigationConfirmDialogProps = {
  open: boolean;
  onAction: (action: NavigationGuardAction) => void;
  targetPath?: string;
  isSaving?: boolean;
};

export function NavigationConfirmDialog({
  open,
  onAction,
  targetPath,
  isSaving = false,
}: NavigationConfirmDialogProps) {
  const [selectedAction, setSelectedAction] = useState<NavigationGuardAction | null>(null);

  const handleAction = (action: NavigationGuardAction) => {
    setSelectedAction(action);
    onAction(action);
  };

  const getTargetDescription = (path?: string) => {
    if (!path) return "別のページ";
    
    if (path.includes("/reports")) return "レポート一覧";
    if (path.includes("/cases")) return "ケース管理";
    if (path.includes("/projects")) return "プロジェクト管理";
    if (path.includes("/settings")) return "設定";
    if (path === "/") return "ホーム";
    
    return "別のページ";
  };

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-[500px] max-w-[90vw]" onPointerDownOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Save className="h-5 w-5 text-orange-500" />
            未保存の変更があります
          </DialogTitle>
          <DialogDescription>
            週次報告に未保存の変更があります。{getTargetDescription(targetPath)}に移動する前に、変更を保存しますか？
          </DialogDescription>
        </DialogHeader>
        
        <div className="py-4">
          <div className="text-sm text-muted-foreground">
            最後の自動保存から変更された内容は失われます。
          </div>
        </div>

        <DialogFooter className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:space-x-2">
          <Button
            variant="outline"
            onClick={() => handleAction("cancel")}
            disabled={isSaving}
            className="w-full sm:w-auto sm:min-w-[100px]"
          >
            <X className="h-4 w-4 mr-2" />
            キャンセル
          </Button>
          
          <Button
            variant="destructive"
            onClick={() => handleAction("discard")}
            disabled={isSaving}
            className="w-full sm:w-auto sm:min-w-[120px]"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            保存せずに移動
          </Button>
          
          <Button
            onClick={() => handleAction("save")}
            disabled={isSaving}
            className="w-full sm:w-auto sm:min-w-[120px]"
          >
            {isSaving && selectedAction === "save" ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            {isSaving && selectedAction === "save" ? "保存中..." : "保存して移動"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}