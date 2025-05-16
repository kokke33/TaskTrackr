import { Switch, Route } from "wouter";
import React, { lazy, Suspense } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import { AuthProvider } from "./lib/auth";
import { SiteLayout } from "@/components/site-layout";
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
import NotFound from "@/pages/not-found";
import SearchPage from "@/pages/search";
import RecentWeeklyReports from "@/pages/recent-weekly-reports";

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
      <ProtectedRoute path="/cases" component={CaseList} />
      <AdminRoute path="/case/new" component={CaseForm} />
      <AdminRoute path="/case/edit/:id" component={CaseForm} />
      <ProtectedRoute path="/case/view/:id" component={(props) => (
        <Suspense fallback={<div>読み込み中...</div>}>
          <CaseView {...props} />
        </Suspense>
      )} />
      <ProtectedRoute path="/projects" component={ProjectList} />
      <AdminRoute path="/project/new" component={ProjectForm} />
      <AdminRoute path="/project/edit/:id" component={ProjectForm} />
      <ProtectedRoute path="/project/:id" component={ProjectDetail} />
      <ProtectedRoute path="/project/name/:name" component={ProjectDetail} />
      <ProtectedRoute path="/search" component={SearchPage} />
      <ProtectedRoute path="/recent-weekly-reports" component={RecentWeeklyReports} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <SiteLayout>
          <Router />
        </SiteLayout>
        <Toaster />
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;