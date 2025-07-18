import { useState, useEffect } from 'react';
import { Link } from 'wouter';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Separator } from '@/components/ui/separator';
import { useAuth } from '@/lib/auth';
import { AdminOnly } from '@/lib/admin-only';
import { Loader2 } from 'lucide-react';

// 週次報告データの型定義
interface WeeklyReport {
  id: number;
  reportPeriodStart: string;
  reportPeriodEnd: string;
  projectName: string;
  caseName: string;
  reporterName: string;
  progressRate: number;
  progressStatus: string;
  issues: string | null;
  createdAt: string;
}

export default function RecentWeeklyReportsList() {
  const [reports, setReports] = useState<WeeklyReport[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const { user } = useAuth();

  useEffect(() => {
    const fetchRecentReports = async () => {
      try {
        setLoading(true);
        const data = await apiRequest<WeeklyReport[]>('/api/recent-reports', {
          method: 'GET'
        });
        setReports(data);
      } catch (error) {
        console.error('Error fetching weekly reports:', error);
        toast({
          title: 'エラー',
          description: '最近の週次報告一覧の取得に失敗しました',
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
      }
    };

    fetchRecentReports();
  }, [toast]);

  // 日付フォーマット関数
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
  };

  // 進捗状況を日本語表示にする関数
  const formatProgressStatus = (status: string): string => {
    const statusMap: Record<string, string> = {
      'on-schedule': '順調',
      'slightly-delayed': '少し遅れている',
      'severely-delayed': '大幅に遅れている',
      'ahead': '前倒しで進行中',
      // すでに日本語で格納されている場合はそのまま返す
      '順調': '順調',
      '遅延': '遅延',
      '要注意': '要注意'
    };
    return statusMap[status] || status; // マップにない場合は元の値を返す
  };

  return (
    <div className="container mx-auto px-4 py-6 max-w-4xl">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold">最近の週次報告一覧</h1>
        <div className="flex gap-2">
          <Link href="/reports">
            <Button variant="outline">全週次報告一覧</Button>
          </Link>
          <Link href="/report/new">
            <Button>新規報告作成</Button>
          </Link>
        </div>
      </div>
      <Separator className="my-4" />

      {loading ? (
        <div className="flex justify-center items-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span className="ml-2">読み込み中...</span>
        </div>
      ) : reports.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center">
            <p className="text-muted-foreground">週次報告データがありません</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>最近の週次報告</CardTitle>
            <CardDescription>作成タイムスタンプが新しい順に表示しています</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>作成日時</TableHead>
                  <TableHead>報告期間</TableHead>
                  <TableHead>プロジェクト</TableHead>
                  <TableHead>案件名</TableHead>
                  <TableHead className="w-16">報告者</TableHead>
                  <TableHead>進捗率</TableHead>
                  <TableHead>状況</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reports.map((report) => (
                  <TableRow key={report.id}>
                    <TableCell>{formatDate(report.createdAt)}</TableCell>
                    <TableCell>{formatDate(report.reportPeriodStart)} 〜 {formatDate(report.reportPeriodEnd)}</TableCell>
                    <TableCell>{report.projectName}</TableCell>
                    <TableCell>{report.caseName}</TableCell>
                    <TableCell>{report.reporterName}</TableCell>
                    <TableCell>{report.progressRate}%</TableCell>
                    <TableCell>
                      <span 
                        className={`px-2 py-1 rounded text-xs font-medium ${
                          report.progressStatus === 'on-schedule' || report.progressStatus === '順調' ? 'bg-green-100 text-green-800' :
                          report.progressStatus === 'severely-delayed' || report.progressStatus === '遅延' ? 'bg-red-100 text-red-800' :
                          report.progressStatus === 'slightly-delayed' || report.progressStatus === '要注意' ? 'bg-yellow-100 text-yellow-800' :
                          report.progressStatus === 'ahead' ? 'bg-blue-100 text-blue-800' :
                          'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {formatProgressStatus(report.progressStatus)}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Link href={`/reports/${report.id}`}>
                          <Button variant="outline" size="sm">
                            詳細
                          </Button>
                        </Link>
                        {user?.isAdmin && (
                          <AdminOnly>
                            <Link href={`/report/edit/${report.id}`}>
                              <Button variant="outline" size="sm">
                                編集
                              </Button>
                            </Link>
                          </AdminOnly>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
