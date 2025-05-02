import React from 'react';
import { Link } from 'wouter';
import { useAuth } from '@/lib/auth';
import { Button } from './ui/button';
import { ThemeToggle } from './theme-toggle';
import { SearchBar } from './search-bar';
import { User, LogOut } from 'lucide-react';

export function SiteHeader() {
  const { isAuthenticated, user, logout } = useAuth();

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 items-center">
        <div className="mr-4 hidden md:flex">
          <Link href="/" className="mr-6 flex items-center space-x-2">
            <span className="hidden font-bold sm:inline-block">プロジェクト管理システム</span>
          </Link>
          <nav className="flex items-center space-x-6 text-sm font-medium">
            {isAuthenticated && (
              <>
                <Link href="/projects">
                  <span className="transition-colors hover:text-foreground/80 cursor-pointer">プロジェクト</span>
                </Link>
                <Link href="/cases">
                  <span className="transition-colors hover:text-foreground/80 cursor-pointer">案件一覧</span>
                </Link>
                <Link href="/reports">
                  <span className="transition-colors hover:text-foreground/80 cursor-pointer">週次報告</span>
                </Link>
              </>
            )}
          </nav>
        </div>
        
        {/* モバイル用のロゴ */}
        <div className="md:hidden">
          <Link href="/">
            <a className="flex items-center">
              <span className="font-bold">PMS</span>
            </a>
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