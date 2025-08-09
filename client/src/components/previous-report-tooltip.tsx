import React from 'react';
import { Info } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface PreviousReportTooltipProps {
  previousContent?: string;
  fieldName: string;
}

export function PreviousReportTooltip({ previousContent, fieldName }: PreviousReportTooltipProps) {
  if (!previousContent || previousContent.trim() === '') {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Info className="h-4 w-4 text-gray-400 cursor-help ml-1" />
          </TooltipTrigger>
          <TooltipContent>
            <p className="text-sm">初回の報告です</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Info className="h-4 w-4 text-blue-500 cursor-help ml-1" />
        </TooltipTrigger>
        <TooltipContent className="max-w-md p-3">
          <div className="space-y-2">
            <p className="font-medium text-sm text-gray-900">前回報告内容</p>
            <div className="text-xs bg-gray-50 p-3 rounded border max-h-40 overflow-y-auto whitespace-pre-wrap leading-relaxed text-gray-700">
              {previousContent}
            </div>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}