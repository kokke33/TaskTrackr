import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Calendar, Target } from "lucide-react";
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';

interface MilestoneDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  milestone: string | null | undefined;
  projectName: string;
  caseName: string;
}

export function MilestoneDialog({ 
  open, 
  onOpenChange, 
  milestone, 
  projectName, 
  caseName 
}: MilestoneDialogProps) {
  if (!milestone) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Target className="h-5 w-5" />
              マイルストーン情報
            </DialogTitle>
            <DialogDescription>
              <div className="space-y-3 mt-4">
                <div>
                  <Badge variant="outline" className="mb-2">
                    {projectName} - {caseName}
                  </Badge>
                </div>
                <p className="text-muted-foreground">
                  この案件にはマイルストーン情報が設定されていません。
                </p>
              </div>
            </DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    );
  }


  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            マイルストーン情報
          </DialogTitle>
          <DialogDescription>
            <div className="space-y-4 mt-4">
              <div>
                <Badge variant="outline" className="mb-3">
                  {projectName} - {caseName}
                </Badge>
              </div>
              <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-4 border">
                <div className="flex items-center gap-2 mb-3">
                  <Calendar className="h-4 w-4 text-blue-600" />
                  <span className="font-medium text-sm">マイルストーン詳細</span>
                </div>
                <div className="prose prose-sm max-w-none dark:prose-invert text-sm">
                  <ReactMarkdown 
                    remarkPlugins={[remarkGfm]} 
                    rehypePlugins={[rehypeRaw]}
                  >
                    {milestone}
                  </ReactMarkdown>
                </div>
              </div>
            </div>
          </DialogDescription>
        </DialogHeader>
      </DialogContent>
    </Dialog>
  );
}