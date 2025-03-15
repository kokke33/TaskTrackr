import { Switch, Route } from "wouter";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import WeeklyReport from "@/pages/weekly-report";
import WeeklyReportList from "@/pages/weekly-report-list";
import WeeklyReportDetail from "@/pages/weekly-report-detail";
import NotFound from "@/pages/not-found";

function Router() {
  return (
    <Switch>
      <Route path="/" component={WeeklyReport} />
      <Route path="/reports" component={WeeklyReportList} />
      <Route path="/reports/:id" component={WeeklyReportDetail} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Router />
      <Toaster />
    </QueryClientProvider>
  );
}

export default App;