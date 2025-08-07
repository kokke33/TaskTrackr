import { useState, useCallback, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

type Meeting = {
  id: number;
  title: string;
  content: string;
  createdAt: string;
  modifiedBy: string;
};

type UseMeetingMinutesGeneratorProps = {
  reportId?: number;
  isEditMode: boolean;
};

export function useMeetingMinutesGenerator({ reportId, isEditMode }: UseMeetingMinutesGeneratorProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: meetings } = useQuery<Meeting[]>({
    queryKey: [`/api/weekly-reports/${reportId}/meetings`],
    enabled: isEditMode && !!reportId,
  });

  const [editingMeetings, setEditingMeetings] = useState<{ [key: number]: { title: string; content: string } }>({});
  
  // debounce用のタイマーリファレンス
  const debounceTimers = useRef<{ [key: string]: NodeJS.Timeout }>({});

  const updateMeetingMutation = useMutation({
    mutationFn: async ({ meetingId, title, content }: { meetingId: number; title: string; content: string }) => {
      return apiRequest(`/api/weekly-reports/meetings/${meetingId}`, {
        method: 'PUT',
        data: { title, content },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/weekly-reports/${reportId}/meetings`] });
      toast({
        title: "成功",
        description: "議事録が更新されました",
      });
    },
    onError: () => {
      toast({
        title: "エラー",
        description: "議事録の更新に失敗しました",
        variant: "destructive",
      });
    },
  });

  const startEditingMeeting = (meetingId: number, title: string, content: string) => {
    setEditingMeetings(prev => ({ ...prev, [meetingId]: { title, content } }));
  };

  const cancelEditingMeeting = (meetingId: number) => {
    setEditingMeetings(prev => {
      const newState = { ...prev };
      delete newState[meetingId];
      return newState;
    });
  };

  const saveMeeting = (meetingId: number) => {
    const editData = editingMeetings[meetingId];
    if (editData) {
      updateMeetingMutation.mutate({
        meetingId,
        title: editData.title,
        content: editData.content,
      });
      cancelEditingMeeting(meetingId);
    }
  };

  const updateMeetingField = useCallback((meetingId: number, field: 'title' | 'content', value: string) => {
    const timerKey = `${meetingId}-${field}`;
    
    // 既存のタイマーをクリア
    if (debounceTimers.current[timerKey]) {
      clearTimeout(debounceTimers.current[timerKey]);
    }
    
    // 新しいタイマーを設定（100msのdebounce）
    debounceTimers.current[timerKey] = setTimeout(() => {
      setEditingMeetings(prev => ({
        ...prev,
        [meetingId]: {
          ...prev[meetingId],
          [field]: value,
        },
      }));
    }, 100);
  }, []);

  return {
    meetings,
    editingMeetings,
    isUpdating: updateMeetingMutation.isPending,
    startEditingMeeting,
    cancelEditingMeeting,
    saveMeeting,
    updateMeetingField,
  };
}