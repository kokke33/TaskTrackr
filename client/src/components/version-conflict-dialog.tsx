import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { RefreshCw, Upload, GitMerge, Eye } from "lucide-react";

interface VersionConflictDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conflictDetails: {
    currentVersion: number;
    serverVersion: number;
  } | null;
  onResolve: (resolution: 'reload' | 'override' | 'merge' | 'detailed') => void;
}

export function VersionConflictDialog({
  open,
  onOpenChange,
  conflictDetails,
  onResolve,
}: VersionConflictDialogProps) {
  console.log('🔥 [VersionConflictDialog] Rendering with props:', {
    open,
    conflictDetails,
    hasConflictDetails: !!conflictDetails
  });

  const handleResolve = (resolution: 'reload' | 'override' | 'merge' | 'detailed') => {
    console.log('🔥 [VersionConflictDialog] Resolving with:', resolution);
    onResolve(resolution);
    onOpenChange(false);
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="sm:max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <GitMerge className="h-5 w-5 text-amber-500" />
            データ競合が発生しました
          </AlertDialogTitle>
          <AlertDialogDescription>
            他のユーザーがこの週次報告を更新しました。
            {conflictDetails && (
              <div className="mt-2 text-sm bg-muted p-2 rounded">
                <div>現在の版数: {conflictDetails.currentVersion}</div>
                <div>サーバーの版数: {conflictDetails.serverVersion}</div>
              </div>
            )}
            対応方法を選択してください：
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-col sm:flex-col space-y-2">
          <Button 
            onClick={() => handleResolve('detailed')} 
            className="w-full"
            variant="secondary"
          >
            <Eye className="h-4 w-4 mr-2" />
            詳細な差分を確認して選択
          </Button>
          <div className="text-sm text-muted-foreground">
            変更内容を詳しく確認し、フィールドごとに選択できます。
          </div>
          
          <Button 
            onClick={() => handleResolve('merge')} 
            className="w-full"
            variant="default"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            最新データで更新（推奨）
          </Button>
          <div className="text-sm text-muted-foreground">
            サーバーの最新データで画面を更新します。編集内容は失われる可能性があります。
          </div>
          
          <Button 
            onClick={() => handleResolve('override')} 
            className="w-full"
            variant="destructive"
          >
            <Upload className="h-4 w-4 mr-2" />
            編集内容で上書き
          </Button>
          <div className="text-sm text-muted-foreground">
            現在の編集内容で強制的に上書きします。他の変更は失われます。
          </div>
          
          <AlertDialogCancel asChild>
            <Button variant="outline" className="w-full">
              キャンセル
            </Button>
          </AlertDialogCancel>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}