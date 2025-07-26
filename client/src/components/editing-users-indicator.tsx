import { AlertTriangle } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { EditingUser } from "@/contexts/WebSocketContext";

interface EditingUsersIndicatorProps {
  editingUsers: EditingUser[];
  currentUserId?: string;
  className?: string;
}

export function EditingUsersIndicator({
  editingUsers,
  currentUserId,
  className = ""
}: EditingUsersIndicatorProps) {
  console.log('[EditingUsersIndicator] Rendering with:', {
    editingUsers,
    currentUserId,
    editingUsersLength: editingUsers?.length
  });

  // editingUsersがundefinedまたはnullの場合のエラーハンドリング
  if (!editingUsers || !Array.isArray(editingUsers)) {
    console.log('[EditingUsersIndicator] editingUsers is not valid array, returning null');
    return null;
  }

  // 現在のユーザーを除いた編集中ユーザー
  const otherEditingUsers = editingUsers.filter(user => user.userId !== currentUserId);
  
  console.log('[EditingUsersIndicator] After filtering:', {
    otherEditingUsers,
    otherEditingUsersLength: otherEditingUsers.length
  });
  
  if (otherEditingUsers.length === 0) {
    return null;
  }
  
  const formatTimeSince = (date: Date) => {
    const now = new Date();
    const diff = Math.floor((now.getTime() - date.getTime()) / 1000);
    
    if (diff < 60) {
      return "今";
    } else if (diff < 3600) {
      return `${Math.floor(diff / 60)}分前`;
    } else {
      return `${Math.floor(diff / 3600)}時間前`;
    }
  };
  
  const userNames = otherEditingUsers.map(u => u.username).join(', ');

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className={`flex items-center gap-2 text-amber-700 ${className}`}>
            <AlertTriangle className="h-4 w-4" />
            <span className="text-sm font-medium">
              {otherEditingUsers.length > 1
                ? `${otherEditingUsers.length}人が編集中`
                : `${userNames}さんも編集中`}
            </span>
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <div className="space-y-2">
            <div className="font-medium">編集中のユーザー:</div>
            {otherEditingUsers.map(user => (
              <div key={user.userId} className="text-sm">
                <div className="font-medium">{user.username}</div>
                <div className="text-muted-foreground">
                  開始: {formatTimeSince(user.startTime)} |
                  最終アクティビティ: {formatTimeSince(user.lastActivity)}
                </div>
              </div>
            ))}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}