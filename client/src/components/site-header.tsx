
import { Link, useLocation } from 'wouter';
import { useAuth } from '@/lib/auth';
import { Button } from './ui/button';
import { ThemeToggle } from './theme-toggle';
import { SearchBar } from './search-bar';
import { AdminOnly } from '@/lib/admin-only';
import { User, LogOut, Settings, Users, Loader2, Wifi, WifiOff } from 'lucide-react';
import { useEffect, useState } from 'react';

type SiteHeaderProps = {
  isLoading?: boolean;
};

export function SiteHeader({ isLoading = false }: SiteHeaderProps) {
  const { isAuthenticated, user, logout } = useAuth();
  const [location, setLocation] = useLocation();
  const [connectionStatus, setConnectionStatus] = useState<'online' | 'offline' | 'checking'>('online');

  // 週次報告リンクのクリックハンドラー
  const handleReportsClick = (e: React.MouseEvent) => {
    e.preventDefault();
    setLocation('/reports?reset=true');
  };

  // 接続状態監視
  useEffect(() => {
    if (!isAuthenticated) return;

    const checkConnection = async () => {
      setConnectionStatus('checking');
      
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);
        
        const response = await fetch('/api/check-auth', {
          method: 'GET',
          credentials: 'include',
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        if (response.ok) {
          const data = await response.json();
          setConnectionStatus(data.authenticated ? 'online' : 'offline');
        } else {
          setConnectionStatus('offline');
        }
      } catch (error) {
        setConnectionStatus('offline');
      }
    };

    // 初回チェック
    checkConnection();
    
    // 3分ごとにチェック
    const interval = setInterval(checkConnection, 3 * 60 * 1000);

    return () => clearInterval(interval);
  }, [isAuthenticated]);

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 items-center">
        <div className="hidden md:flex ml-6">
          <Link href="/" className="mr-6 flex items-center space-x-2">
            <span className="hidden font-bold sm:inline-block">TOP</span>
          </Link>
          <nav className="flex items-center space-x-6 text-sm font-medium">
            {isAuthenticated && (
              <>
                <AdminOnly>
                  <Link href="/projects">
                    <span className="transition-colors hover:text-foreground/80 cursor-pointer">プロジェクト</span>
                  </Link>
                </AdminOnly>
                <AdminOnly>
                  <Link href="/cases">
                    <span className="transition-colors hover:text-foreground/80 cursor-pointer">案件一覧</span>
                  </Link>
                </AdminOnly>
                <a href="#" onClick={handleReportsClick}>
                  <span className="transition-colors hover:text-foreground/80 cursor-pointer">週次報告</span>
                </a>
                <Link href="/meetings">
                  <span className="transition-colors hover:text-foreground/80 cursor-pointer">議事録</span>
                </Link>
                <AdminOnly>
                  <Link href="/admin/settings">
                    <span className="transition-colors hover:text-foreground/80 cursor-pointer">設定</span>
                  </Link>
                </AdminOnly>
                <AdminOnly>
                  <Link href="/admin/users">
                    <span className="transition-colors hover:text-foreground/80 cursor-pointer">ユーザ管理</span>
                  </Link>
                </AdminOnly>

              </>
            )}
          </nav>
        </div>
        
        {/* モバイル用のロゴ */}
        <div className="md:hidden ml-4">
          <Link href="/">
            <span className="flex items-center font-bold cursor-pointer">PMS</span>
          </Link>
        </div>
        
        <div className="flex flex-1 items-center justify-end space-x-2">
          {isAuthenticated && <SearchBar />}
          
          <nav className="flex items-center">
            <ThemeToggle />
            
            {isAuthenticated ? (
              <div className="flex items-center gap-2">
                <span className="hidden text-sm text-muted-foreground md:inline-block">
                  {user?.username}
                </span>
                <AdminOnly>
                  <Link href="/admin/settings">
                    <Button variant="ghost" size="icon" title="システム設定">
                      <Settings className="h-4 w-4" />
                    </Button>
                  </Link>
                </AdminOnly>
                <AdminOnly>
                  <Link href="/admin/users">
                    <Button variant="ghost" size="icon" title="ユーザ管理">
                      <Users className="h-4 w-4" />
                    </Button>
                  </Link>
                </AdminOnly>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={logout}
                  title="ログアウト"
                >
                  <LogOut className="h-5 w-5" />
                </Button>
                {/* 接続状態表示をログアウトボタンの直後に配置 */}
                {isAuthenticated && (
                  <div className="flex items-center gap-1 ml-1 px-2 py-1 bg-background/80 backdrop-blur-sm rounded-md text-xs border shadow-sm">
                    {connectionStatus === 'online' && (
                      <>
                        <Wifi className="h-3 w-3 text-green-500" />
                        <span>接続中</span>
                      </>
                    )}
                    {connectionStatus === 'offline' && (
                      <>
                        <WifiOff className="h-3 w-3 text-red-500" />
                        <span>接続切断</span>
                      </>
                    )}
                    {connectionStatus === 'checking' && (
                      <>
                        <div className="h-3 w-3 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                        <span>確認中</span>
                      </>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <Link href="/login">
                <Button variant="ghost" size="icon" title="ログイン">
                  <User className="h-5 w-5" />
                </Button>
              </Link>
            )}
          </nav>
        </div>
      </div>
    </header>
  );
}