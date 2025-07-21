import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { ChevronDown, ChevronUp, X, Loader2, Lightbulb, RotateCcw, MessageCircle, Send } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";

interface ConversationMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface AIAnalysisResultProps {
  analysis: string | null;
  isLoading: boolean;
  error: string | null;
  onClear: () => void;
  onRegenerate: () => void;
  fieldName: string;
  conversations?: ConversationMessage[];
  isConversationLoading?: boolean;
  onSendMessage?: (message: string) => void;
  onClearConversations?: () => void;
}

export function AIAnalysisResult({
  analysis,
  isLoading,
  error,
  onClear,
  onRegenerate,
  fieldName,
  conversations = [],
  isConversationLoading = false,
  onSendMessage,
  onClearConversations,
}: AIAnalysisResultProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [isConversationExpanded, setIsConversationExpanded] = useState(false);
  const [messageInput, setMessageInput] = useState("");

  const handleSendMessage = () => {
    if (messageInput.trim() && onSendMessage) {
      onSendMessage(messageInput.trim());
      setMessageInput("");
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  if (!analysis && !isLoading && !error) {
    return null;
  }

  return (
    <Card className="mt-2 border-blue-200 bg-blue-50/30">
      <CardContent className="p-3">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Lightbulb className="h-4 w-4 text-blue-600" />
            <span className="text-sm font-medium text-blue-800">
              AI分析結果: {fieldName}
            </span>
          </div>
          <div className="flex items-center gap-1">
            {(analysis || error) && !isLoading && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  console.log("Regenerate button clicked for field:", fieldName);
                  onRegenerate();
                }}
                className="h-6 w-6 p-0 text-green-600 hover:bg-green-100"
                title="AI分析を再生成"
              >
                <RotateCcw className="h-3 w-3" />
              </Button>
            )}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setIsExpanded(!isExpanded)}
              className="h-6 w-6 p-0 text-blue-600 hover:bg-blue-100"
            >
              {isExpanded ? (
                <ChevronUp className="h-3 w-3" />
              ) : (
                <ChevronDown className="h-3 w-3" />
              )}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onClear}
              className="h-6 w-6 p-0 text-gray-500 hover:bg-gray-100"
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
        </div>

        {isExpanded && (
          <div className="border-t border-blue-200 pt-2">
            {isLoading && (
              <div className="flex items-center gap-2 text-sm text-blue-600">
                <Loader2 className="h-4 w-4 animate-spin" />
                AI分析中...
              </div>
            )}

            {error && (
              <div className="text-sm text-red-600 bg-red-50 p-2 rounded">
                エラー: {error}
              </div>
            )}

            {analysis && !isLoading && (
              <>
                <div className="prose prose-sm max-w-none text-gray-700">
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    rehypePlugins={[rehypeRaw]}
                    components={{
                      p: ({ children }) => <p className="mb-2">{children}</p>,
                      strong: ({ children }) => <strong className="font-bold text-gray-900">{children}</strong>,
                      table: ({ children }) => (
                        <table className="min-w-full border-collapse border border-gray-300 my-3">
                          {children}
                        </table>
                      ),
                      thead: ({ children }) => (
                        <thead className="bg-gray-50">{children}</thead>
                      ),
                      tbody: ({ children }) => (
                        <tbody>{children}</tbody>
                      ),
                      tr: ({ children }) => (
                        <tr className="border-b border-gray-200">{children}</tr>
                      ),
                      th: ({ children }) => (
                        <th className="border border-gray-300 px-3 py-2 text-left font-semibold text-sm">
                          {children}
                        </th>
                      ),
                      td: ({ children }) => (
                        <td className="border border-gray-300 px-3 py-2 text-sm">
                          {children}
                        </td>
                      ),
                    }}
                  >
                    {analysis.replace(/\n/g, '  \n')}
                  </ReactMarkdown>
                </div>

                {/* 会話機能の質問ボタン */}
                <div className="mt-3 pt-3 border-t border-blue-200">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setIsConversationExpanded(!isConversationExpanded)}
                    className="text-blue-600 border-blue-300 hover:bg-blue-50"
                  >
                    <MessageCircle className="h-4 w-4 mr-2" />
                    {isConversationExpanded ? "会話を閉じる" : "AIに質問する"}
                    {conversations.length > 0 && (
                      <span className="ml-2 bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full">
                        {conversations.length}
                      </span>
                    )}
                  </Button>
                </div>

                {/* 会話セクション */}
                {isConversationExpanded && (
                  <div className="mt-3 p-3 bg-gray-50 rounded-lg border">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-sm font-medium text-gray-700">会話履歴</h4>
                      {conversations.length > 0 && onClearConversations && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={onClearConversations}
                          className="text-gray-500 hover:text-gray-700"
                        >
                          <X className="h-3 w-3" />
                          履歴をクリア
                        </Button>
                      )}
                    </div>

                    {/* 会話履歴表示 */}
                    {conversations.length > 0 && (
                      <div className="space-y-3 mb-3 max-h-60 overflow-y-auto">
                        {conversations.filter(message => message && message.id && message.content).map((message) => {
                          // デバッグログ追加
                          console.log('Rendering message:', {
                            id: message.id,
                            role: message.role,
                            content: message.content,
                            contentType: typeof message.content,
                            timestamp: message.timestamp
                          });
                          
                          return (
                          <div
                            key={message.id}
                            className={`flex ${
                              message.role === 'user' ? 'justify-end' : 'justify-start'
                            }`}
                          >
                            <div
                              className={`max-w-[80%] p-2 rounded-lg text-sm ${
                                message.role === 'user'
                                  ? 'bg-blue-500 text-white'
                                  : 'bg-white text-gray-700 border'
                              }`}
                            >
                              {message.role === 'assistant' ? (
                                <ReactMarkdown
                                  remarkPlugins={[remarkGfm]}
                                  rehypePlugins={[rehypeRaw]}
                                  components={{
                                    p: ({ children }) => <p className="mb-1 last:mb-0">{children}</p>,
                                    table: ({ children }) => (
                                      <table className="min-w-full border-collapse border border-gray-300 my-2">
                                        {children}
                                      </table>
                                    ),
                                    thead: ({ children }) => (
                                      <thead className="bg-gray-50">{children}</thead>
                                    ),
                                    tbody: ({ children }) => (
                                      <tbody>{children}</tbody>
                                    ),
                                    tr: ({ children }) => (
                                      <tr className="border-b border-gray-200">{children}</tr>
                                    ),
                                    th: ({ children }) => (
                                      <th className="border border-gray-300 px-2 py-1 text-left font-semibold text-xs">
                                        {children}
                                      </th>
                                    ),
                                    td: ({ children }) => (
                                      <td className="border border-gray-300 px-2 py-1 text-xs">
                                        {children}
                                      </td>
                                    ),
                                    strong: ({ children }) => (
                                      <strong className="font-bold">{children}</strong>
                                    ),
                                  }}
                                >
                                  {String(message.content || '')}
                                </ReactMarkdown>
                              ) : (
                                String(message.content || '')
                              )}
                              <div
                                className={`text-xs mt-1 ${
                                  message.role === 'user' ? 'text-blue-100' : 'text-gray-500'
                                }`}
                              >
                                {(() => {
                                  try {
                                    const timestamp = message.timestamp instanceof Date 
                                      ? message.timestamp 
                                      : new Date(message.timestamp);
                                    return timestamp.toLocaleTimeString('ja-JP', {
                                      hour: '2-digit',
                                      minute: '2-digit',
                                    });
                                  } catch {
                                    return '時刻不明';
                                  }
                                })()}
                              </div>
                            </div>
                          </div>
                          );
                        })}
                      </div>
                    )}

                    {/* メッセージ入力 */}
                    <div className="flex gap-2">
                      <Textarea
                        value={messageInput}
                        onChange={(e) => setMessageInput(e.target.value)}
                        onKeyDown={handleKeyPress}
                        placeholder="分析結果について質問してください..."
                        className="flex-1 min-h-[60px] resize-none"
                        disabled={isConversationLoading}
                      />
                      <Button
                        type="button"
                        onClick={handleSendMessage}
                        disabled={!messageInput.trim() || isConversationLoading}
                        className="self-end"
                      >
                        {isConversationLoading ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Send className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}