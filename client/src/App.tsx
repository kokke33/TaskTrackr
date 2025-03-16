import { Switch, Route } from "wouter";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import { AuthProvider } from "./lib/auth";
import Login from "@/pages/login";
import Home from "@/pages/Home";
import WeeklyReport from "@/pages/weekly-report";
import WeeklyReportList from "@/pages/weekly-report-list";
import WeeklyReportDetail from "@/pages/weekly-report-detail";
import CaseList from "@/pages/cases";
import CaseForm from "@/pages/case-form";
import NotFound from "@/pages/not-found";

function ProtectedRoute({ component: Component, ...rest }: { component: React.ComponentType<any>, path?: string }) {
  const { isAuthenticated } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!isAuthenticated) {
      setLocation('/login');
    }
  }, [isAuthenticated, setLocation]);

  return isAuthenticated ? <Component {...rest} /> : null;
}

function Router() {
  return (
    <Switch>
      <Route path="/login" component={Login} />
      <Route path="/" component={(props) => <ProtectedRoute component={Home} {...props} />} />
      <Route path="/report/new" component={(props) => <ProtectedRoute component={WeeklyReport} {...props} />} />
      <Route path="/report/edit/:id" component={(props) => <ProtectedRoute component={WeeklyReport} {...props} />} />
      <Route path="/reports" component={(props) => <ProtectedRoute component={WeeklyReportList} {...props} />} />
      <Route path="/reports/:id" component={(props) => <ProtectedRoute component={WeeklyReportDetail} {...props} />} />
      <Route path="/cases" component={(props) => <ProtectedRoute component={CaseList} {...props} />} />
      <Route path="/case/new" component={(props) => <ProtectedRoute component={CaseForm} {...props} />} />
      <Route path="/case/edit/:id" component={(props) => <ProtectedRoute component={CaseForm} {...props} />} />
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