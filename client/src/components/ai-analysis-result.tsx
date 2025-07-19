import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ChevronDown, ChevronUp, X, Loader2, Lightbulb, RotateCcw } from "lucide-react";
import ReactMarkdown from "react-markdown";

interface AIAnalysisResultProps {
  analysis: string | null;
  isLoading: boolean;
  error: string | null;
  onClear: () => void;
  onRegenerate: () => void;
  fieldName: string;
}

export function AIAnalysisResult({
  analysis,
  isLoading,
  error,
  onClear,
  onRegenerate,
  fieldName,
}: AIAnalysisResultProps) {
  const [isExpanded, setIsExpanded] = useState(true);

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
              <div className="prose prose-sm max-w-none text-gray-700">
                <ReactMarkdown
                  components={{
                    p: ({ children }) => <p className="mb-2">{children}</p>,
                    strong: ({ children }) => <strong className="font-bold text-gray-900">{children}</strong>,
                  }}
                >
                  {analysis.replace(/\n/g, '  \n')}
                </ReactMarkdown>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}