import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { Calendar } from '@/components/ui/calendar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { format, addMonths, subMonths } from 'date-fns';
import { ja } from 'date-fns/locale';

interface WeeklyReport {
  id: number;
  reportPeriodStart: string;
  reportPeriodEnd: string;
  projectName: string;
  caseName: string;
  reporterName: string;
  progressRate: number;
  progressStatus: string;
}

interface CalendarData {
  [date: string]: number;
}

interface WeeklyReportsCalendarProps {
  className?: string;
}

export default function WeeklyReportsCalendar({ className }: WeeklyReportsCalendarProps) {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  
  // 現在表示中の月（前月と当月）
  const [previousMonth, setPreviousMonth] = useState(subMonths(new Date(), 1));
  const [currentMonth, setCurrentMonth] = useState(new Date());
  
  // カレンダーデータ（日付ごとのレポート件数）
  const [previousMonthData, setPreviousMonthData] = useState<CalendarData>({});
  const [currentMonthData, setCurrentMonthData] = useState<CalendarData>({});
  
  // ローディング状態
  const [loading, setLoading] = useState(true);
  
  // ツールチップ用のクリック状態
  const [clickedDate, setClickedDate] = useState<string | null>(null);
  const [tooltipReports, setTooltipReports] = useState<WeeklyReport[]>([]);
  const [tooltipLoading, setTooltipLoading] = useState(false);
  
  // キャッシュ用
  const [reportCache, setReportCache] = useState<{ [date: string]: WeeklyReport[] }>({});
  
  // 表示件数制限用
  const [showAllReports, setShowAllReports] = useState<{ [date: string]: boolean }>({});

  // カレンダーデータを取得
  const fetchCalendarData = async (year: number, month: number): Promise<CalendarData> => {
    try {
      const data = await apiRequest<CalendarData>(`/api/weekly-reports/calendar-data/${year}/${month}`, {
        method: 'GET'
      });
      return data;
    } catch (error) {
      console.error('Error fetching calendar data:', error);
      toast({duration: 1000,});
      return {};
    }
  };

  // 指定日付の週次報告を取得
  const fetchReportsByDate = async (date: string): Promise<WeeklyReport[]> => {
    try {
      const reports = await apiRequest<WeeklyReport[]>(`/api/weekly-reports/by-date/${date}`, {
        method: 'GET'
      });
      return reports;
    } catch (error) {
      console.error('Error fetching reports by date:', error);
      toast({duration: 1000,});
      return [];
    }
  };

  // 月変更時のデータ更新
  const updateCalendarData = async () => {
    setLoading(true);
    try {
      const [prevData, currData] = await Promise.all([
        fetchCalendarData(previousMonth.getFullYear(), previousMonth.getMonth() + 1),
        fetchCalendarData(currentMonth.getFullYear(), currentMonth.getMonth() + 1)
      ]);
      
      setPreviousMonthData(prevData);
      setCurrentMonthData(currData);
      
      // 月が変わったらキャッシュをクリア
      setReportCache({});
    } finally {
      setLoading(false);
    }
  };

  // 初期データ読み込み
  useEffect(() => {
    updateCalendarData();
  }, [previousMonth, currentMonth]);

  // 月移動
  const navigateMonth = (direction: 'prev' | 'next') => {
    if (direction === 'prev') {
      setPreviousMonth(subMonths(previousMonth, 1));
      setCurrentMonth(subMonths(currentMonth, 1));
    } else {
      setPreviousMonth(addMonths(previousMonth, 1));
      setCurrentMonth(addMonths(currentMonth, 1));
    }
  };

  // 日付クリック時のツールチップ表示処理
  const handleDateTooltipClick = async (date: Date, monthData: CalendarData, event: React.MouseEvent) => {
    event.stopPropagation();
    const dateString = format(date, 'yyyy-MM-dd');
    const reportCount = monthData[dateString] || 0;
    
    if (reportCount === 0) {
      return;
    }
    
    // 既にクリックされた日付の場合はツールチップを閉じる
    if (clickedDate === dateString) {
      setClickedDate(null);
      setTooltipReports([]);
      // 展開状態もリセット
      setShowAllReports(prev => ({
        ...prev,
        [dateString]: false
      }));
      return;
    }
    
    setClickedDate(dateString);
    
    // キャッシュにデータがある場合はすぐに表示
    if (reportCache[dateString]) {
      setTooltipReports(reportCache[dateString]);
      setTooltipLoading(false);
      return;
    }
    
    // データ取得
    setTooltipLoading(true);
    
    try {
      const reports = await fetchReportsByDate(dateString);
      setTooltipReports(reports);
      
      // キャッシュに保存
      setReportCache(prev => ({
        ...prev,
        [dateString]: reports
      }));
    } catch (error) {
      console.error('Error fetching tooltip reports:', error);
      setTooltipReports([]);
    } finally {
      setTooltipLoading(false);
    }
  };

  // 日付クリック時の処理
  const handleDateClick = async (date: Date, monthData: CalendarData) => {
    const dateString = format(date, 'yyyy-MM-dd');
    const reportCount = monthData[dateString] || 0;
    
    if (reportCount === 0) {
      toast({duration: 1000,});
      return;
    }

    // 該当日付の週次報告を取得
    const reports = await fetchReportsByDate(dateString);
    
    if (reports.length === 0) {
      toast({duration: 1000,});
      return;
    }

    if (reports.length === 1) {
      // 単一報告の場合は直接詳細画面へ遷移
      setLocation(`/reports/${reports[0].id}`);
    } else {
      // 複数報告の場合は選択モーダルを表示（簡易実装：最初の報告へ遷移）
      // TODO: 将来的には選択モーダルを実装
      setLocation(`/reports/${reports[0].id}`);
    }
  };

  // ツールチップ内容のレンダリング
  const renderTooltipContent = (reports: WeeklyReport[]) => {
    if (tooltipLoading) {
      return <div className="text-sm">読み込み中...</div>;
    }

    if (reports.length === 0) {
      return <div className="text-sm">週次報告がありません</div>;
    }

    const handleReportClick = (reportId: number, event: React.MouseEvent) => {
      event.preventDefault();
      event.stopPropagation();
      setClickedDate(null); // ツールチップを閉じる
      setLocation(`/reports/${reportId}`);
    };

    // テキストを指定した長さで省略する関数
    const truncateText = (text: string, maxLength: number): string => {
      if (text.length <= maxLength) return text;
      return text.substring(0, maxLength) + '...';
    };

    const dateString = format(new Date(reports[0].reportPeriodStart), 'yyyy-MM-dd');
    const maxInitialDisplay = 6; // 初期表示の最大件数
    const shouldShowToggle = reports.length > maxInitialDisplay;
    const isShowingAll = showAllReports[dateString] || false;
    const displayedReports = shouldShowToggle && !isShowingAll 
      ? reports.slice(0, maxInitialDisplay)
      : reports;
    const hiddenCount = reports.length - maxInitialDisplay;

    const handleToggleReports = (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setShowAllReports(prev => ({
        ...prev,
        [dateString]: !prev[dateString]
      }));
    };

    return (
      <div className="max-w-md text-left">
        <div className="font-semibold text-sm mb-2">
          {format(new Date(reports[0].reportPeriodStart), 'M月d日', { locale: ja })}の週次報告
          <span className="ml-1 text-xs text-gray-500">({reports.length}件)</span>
        </div>
        
        {/* スクロール可能な報告リスト */}
        <div className="max-h-80 overflow-y-auto space-y-1 pr-1">
          {displayedReports.map((report) => (
            <div 
              key={report.id} 
              className="border-b border-gray-200 pb-1 last:border-b-0 cursor-pointer hover:bg-blue-50 rounded-md p-1 -mx-1 transition-colors duration-150"
              onClick={(e) => handleReportClick(report.id, e)}
            >
              <div className="text-sm text-blue-600 hover:text-blue-800 font-medium">
                <span className="font-semibold">{truncateText(report.projectName, 12)}</span>
                <span className="mx-1">・</span>
                <span>{truncateText(report.caseName, 15)}</span>
                <span className="mx-2 text-gray-500">
                  報告者: {truncateText(report.reporterName, 8)}
                </span>
                <span className="text-gray-500">
                  進捗: {report.progressRate}%
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* 展開/折りたたみボタン */}
        {shouldShowToggle && (
          <div className="mt-2 border-t border-gray-100 pt-2">
            <button
              onClick={handleToggleReports}
              className="text-xs text-blue-600 hover:text-blue-800 font-medium"
            >
              {isShowingAll 
                ? '▲ 折りたたむ' 
                : `▼ 他${hiddenCount}件を表示`
              }
            </button>
          </div>
        )}

        <div className="text-xs text-gray-400 mt-2 border-t border-gray-100 pt-1">
          クリックして詳細画面へ
        </div>
      </div>
    );
  };

  // カスタムDayコンポーネント
  const CustomDay = ({ date, displayMonth, monthData }: { date: Date; displayMonth: Date; monthData: CalendarData }) => {
    const dateString = format(date, 'yyyy-MM-dd');
    const reportCount = monthData[dateString] || 0;
    const isToday = format(new Date(), 'yyyy-MM-dd') === dateString;
    const isOutsideMonth = date.getMonth() !== displayMonth.getMonth();
    const isClicked = clickedDate === dateString;
    
    const dayElement = (
      <button
        className={`relative h-9 w-9 p-0 font-normal aria-selected:opacity-100 inline-flex items-center justify-center rounded-md text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 hover:bg-accent hover:text-accent-foreground ${
          reportCount > 0 ? (isClicked ? 'bg-blue-700 text-white font-semibold' : 'bg-blue-500 text-white hover:bg-blue-600 font-semibold') :
          isToday ? 'bg-accent text-accent-foreground font-semibold' :
          isOutsideMonth ? 'text-muted-foreground opacity-50' : ''
        }`}
        onClick={(e) => {
          if (reportCount > 0) {
            handleDateTooltipClick(date, monthData, e);
          } else {
            handleDateClick(date, monthData);
          }
        }}
      >
        <span>{date.getDate()}</span>
        {reportCount > 0 && (
          <div className="absolute -top-1 -right-1 bg-blue-600 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center">
            {reportCount > 9 ? '9+' : reportCount}
          </div>
        )}
      </button>
    );

    if (reportCount > 0 && isClicked) {
      return (
        <Tooltip open={true}>
          <TooltipTrigger asChild>
            {dayElement}
          </TooltipTrigger>
          <TooltipContent 
            side="bottom" 
            className="max-w-md text-left"
          >
            {renderTooltipContent(tooltipReports)}
          </TooltipContent>
        </Tooltip>
      );
    }

    return dayElement;
  };

  // 外部クリック時にツールチップを閉じる
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (clickedDate) {
        setClickedDate(null);
        setTooltipReports([]);
      }
    };

    document.addEventListener('click', handleClickOutside);
    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  }, [clickedDate]);

  return (
    <TooltipProvider>
      <Card className={className}>
        <CardHeader>
          <CardTitle>週次報告カレンダー</CardTitle>
          <div className="flex justify-center items-center gap-4 mt-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigateMonth('prev')}
              disabled={loading}
              className="flex items-center gap-1"
            >
              <ChevronLeft className="h-4 w-4" />
              前月
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigateMonth('next')}
              disabled={loading}
              className="flex items-center gap-1"
            >
              次月
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* 前月カレンダー */}
          <div className="space-y-3">
            <div className="flex justify-center items-center py-2">
              <Button variant="ghost" size="sm" className="pointer-events-none">
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <h3 className="text-lg font-medium mx-4 min-w-[120px] text-center">
                {format(previousMonth, 'M月 yyyy', { locale: ja })}
              </h3>
              <Button variant="ghost" size="sm" className="pointer-events-none">
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
            <div className="border rounded-lg p-3">
              <Calendar
                mode="single"
                month={previousMonth}
                onMonthChange={() => {}} // 月変更は上部のボタンで制御
                disabled={loading}
                className="w-full"
                classNames={{
                  months: "flex w-full",
                  month: "space-y-4 w-full",
                  caption: "flex justify-center pt-1 relative items-center",
                  caption_label: "text-sm font-medium",
                  nav: "hidden", // ナビゲーションボタンを非表示
                  table: "w-full border-collapse space-y-1",
                  head_row: "flex w-full",
                  head_cell: "text-muted-foreground rounded-md w-8 font-normal text-[0.8rem] flex-1 text-center",
                  row: "flex w-full mt-2",
                  cell: "relative p-0 text-center text-sm focus-within:relative focus-within:z-20 flex-1",
                }}
                components={{
                  Day: ({ date, displayMonth }) => (
                    <CustomDay 
                      date={date} 
                      displayMonth={displayMonth} 
                      monthData={previousMonthData} 
                    />
                  )
                }}
              />
            </div>
          </div>

          {/* 当月カレンダー */}
          <div className="space-y-3">
            <div className="flex justify-center items-center py-2">
              <Button variant="ghost" size="sm" className="pointer-events-none">
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <h3 className="text-lg font-medium mx-4 min-w-[120px] text-center">
                {format(currentMonth, 'M月 yyyy', { locale: ja })}
              </h3>
              <Button variant="ghost" size="sm" className="pointer-events-none">
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
            <div className="border rounded-lg p-3">
              <Calendar
                mode="single"
                month={currentMonth}
                onMonthChange={() => {}} // 月変更は上部のボタンで制御
                disabled={loading}
                className="w-full"
                classNames={{
                  months: "flex w-full",
                  month: "space-y-4 w-full",
                  caption: "flex justify-center pt-1 relative items-center",
                  caption_label: "text-sm font-medium",
                  nav: "hidden", // ナビゲーションボタンを非表示
                  table: "w-full border-collapse space-y-1",
                  head_row: "flex w-full",
                  head_cell: "text-muted-foreground rounded-md w-8 font-normal text-[0.8rem] flex-1 text-center",
                  row: "flex w-full mt-2",
                  cell: "relative p-0 text-center text-sm focus-within:relative focus-within:z-20 flex-1",
                }}
                components={{
                  Day: ({ date, displayMonth }) => (
                    <CustomDay 
                      date={date} 
                      displayMonth={displayMonth} 
                      monthData={currentMonthData} 
                    />
                  )
                }}
              />
            </div>
          </div>
        </div>

        <div className="mt-6 text-sm text-muted-foreground text-center">
          <div className="flex items-center justify-center gap-4">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-blue-500 rounded"></div>
              <span>週次報告あり</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-accent rounded"></div>
              <span>今日</span>
            </div>
          </div>
          <p className="mt-2">
            青色の日付をクリックして週次報告一覧を表示し、詳細画面へ移動できます
          </p>
        </div>
      </CardContent>
    </Card>
    </TooltipProvider>
  );
}