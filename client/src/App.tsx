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
import WeeklyReport from "@/pages/weekly-report";
import WeeklyReportList from "@/pages/weekly-report-list";
import WeeklyReportDetail from "@/pages/weekly-report-detail";
import CaseList from "@/pages/cases";
import CaseForm from "@/pages/case-form";
import ProjectList from "@/pages/projects";
import ProjectForm from "@/pages/project-form";
import ProjectDetail from "@/pages/project-detail";
import MeetingList from "@/pages/meeting-list";
import NotFound from "@/pages/not-found";
import SearchPage from "@/pages/search";
import RecentCases from "@/pages/recent-cases";
import RecentWeeklyReports from "@/pages/recent-weekly-reports";
import AdminSettings from "@/pages/admin-settings";
import AdminUsers from "@/pages/admin-users";


const CaseView = lazy(() => import('./pages/case-view')); //React.lazyを使用


function Router() {
  return (
    <Switch>
      <Route path="/login" component={Login} />
      <ProtectedRoute path="/" component={Home} />
      <ProtectedRoute path="/report/new" component={WeeklyReport} />
      <ProtectedRoute path="/report/edit/:id" component={WeeklyReport} />
      <ProtectedRoute path="/reports" component={WeeklyReportList} />
      <ProtectedRoute path="/reports/:id" component={WeeklyReportDetail} />
      <ProtectedRoute path="/meetings" component={MeetingList} />
      <ProtectedRoute path="/cases" component={CaseList} />
      <AdminRoute path="/case/new" component={CaseForm} />
      <AdminRoute path="/case/edit/:id" component={CaseForm} />
      <ProtectedRoute path="/case/view/:id" component={(props) => (
        <Suspense fallback={<div>読み込み中...</div>}>
          <CaseView {...props} />
        </Suspense>
      )} />
      <AdminRoute path="/projects" component={ProjectList} />
      <AdminRoute path="/project/new" component={ProjectForm} />
      <AdminRoute path="/project/edit/:id" component={ProjectForm} />
      <ProtectedRoute path="/project/:id" component={ProjectDetail} />
      <ProtectedRoute path="/project/name/:name" component={ProjectDetail} />
      <ProtectedRoute path="/search" component={SearchPage} />
      <ProtectedRoute path="/recent-cases" component={RecentCases} />
      <ProtectedRoute path="/recent-weekly-reports" component={RecentWeeklyReports} />
      <AdminRoute path="/admin/settings" component={AdminSettings} />
      <AdminRoute path="/admin/users" component={AdminUsers} />

      <Route component={NotFound} />
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
