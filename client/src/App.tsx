import { Switch, Route } from "wouter";
import { lazy, Suspense } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import { AuthProvider } from "./lib/auth";
import { SiteLayout } from "@/components/site-layout";
import { WebSocketProvider } from "./contexts/WebSocketProvider";
import { ProtectedRoute } from "./lib/protected-route";
import { AdminRoute } from "./lib/admin-only";
import Login from "@/pages/login";
import Home from "@/pages/Home";
// 動的インポートによるコード分割とパフォーマンス最適化
const WeeklyReport = lazy(() => import("@/pages/weekly-report"));
const WeeklyReportList = lazy(() => import("@/pages/weekly-report-list"));
const WeeklyReportDetail = lazy(() => import("@/pages/weekly-report-detail"));
const CaseList = lazy(() => import("@/pages/cases"));
const CaseForm = lazy(() => import("@/pages/case-form"));
const ProjectList = lazy(() => import("@/pages/projects"));
const ProjectForm = lazy(() => import("@/pages/project-form"));
const ProjectDetail = lazy(() => import("@/pages/project-detail"));
const MeetingList = lazy(() => import("@/pages/meeting-list"));
const NotFound = lazy(() => import("@/pages/not-found"));
const SearchPage = lazy(() => import("@/pages/search"));
const RecentCases = lazy(() => import("@/pages/recent-cases"));
const RecentWeeklyReports = lazy(() => import("@/pages/recent-weekly-reports"));
const AdminSettings = lazy(() => import("@/pages/admin-settings"));
const AdminUsers = lazy(() => import("@/pages/admin-users"));
const CaseView = lazy(() => import('./pages/case-view'));


// Suspense用のローディングコンポーネント
const LoadingSpinner = () => (
  <div className="flex items-center justify-center min-h-[200px]">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
    <span className="ml-2 text-muted-foreground">読み込み中...</span>
  </div>
);

function Router() {
  return (
    <Switch>
      <Route path="/login" component={Login} />
      <ProtectedRoute path="/" component={Home} />
      
      {/* 週次報告関連 - Suspenseでラップ */}
      <ProtectedRoute path="/report/new" component={(props) => (
        <Suspense fallback={<LoadingSpinner />}>
          <WeeklyReport {...props} />
        </Suspense>
      )} />
      <ProtectedRoute path="/report/edit/:id" component={(props) => (
        <Suspense fallback={<LoadingSpinner />}>
          <WeeklyReport {...props} />
        </Suspense>
      )} />
      <ProtectedRoute path="/reports" component={(props) => (
        <Suspense fallback={<LoadingSpinner />}>
          <WeeklyReportList {...props} />
        </Suspense>
      )} />
      <ProtectedRoute path="/reports/:id" component={(props) => (
        <Suspense fallback={<LoadingSpinner />}>
          <WeeklyReportDetail {...props} />
        </Suspense>
      )} />
      
      {/* 会議・案件関連 */}
      <ProtectedRoute path="/meetings" component={(props) => (
        <Suspense fallback={<LoadingSpinner />}>
          <MeetingList {...props} />
        </Suspense>
      )} />
      <ProtectedRoute path="/cases" component={(props) => (
        <Suspense fallback={<LoadingSpinner />}>
          <CaseList {...props} />
        </Suspense>
      )} />
      <AdminRoute path="/case/new" component={(props) => (
        <Suspense fallback={<LoadingSpinner />}>
          <CaseForm {...props} />
        </Suspense>
      )} />
      <AdminRoute path="/case/edit/:id" component={(props) => (
        <Suspense fallback={<LoadingSpinner />}>
          <CaseForm {...props} />
        </Suspense>
      )} />
      <ProtectedRoute path="/case/view/:id" component={(props) => (
        <Suspense fallback={<LoadingSpinner />}>
          <CaseView {...props} />
        </Suspense>
      )} />
      
      {/* プロジェクト関連 */}
      <AdminRoute path="/projects" component={(props) => (
        <Suspense fallback={<LoadingSpinner />}>
          <ProjectList {...props} />
        </Suspense>
      )} />
      <AdminRoute path="/project/new" component={(props) => (
        <Suspense fallback={<LoadingSpinner />}>
          <ProjectForm {...props} />
        </Suspense>
      )} />
      <AdminRoute path="/project/edit/:id" component={(props) => (
        <Suspense fallback={<LoadingSpinner />}>
          <ProjectForm {...props} />
        </Suspense>
      )} />
      <ProtectedRoute path="/project/:id" component={(props) => (
        <Suspense fallback={<LoadingSpinner />}>
          <ProjectDetail {...props} />
        </Suspense>
      )} />
      <ProtectedRoute path="/project/name/:name" component={(props) => (
        <Suspense fallback={<LoadingSpinner />}>
          <ProjectDetail {...props} />
        </Suspense>
      )} />
      
      {/* その他のページ */}
      <ProtectedRoute path="/search" component={(props) => (
        <Suspense fallback={<LoadingSpinner />}>
          <SearchPage {...props} />
        </Suspense>
      )} />
      <ProtectedRoute path="/recent-cases" component={(props) => (
        <Suspense fallback={<LoadingSpinner />}>
          <RecentCases {...props} />
        </Suspense>
      )} />
      <ProtectedRoute path="/recent-weekly-reports" component={(props) => (
        <Suspense fallback={<LoadingSpinner />}>
          <RecentWeeklyReports {...props} />
        </Suspense>
      )} />
      
      {/* 管理者ページ */}
      <AdminRoute path="/admin/settings" component={(props) => (
        <Suspense fallback={<LoadingSpinner />}>
          <AdminSettings {...props} />
        </Suspense>
      )} />
      <AdminRoute path="/admin/users" component={(props) => (
        <Suspense fallback={<LoadingSpinner />}>
          <AdminUsers {...props} />
        </Suspense>
      )} />

      <Route component={() => (
        <Suspense fallback={<LoadingSpinner />}>
          <NotFound />
        </Suspense>
      )} />
    </Switch>
  );
}

function App() {
  const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  
  // WebSocket URLの安全な構築
  let wsUrl: string;
  try {
    const host = window.location.host;
    const defaultPort = import.meta.env?.VITE_PORT || '5000';
    
    if (!host || host.includes('undefined')) {
      // fallback to default development settings
      wsUrl = `ws://localhost:${defaultPort}/ws`;
      console.warn('[App] Using fallback WebSocket URL:', wsUrl);
    } else {
      wsUrl = `${wsProtocol}//${host}/ws`;
    }
  } catch (error) {
    const defaultPort = import.meta.env?.VITE_PORT || '5000';
    wsUrl = `ws://localhost:${defaultPort}/ws`;
    console.error('[App] Error constructing WebSocket URL, using fallback:', error);
  }

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <WebSocketProvider url={wsUrl}>
          <SiteLayout>
            <Router />
          </SiteLayout>
        </WebSocketProvider>
        <Toaster />
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
