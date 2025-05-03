import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { ClipboardEdit, List, FolderKanban, Briefcase, RefreshCw } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { AdminOnly } from "@/lib/admin-only";
import { useEffect } from "react";
import { apiRequest } from "@/lib/queryClient";

export default function Home() {
  const { user } = useAuth();
  
  // デバッグ用
  useEffect(() => {
    console.log("Home: ユーザー情報:", user);
    console.log("管理者権限:", user?.isAdmin);
  }, [user]);
  
  // 強制的に認証を再確認するための関数
  const refreshAuth = async () => {
    try {
      const data = await apiRequest("/api/check-auth", {
        method: "GET"
      });
      console.log("認証情報再取得結果:", data);
      // ページをリロード
      window.location.reload();
    } catch (error) {
      console.error("認証情報取得エラー:", error);
    }
  };
  
  return (
    <div className="min-h-screen bg-background">
      <ThemeToggle />
      
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto text-center">
          <h1 className="text-4xl font-bold text-primary mb-4">週次報告</h1>
          <div className="flex items-center justify-center mb-4">
            <p className="text-muted-foreground">
              {user?.username || ''}
              {user?.isAdmin && <span className="ml-2 text-green-600">(管理者)</span>}
            </p>
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={refreshAuth} 
              title="認証情報を更新" 
              className="ml-2"
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
          <p className="text-muted-foreground mb-8">
            <span style={{ color: 'red' }}>週次報告は「週ごとに」新規作成してください。</span>
          </p>
          <div className="grid gap-4 md:grid-cols-2">
            <Link href="/report/new">
              <Button
                variant="outline"
                className="w-full h-32 text-left flex flex-col items-center justify-center gap-2"
              >
                <ClipboardEdit className="h-8 w-8" />
                <div>
                  <div className="font-semibold">新規報告作成</div>
                  <div className="text-sm text-muted-foreground">週次報告を入力する</div>
                </div>
              </Button>
            </Link>

            <Link href="/reports">
              <Button
                variant="outline"
                className="w-full h-32 text-left flex flex-col items-center justify-center gap-2"
              >
                <List className="h-8 w-8" />
                <div>
                  <div className="font-semibold">報告一覧</div>
                  <div className="text-sm text-muted-foreground">提出済みの報告を確認する</div>
                </div>
              </Button>
            </Link>
            
            <AdminOnly
              fallback={
                <div className="bg-muted w-full h-32 flex flex-col items-center justify-center gap-2 rounded-md border border-dashed">
                  <FolderKanban className="h-8 w-8 text-muted-foreground" />
                  <div>
                    <div className="font-semibold text-muted-foreground">プロジェクト管理</div>
                    <div className="text-sm text-muted-foreground opacity-60">管理者権限が必要です</div>
                  </div>
                </div>
              }
            >
              <Link href="/projects">
                <Button
                  variant="outline"
                  className="w-full h-32 text-left flex flex-col items-center justify-center gap-2"
                >
                  <FolderKanban className="h-8 w-8" />
                  <div>
                    <div className="font-semibold">プロジェクト管理</div>
                    <div className="text-sm text-muted-foreground">プロジェクト情報を管理する</div>
                  </div>
                </Button>
              </Link>
            </AdminOnly>

            <AdminOnly
              fallback={
                <div className="bg-muted w-full h-32 flex flex-col items-center justify-center gap-2 rounded-md border border-dashed">
                  <Briefcase className="h-8 w-8 text-muted-foreground" />
                  <div>
                    <div className="font-semibold text-muted-foreground">案件管理</div>
                    <div className="text-sm text-muted-foreground opacity-60">管理者権限が必要です</div>
                  </div>
                </div>
              }
            >
              <Link href="/cases">
                <Button
                  variant="outline"
                  className="w-full h-32 text-left flex flex-col items-center justify-center gap-2"
                >
                  <Briefcase className="h-8 w-8" />
                  <div>
                    <div className="font-semibold">案件管理</div>
                    <div className="text-sm text-muted-foreground">案件情報を管理する</div>
                  </div>
                </Button>
              </Link>
            </AdminOnly>
          </div>
        </div>
      </div>
    </div>
  );
}
