import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { Calendar } from '@/components/ui/calendar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { format, addMonths, subMonths, startOfMonth, endOfMonth } from 'date-fns';
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
  const [currentDate, setCurrentDate] = useState(new Date());
  const [previousMonth, setPreviousMonth] = useState(subMonths(new Date(), 1));
  const [currentMonth, setCurrentMonth] = useState(new Date());
  
  // カレンダーデータ（日付ごとのレポート件数）
  const [previousMonthData, setPreviousMonthData] = useState<CalendarData>({});
  const [currentMonthData, setCurrentMonthData] = useState<CalendarData>({});
  
  // ローディング状態
  const [loading, setLoading] = useState(true);

  // カレンダーデータを取得
  const fetchCalendarData = async (year: number, month: number): Promise<CalendarData> => {
    try {
      const data = await apiRequest<CalendarData>(`/api/weekly-reports/calendar-data/${year}/${month}`, {
        method: 'GET'
      });
      return data;
    } catch (error) {
      console.error('Error fetching calendar data:', error);
      toast({
        title: 'エラー',
        description: 'カレンダーデータの取得に失敗しました',
        variant: 'destructive',
      });
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
      toast({
        title: 'エラー',
        description: '週次報告の取得に失敗しました',
        variant: 'destructive',
      });
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

  // 日付クリック時の処理
  const handleDateClick = async (date: Date, monthData: CalendarData) => {
    const dateString = format(date, 'yyyy-MM-dd');
    const reportCount = monthData[dateString] || 0;
    
    if (reportCount === 0) {
      toast({
        title: '情報',
        description: 'この日付には週次報告がありません',
        variant: 'default',
      });
      return;
    }

    // 該当日付の週次報告を取得
    const reports = await fetchReportsByDate(dateString);
    
    if (reports.length === 0) {
      toast({
        title: '情報',
        description: 'この日付には週次報告がありません',
        variant: 'default',
      });
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

  // カスタム日付レンダリング
  const renderDay = (day: Date, monthData: CalendarData) => {
    const dateString = format(day, 'yyyy-MM-dd');
    const reportCount = monthData[dateString] || 0;
    
    return (
      <div className="relative w-full h-full flex items-center justify-center">
        <span className={reportCount > 0 ? 'font-semibold text-white' : ''}>
          {day.getDate()}
        </span>
        {reportCount > 0 && (
          <div className="absolute -top-1 -right-1 bg-blue-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center">
            {reportCount > 9 ? '9+' : reportCount}
          </div>
        )}
      </div>
    );
  };

  return (
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
                onSelect={(date) => date && handleDateClick(date, previousMonthData)}
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
                  day: "h-8 w-8 p-0 font-normal aria-selected:opacity-100 mx-auto hover:bg-accent hover:text-accent-foreground rounded-md",
                  day_today: "bg-accent text-accent-foreground font-semibold",
                  day_outside: "text-muted-foreground opacity-50",
                  day_disabled: "text-muted-foreground opacity-50",
                  day_selected: "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground",
                }}
                modifiers={{
                  hasReports: (date) => {
                    const dateString = format(date, 'yyyy-MM-dd');
                    return (previousMonthData[dateString] || 0) > 0;
                  }
                }}
                modifiersClassNames={{
                  hasReports: "bg-blue-500 text-white hover:bg-blue-600 cursor-pointer font-semibold"
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
                onSelect={(date) => date && handleDateClick(date, currentMonthData)}
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
                  day: "h-8 w-8 p-0 font-normal aria-selected:opacity-100 mx-auto hover:bg-accent hover:text-accent-foreground rounded-md",
                  day_today: "bg-accent text-accent-foreground font-semibold",
                  day_outside: "text-muted-foreground opacity-50",
                  day_disabled: "text-muted-foreground opacity-50",
                  day_selected: "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground",
                }}
                modifiers={{
                  hasReports: (date) => {
                    const dateString = format(date, 'yyyy-MM-dd');
                    return (currentMonthData[dateString] || 0) > 0;
                  }
                }}
                modifiersClassNames={{
                  hasReports: "bg-blue-500 text-white hover:bg-blue-600 cursor-pointer font-semibold"
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
            青色の日付をクリックして週次報告詳細画面へ移動できます
          </p>
        </div>
      </CardContent>
    </Card>
  );
}