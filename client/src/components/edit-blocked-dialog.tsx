import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Users, Clock } from "lucide-react";
import { EditingUser } from "@/contexts/WebSocketContext";

interface EditBlockedDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  message: string;
  editingUsers?: EditingUser[];
  onRetry?: () => void;
  onGoBack?: () => void;
}

export function EditBlockedDialog({
  open,
  onOpenChange,
  message,
  editingUsers,
  onRetry,
  onGoBack,
}: EditBlockedDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="sm:max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-amber-500" />
            編集できません
          </AlertDialogTitle>
          <AlertDialogDescription>
            {message}
            {editingUsers && editingUsers.length > 0 && (
              <div className="mt-4 space-y-2">
                <div className="font-medium text-sm">現在編集中のユーザー:</div>
                {editingUsers.map((user, index) => (
                  <div key={index} className="bg-muted p-2 rounded text-sm">
                    <div className="font-medium">{user.username}</div>
                    <div className="text-xs text-muted-foreground flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      編集開始: {new Date(user.startTime).toLocaleString()}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-col sm:flex-row gap-2">
          {onRetry && (
            <Button onClick={onRetry} variant="outline" className="w-full sm:w-auto">
              再試行
            </Button>
          )}
          {onGoBack && (
            <Button onClick={onGoBack} variant="outline" className="w-full sm:w-auto">
              戻る
            </Button>
          )}
          <AlertDialogAction asChild>
            <Button 
              onClick={() => onOpenChange(false)} 
              className="w-full sm:w-auto"
            >
              OK
            </Button>
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}