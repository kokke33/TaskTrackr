import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { ja } from "date-fns/locale";
import { Calendar, Edit, Trash2, FileText, Eye } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { ManagerMeetingForm } from "./manager-meeting-form";
import type { ManagerMeeting } from "@shared/schema";

interface ManagerMeetingListProps {
  projectId: number;
  selectedMonth?: string;
}

export function ManagerMeetingList({ projectId, selectedMonth }: ManagerMeetingListProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: meetings = [], isLoading } = useQuery({
    queryKey: ["/api/projects", projectId, "manager-meetings", selectedMonth],
    queryFn: async () => {
      const params = selectedMonth ? `?yearMonth=${selectedMonth}` : "";
      const response = await fetch(`/api/projects/${projectId}/manager-meetings${params}`);
      if (!response.ok) throw new Error("議事録の取得に失敗しました");
      return response.json() as Promise<ManagerMeeting[]>;
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (meetingId: number) => {
      const response = await fetch(`/api/manager-meetings/${meetingId}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error("議事録の削除に失敗しました");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "manager-meetings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "manager-meetings", "months"] });
      toast({duration: 1000,});
    },
    onError: () => {
      toast({duration: 1000,});
    },
  });

  const formatContent = (content: string) => {
    return content.split('\n').slice(0, 3).join('\n') + (content.split('\n').length > 3 ? '\n...' : '');
  };

  // フルコンテンツ表示用のダイアログコンポーネント
  function FullContentDialog({ meeting }: { meeting: ManagerMeeting }) {
    const [isMarkdownView, setIsMarkdownView] = useState(false);

    return (
      <Dialog>
        <DialogTrigger asChild>
          <Button 
            variant="link" 
            className="p-0 h-auto text-blue-600 hover:text-blue-800 mt-2"
          >
            続きを読む
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              {meeting.title}
            </DialogTitle>
            <DialogDescription>
              {format(new Date(meeting.meetingDate), "yyyy年M月d日", { locale: ja })}の議事録を全文表示します
            </DialogDescription>
            <div className="flex items-center justify-end">
              <div className="flex items-center gap-2">
                <Button 
                  variant={isMarkdownView ? "outline" : "default"}
                  size="sm"
                  onClick={() => setIsMarkdownView(false)}
                >
                  <FileText className="h-4 w-4 mr-1" />
                  テキスト
                </Button>
                <Button 
                  variant={isMarkdownView ? "default" : "outline"}
                  size="sm"
                  onClick={() => setIsMarkdownView(true)}
                >
                  <Eye className="h-4 w-4 mr-1" />
                  マークダウン
                </Button>
              </div>
            </div>
          </DialogHeader>
          <div className="mt-4">
            {isMarkdownView ? (
              <div className="prose prose-sm max-w-none text-gray-700 bg-gray-50 p-4 rounded border leading-relaxed">
                <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>{meeting.content}</ReactMarkdown>
              </div>
            ) : (
              <div className="whitespace-pre-wrap text-sm text-gray-700 bg-gray-50 p-4 rounded border leading-relaxed">
                {meeting.content}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <Card key={i} className="animate-pulse">
            <CardHeader>
              <div className="h-4 bg-gray-200 rounded w-1/3"></div>
              <div className="h-3 bg-gray-200 rounded w-1/4"></div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="h-3 bg-gray-200 rounded"></div>
                <div className="h-3 bg-gray-200 rounded w-4/5"></div>
                <div className="h-3 bg-gray-200 rounded w-3/5"></div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (meetings.length === 0) {
    return (
      <div className="text-center py-12">
        <FileText className="mx-auto h-12 w-12 text-gray-400" />
        <h3 className="mt-2 text-sm font-medium text-gray-900">議事録がありません</h3>
        <p className="mt-1 text-sm text-gray-500">
          {selectedMonth 
            ? `${selectedMonth}の議事録は登録されていません。` 
            : "まだ議事録が登録されていません。"}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {meetings.map((meeting) => (
        <Card key={meeting.id} className="hover:shadow-md transition-shadow">
          <CardHeader>
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <CardTitle className="text-lg">{meeting.title}</CardTitle>
                <CardDescription className="flex items-center gap-1 mt-1">
                  <Calendar className="h-4 w-4" />
                  {format(new Date(meeting.meetingDate), "yyyy年M月d日", { locale: ja })}
                  <span className="ml-2 text-xs text-gray-500">
                    更新: {format(new Date(meeting.updatedAt), "MM/dd HH:mm", { locale: ja })}
                  </span>
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <ManagerMeetingForm 
                  projectId={projectId} 
                  meeting={meeting}
                />
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="outline" size="sm">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>議事録を削除しますか？</AlertDialogTitle>
                      <AlertDialogDescription>
                        この操作は取り消せません。議事録「{meeting.title}」を完全に削除します。
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>キャンセル</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => deleteMutation.mutate(meeting.id)}
                        className="bg-red-600 hover:bg-red-700"
                        disabled={deleteMutation.isPending}
                      >
                        {deleteMutation.isPending ? "削除中..." : "削除"}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="prose prose-sm max-w-none">
              <div className="whitespace-pre-wrap text-sm text-gray-700 bg-gray-50 p-3 rounded border">
                {formatContent(meeting.content)}
              </div>
              {meeting.content.split('\n').length > 3 && (
                <FullContentDialog meeting={meeting} />
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}