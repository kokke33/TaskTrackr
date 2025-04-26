import { Switch, Route } from "wouter";
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
import NotFound from "@/pages/not-found";

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