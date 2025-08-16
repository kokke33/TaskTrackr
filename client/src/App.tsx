import { Switch, Route, useLocation } from "wouter";
import { lazy, Suspense, useMemo, useEffect } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import { AuthProvider } from "./lib/auth";
import { SiteLayout } from "@/components/site-layout";
import { WebSocketProvider } from "./contexts/WebSocketProvider";
import { ProtectedRoute } from "./lib/protected-route";
import { AdminRoute } from "./lib/admin-only";
import Login from "@/pages/login";
import Register from "@/pages/register";
import Home from "@/pages/Home";
import { debugLogger, DebugLogCategory } from "@/utils/debug-logger";
// 動的インポートによるコード分割とパフォーマンス最適化
const WeeklyReport = lazy(() => import("@/pages/weekly-report"));
const WeeklyReportList = lazy(() => import("@/pages/weekly-report-list"));
// WeeklyReportDetailを直接インポートしてAuthProviderスコープ問題を回避
import WeeklyReportDetail from "@/pages/weekly-report-detail";
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
  const [location, navigate] = useLocation();
  
  // ナビゲーションログ
  useEffect(() => {
    debugLogger.navigationComplete(location);
  }, [location]);
  
  return (
    <Switch>
      <Route path="/login" component={Login} />
      <Route path="/register" component={Register} />
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
        <WeeklyReportDetail {...props} />
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
  // WebSocket URLの確実な構築をメモ化して不要な再計算を防止
  const wsUrl = useMemo(() => {
    try {
      // 環境変数からポートを取得（VITE_PORTを優先）
      const envPort = import.meta.env.VITE_PORT || '5000';
      
      // 現在の環境情報を収集
      const protocol = window.location.protocol;
      const hostname = window.location.hostname;
      const port = window.location.port;
      
      console.log('WebSocket URL構築', { protocol, hostname, port, envPort });
      
      // 開発環境判定を強化
      const isDev = hostname === 'localhost' || hostname === '127.0.0.1';
      
      let baseUrl: string;
      if (isDev) {
        // 開発環境では環境変数からポートを使用
        baseUrl = `ws://localhost:${envPort}`;
      } else {
        // 本番環境
        const wsProtocol = protocol === 'https:' ? 'wss:' : 'ws:';
        const portStr = port ? `:${port}` : '';
        baseUrl = `${wsProtocol}//${hostname}${portStr}`;
      }
      
      const url = `${baseUrl}/ws`;
      
      console.log('WebSocket URL生成完了:', url);
      debugLogger.info(DebugLogCategory.WEBSOCKET, 'url_init', 'WebSocket URL構築完了', {
        url,
        isDev,
        protocol,
        hostname,
        port,
        envPort
      });
      
      return url;
    } catch (error) {
      // 最終フォールバック
      const fallbackUrl = 'ws://localhost:5000/ws';
      console.error('WebSocket URL構築エラー - フォールバック使用:', fallbackUrl, error);
      debugLogger.error(DebugLogCategory.WEBSOCKET, 'url_init', 'WebSocket URL構築エラー - フォールバック使用', error instanceof Error ? error : new Error(String(error)), { fallbackUrl });
      return fallbackUrl;
    }
  }, []); // 依存配列を空にして一度だけ実行

console.log("App: wsUrl value:", wsUrl); // デバッグ用ログ
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
