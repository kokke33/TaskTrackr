import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { insertManagerMeetingSchema, type InsertManagerMeeting, type ManagerMeeting } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Edit } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface ManagerMeetingFormProps {
  projectId: number;
  meeting?: ManagerMeeting;
  onSuccess?: () => void;
}

const formSchema = insertManagerMeetingSchema.extend({
  meetingDate: insertManagerMeetingSchema.shape.meetingDate.refine(
    (date) => date !== undefined && date !== "",
    { message: "開催日は必須です" }
  ),
  title: insertManagerMeetingSchema.shape.title.refine(
    (title) => title.trim().length > 0,
    { message: "タイトルは必須です" }
  ),
  content: insertManagerMeetingSchema.shape.content.refine(
    (content) => content.trim().length > 0,
    { message: "議事録内容は必須です" }
  ),
});

export function ManagerMeetingForm({ projectId, meeting, onSuccess }: ManagerMeetingFormProps) {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<InsertManagerMeeting>({
    resolver: zodResolver(formSchema),
    defaultValues: meeting ? {
      projectId: meeting.projectId,
      meetingDate: meeting.meetingDate,
      yearMonth: meeting.yearMonth,
      title: meeting.title,
      content: meeting.content,
    } : {
      projectId,
      meetingDate: new Date().toISOString().split('T')[0],
      yearMonth: new Date().toISOString().slice(0, 7), // YYYY-MM format
      title: "",
      content: "",
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: InsertManagerMeeting) => {
      const response = await fetch(`/api/projects/${projectId}/manager-meetings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error("議事録の作成に失敗しました");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "manager-meetings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "manager-meetings", "months"] });
      toast({duration: 1000,});
      setOpen(false);
      form.reset();
      onSuccess?.();
    },
    onError: () => {
      toast({duration: 1000,});
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: InsertManagerMeeting) => {
      const response = await fetch(`/api/manager-meetings/${meeting!.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error("議事録の更新に失敗しました");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "manager-meetings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/manager-meetings", meeting!.id] });
      toast({duration: 1000,});
      setOpen(false);
      onSuccess?.();
    },
    onError: () => {
      toast({duration: 1000,});
    },
  });

  const onSubmit = (data: InsertManagerMeeting) => {
    // 開催日から年月を自動生成
    const date = new Date(data.meetingDate);
    const yearMonth = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    
    const submitData = {
      ...data,
      yearMonth,
      projectId
    };

    console.log('Submitting manager meeting with yearMonth:', yearMonth);

    if (meeting) {
      updateMutation.mutate(submitData);
    } else {
      createMutation.mutate(submitData);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant={meeting ? "outline" : "default"} size={meeting ? "sm" : "default"}>
          {meeting ? <Edit className="h-4 w-4" /> : <Plus className="h-4 w-4 mr-2" />}
          {meeting ? "" : "新規議事録作成"}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {meeting ? "議事録編集" : "新規議事録作成"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-1 gap-4">
            <div>
              <Label htmlFor="meetingDate">開催日</Label>
              <Input
                id="meetingDate"
                type="date"
                {...form.register("meetingDate")}
                className="mt-1"
              />
              {form.formState.errors.meetingDate && (
                <p className="text-sm text-red-600 mt-1">
                  {form.formState.errors.meetingDate.message}
                </p>
              )}
            </div>

            <div>
              <Label htmlFor="title">タイトル</Label>
              <Input
                id="title"
                placeholder="例: 5月度マネージャ定例会議"
                {...form.register("title")}
                className="mt-1"
              />
              {form.formState.errors.title && (
                <p className="text-sm text-red-600 mt-1">
                  {form.formState.errors.title.message}
                </p>
              )}
            </div>

            <div>
              <Label htmlFor="content">議事録内容</Label>
              <Textarea
                id="content"
                placeholder="【進捗確認】&#10;・MSAD_NEC_共同損サ: 順調に進行中、テスト工程に入る予定&#10;・NOSL_日新火災_契約管理: 設計書レビュー完了、開発着手&#10;&#10;【課題・懸念事項】&#10;・MSAD案件でNECとの調整に若干遅れ&#10;&#10;【アクションアイテム】&#10;・MSAD案件のスケジュール調整（山村）"
                rows={15}
                {...form.register("content")}
                className="mt-1"
              />
              {form.formState.errors.content && (
                <p className="text-sm text-red-600 mt-1">
                  {form.formState.errors.content.message}
                </p>
              )}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              キャンセル
            </Button>
            <Button
              type="submit"
              disabled={createMutation.isPending || updateMutation.isPending}
            >
              {createMutation.isPending || updateMutation.isPending
                ? "保存中..."
                : meeting
                ? "更新"
                : "作成"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}