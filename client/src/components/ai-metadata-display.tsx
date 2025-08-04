import { Clock, Cpu } from "lucide-react";

interface AIMetadataDisplayProps {
  aiModel?: string;
  createdAt?: string | Date;
  updatedAt?: string | Date;
  className?: string;
}

export function AIMetadataDisplay({
  aiModel,
  createdAt,
  updatedAt,
  className = "",
}: AIMetadataDisplayProps) {
  const formatDate = (date: string | Date | undefined): string => {
    if (!date) return "不明";
    
    try {
      const dateObj = typeof date === 'string' ? new Date(date) : date;
      return dateObj.toLocaleString('ja-JP', {
        year: 'numeric',
        month: 'numeric',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'Asia/Tokyo'
      });
    } catch (error) {
      return "不明";
    }
  };

  // メタデータが何もない場合は何も表示しない
  const hasMetadata = aiModel || createdAt || updatedAt;
  if (!hasMetadata) return null;

  return (
    <div className={`flex flex-wrap items-center gap-3 text-xs text-muted-foreground ${className}`}>
      {aiModel && (
        <div className="flex items-center gap-1">
          <Cpu className="h-3 w-3" />
          <span>{aiModel}</span>
        </div>
      )}
      
      {createdAt && (
        <div className="flex items-center gap-1">
          <Clock className="h-3 w-3" />
          <span>作成: {formatDate(createdAt)}</span>
        </div>
      )}
      
      {updatedAt && createdAt !== updatedAt && (
        <div className="flex items-center gap-1">
          <Clock className="h-3 w-3" />
          <span>更新: {formatDate(updatedAt)}</span>
        </div>
      )}
    </div>
  );
}