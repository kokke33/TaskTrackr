import { Switch, Route, lazy } from "wouter";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import { AuthProvider } from "./lib/auth";
import { ProtectedRoute } from "./lib/protected-route";
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

const CaseView = lazy(() => import('./pages/case-view')); //Added lazy loading for CaseView component


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
      <ProtectedRoute path="/case/new" component={CaseForm} />
      <ProtectedRoute path="/case/edit/:id" component={CaseForm} />
      <ProtectedRoute path="/case/view/:id" component={CaseView} /> {/* Added route for case view */}
      <ProtectedRoute path="/projects" component={ProjectList} />
      <ProtectedRoute path="/project/new" component={ProjectForm} />
      <ProtectedRoute path="/project/edit/:id" component={ProjectForm} />
      <ProtectedRoute path="/project/:id" component={ProjectDetail} />
      <ProtectedRoute path="/project/name/:name" component={ProjectDetail} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Router />
        <Toaster />
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;