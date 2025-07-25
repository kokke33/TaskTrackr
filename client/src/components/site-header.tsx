
import { Link } from 'wouter';
import { useAuth } from '@/lib/auth';
import { Button } from './ui/button';
import { ThemeToggle } from './theme-toggle';
import { SearchBar } from './search-bar';
import { AdminOnly } from '@/lib/admin-only';
import { User, LogOut, Settings, Users } from 'lucide-react';

export function SiteHeader() {
  const { isAuthenticated, user, logout } = useAuth();

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 items-center">
        <div className="ml-4 hidden md:flex">
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
                <Link href="/reports">
                  <span className="transition-colors hover:text-foreground/80 cursor-pointer">週次報告</span>
                </Link>
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
        <div className="md:hidden">
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