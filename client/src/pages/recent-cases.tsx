import { useState, useEffect } from "react";
import { Link } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/lib/auth";
import { AdminOnly } from "@/lib/admin-only";
import { Loader2 } from "lucide-react";

// 案件データの型定義
interface Case {
  id: number;
  projectName: string;
  caseName: string;
  description: string | null;
  milestone: string | null;
  createdAt: string;
  isDeleted: boolean;
}

export default function RecentCases() {
  const [cases, setCases] = useState<Case[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const { user } = useAuth();

  useEffect(() => {
    const fetchRecentCases = async () => {
      try {
        setLoading(true);
        const data = await apiRequest<Case[]>("/api/recent-cases", {
          method: "GET",
        });
        setCases(data);
      } catch (error) {
        console.error("Error fetching recent cases:", error);
        toast({
          title: "エラー",
          description: "最近の案件一覧の取得に失敗しました",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    fetchRecentCases();
  }, [toast]);

  // 日付フォーマット関数
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("ja-JP", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
  };

  return (
    <div className="container mx-auto py-6 max-w-5xl">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold">最近更新された案件一覧 (TOP20)</h1>
        <div className="flex gap-2">
          <Link href="/cases">
            <Button variant="outline">全案件一覧</Button>
          </Link>
          <AdminOnly>
            <Link href="/case/new">
              <Button>新規案件作成</Button>
            </Link>
          </AdminOnly>
        </div>
      </div>
      <Separator className="my-4" />

      {loading ? (
        <div className="flex justify-center items-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span className="ml-2">読み込み中...</span>
        </div>
      ) : cases.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center">
            <p className="text-muted-foreground">案件データがありません</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>最近の案件</CardTitle>
            <CardDescription>更新日が新しい順に表示しています</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>プロジェクト</TableHead>
                  <TableHead>案件名</TableHead>
                  <TableHead>説明</TableHead>
                  <TableHead>マイルストーン</TableHead>
                  <TableHead>作成日</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {cases.map((case_) => (
                  <TableRow key={case_.id}>
                    <TableCell>{case_.projectName}</TableCell>
                    <TableCell>{case_.caseName}</TableCell>
                    <TableCell>{case_.description || "-"}</TableCell>
                    <TableCell>{case_.milestone || "-"}</TableCell>
                    <TableCell>{formatDate(case_.createdAt)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Link href={`/case/view/${case_.id}`}>
                          <Button variant="outline" size="sm">
                            詳細
                          </Button>
                        </Link>
                        <AdminOnly>
                          <Link href={`/case/edit/${case_.id}`}>
                            <Button variant="outline" size="sm">
                              編集
                            </Button>
                          </Link>
                        </AdminOnly>
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
