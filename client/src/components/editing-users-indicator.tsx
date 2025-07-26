import { Users, Eye } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { EditingUser } from "@/hooks/use-websocket";

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
  // 現在のユーザーを除いた編集中ユーザー
  const otherEditingUsers = editingUsers.filter(user => user.userId !== currentUserId);
  
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
  
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className={`flex items-center gap-2 ${className}`}>
            <Badge variant="secondary" className="flex items-center gap-1 bg-blue-100 text-blue-800 hover:bg-blue-200">
              <Eye className="h-3 w-3" />
              <Users className="h-3 w-3" />
              <span>{otherEditingUsers.length}人が編集中</span>
            </Badge>
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