import React from 'react';
import { SiteHeader } from './site-header';

type SiteLayoutProps = {
  children: React.ReactNode;
};

export function SiteLayout({ children }: SiteLayoutProps) {
  return (
    <div className="relative min-h-screen flex flex-col">
      <SiteHeader />
      <main className="flex-1">{children}</main>
      <footer className="py-6 border-t">
        <div className="container text-center text-sm text-muted-foreground">
          <p>© {new Date().getFullYear()} プロジェクト管理システム</p>
        </div>
      </footer>
    </div>
  );
}