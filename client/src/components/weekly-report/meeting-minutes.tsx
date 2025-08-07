import React, { useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

type Meeting = {
  id: number;
  title: string;
  content: string;
  createdAt: string;
  modifiedBy: string;
};

type EditingMeetings = {
  [key: number]: { title: string; content: string };
};

type MeetingMinutesProps = {
  meetings: Meeting[];
  editingMeetings: EditingMeetings;
  isUpdating: boolean;
  onStartEditing: (meetingId: number, title: string, content: string) => void;
  onCancelEditing: (meetingId: number) => void;
  onSave: (meetingId: number) => void;
  onUpdateField: (meetingId: number, field: 'title' | 'content', value: string) => void;
};

const MeetingMinutes = React.memo(({
  meetings,
  editingMeetings,
  isUpdating,
  onStartEditing,
  onCancelEditing,
  onSave,
  onUpdateField,
}: MeetingMinutesProps) => {
  // フォーカス保持のためのref
  const activeElementRef = useRef<{ id: number; type: 'title' | 'content' } | null>(null);
  const cursorPositionRef = useRef<number | null>(null);
  
  // フォーカスとカーソル位置を保存するハンドラ
  const handleFocus = (meetingId: number, type: 'title' | 'content') => {
    activeElementRef.current = { id: meetingId, type };
  };
  
  const handleSelect = (e: React.SyntheticEvent<HTMLTextAreaElement>, meetingId: number, type: 'title' | 'content') => {
    const target = e.target as HTMLTextAreaElement;
    if (activeElementRef.current?.id === meetingId && activeElementRef.current?.type === type) {
      cursorPositionRef.current = target.selectionStart;
    }
  };
  
  // フォーカスとカーソル位置を復元するuseEffect
  useEffect(() => {
    if (activeElementRef.current) {
      // コンポーネントが再レンダリングされた後にフォーカスを復元
      setTimeout(() => {
        const element = document.querySelector(`[data-meeting-id="${activeElementRef.current?.id}"][data-field="${activeElementRef.current?.type}"]`) as HTMLTextAreaElement | null;
        if (element && cursorPositionRef.current !== null) {
          element.focus();
          element.setSelectionRange(cursorPositionRef.current, cursorPositionRef.current);
        }
      }, 0);
    }
  });
  if (!meetings || meetings.length === 0) {
    return null;
  }

  return (
    <Card className="mt-6 sm:mt-8">
      <CardContent className="p-4 sm:p-6">
        <h2 className="text-lg sm:text-xl font-semibold mb-3 sm:mb-4 pb-2 border-b">■ 確認会議事録</h2>
        {meetings.map((meeting, index) => (
          <div key={meeting.id} className="mb-4 sm:mb-6 last:mb-0">
            {meetings.length > 1 && (
              <h3 className="text-base sm:text-lg font-medium mb-2 sm:mb-3 text-gray-700">
                {meetings.length - index}回目の修正 ({new Date(meeting.createdAt).toLocaleDateString('ja-JP')})
              </h3>
            )}
            <div className="bg-gray-50 rounded-lg p-3 sm:p-4">
              {editingMeetings[meeting.id] ? (
                // 編集モード
                <div className="mb-3 sm:mb-4">
                  <div className="mb-3 sm:mb-4">
                    <label className="block text-sm font-medium mb-2">タイトル:</label>
                    <input
                      type="text"
                      value={editingMeetings[meeting.id].title}
                      onChange={(e) => onUpdateField(meeting.id, 'title', e.target.value)}
                      className="w-full p-2 border rounded text-sm"
                      data-meeting-id={meeting.id}
                      data-field="title"
                      onFocus={() => handleFocus(meeting.id, 'title')}
                    />
                  </div>
                  <div className="mb-3 sm:mb-4">
                    <label className="block text-sm font-medium mb-2">内容:</label>
                    <Textarea
                      value={editingMeetings[meeting.id].content}
                      onChange={(e) => onUpdateField(meeting.id, 'content', e.target.value)}
                      className="min-h-[150px] sm:min-h-[200px] text-sm resize-none"
                      data-meeting-id={meeting.id}
                      data-field="content"
                      onFocus={() => handleFocus(meeting.id, 'content')}
                      onSelect={(e) => handleSelect(e, meeting.id, 'content')}
                    />
                  </div>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <Button 
                      type="button"
                      size="sm" 
                      onClick={() => onSave(meeting.id)}
                      disabled={isUpdating}
                    >
                      {isUpdating ? "保存中..." : "保存"}
                    </Button>
                    <Button 
                      type="button"
                      size="sm" 
                      variant="outline" 
                      onClick={() => onCancelEditing(meeting.id)}
                    >
                      キャンセル
                    </Button>
                  </div>
                </div>
              ) : (
                // 表示モード
                <div className="mb-3 sm:mb-4">
                  <div className="flex justify-between items-center mb-2">
                    <h4 className="font-medium">{meeting.title}</h4>
                    <Button 
                      type="button"
                      size="sm" 
                      variant="outline"
                      onClick={() => onStartEditing(meeting.id, meeting.title, meeting.content)}
                    >
                      編集
                    </Button>
                  </div>
                  <div className="prose prose-sm max-w-none bg-white p-3 rounded border">
                    <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>{meeting.content}</ReactMarkdown>
                  </div>
                </div>
              )}
              
              <div className="mt-3 text-sm text-gray-500">
                修正者: {meeting.modifiedBy} | 
                日時: {new Date(meeting.createdAt).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })}
              </div>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
});

// メモ化のためにpropsの比較関数を定義
MeetingMinutes.displayName = 'MeetingMinutes';

export { MeetingMinutes };