import { SiteHeader } from './site-header';
import { useAuth } from '@/lib/auth';
import type { ReactNode } from 'react';

type SiteLayoutProps = {
  children: ReactNode;
};

export function SiteLayout({ children }: SiteLayoutProps) {
  const { isLoading } = useAuth();

  return (
    <div className="relative min-h-screen flex flex-col">
      <SiteHeader isLoading={isLoading} />
      <main className="flex-1">{children}</main>
      <footer className="py-6 border-t">
        <div className="container mx-auto text-center text-sm text-muted-foreground">
          <p>© {new Date().getFullYear()} プロジェクト管理システム</p>
        </div>
      </footer>
    </div>
  );
}