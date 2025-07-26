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
    editingUsersLength: editingUsers?.length,
    currentUserIdType: typeof currentUserId,
    currentUserIdValue: currentUserId
  });

  // editingUsersがundefinedまたはnullの場合のエラーハンドリング
  if (!editingUsers || !Array.isArray(editingUsers)) {
    console.log('[EditingUsersIndicator] editingUsers is not valid array, returning null');
    return null;
  }

  // 詳細なユーザー情報のデバッグログ
  editingUsers.forEach((user, index) => {
    console.log(`[EditingUsersIndicator] User[${index}]:`, {
      userId: user.userId,
      userIdType: typeof user.userId,
      username: user.username,
      isCurrentUser: user.userId === currentUserId,
      strictEqual: user.userId === currentUserId,
      stringComparison: String(user.userId) === String(currentUserId)
    });
  });

  // 現在のユーザーを除いた編集中ユーザー（より厳密な比較）
  const otherEditingUsers = editingUsers.filter(user => {
    const isCurrentUser = String(user.userId) === String(currentUserId);
    console.log(`[EditingUsersIndicator] Filtering user ${user.username}:`, {
      userId: user.userId,
      currentUserId,
      isCurrentUser,
      willExclude: isCurrentUser
    });
    return !isCurrentUser;
  });
  
  console.log('[EditingUsersIndicator] After filtering:', {
    originalCount: editingUsers.length,
    filteredCount: otherEditingUsers.length,
    otherEditingUsers: otherEditingUsers.map(u => ({ userId: u.userId, username: u.username }))
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