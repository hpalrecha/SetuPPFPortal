import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "./hooks/useAuth";
import LoginPage from "./pages/login";
import DashboardPage from "./pages/dashboard";
import WorkOrdersPage from "./pages/work-orders";
import JobCardsPage from "./pages/job-cards";
import PartnersPage from "./pages/partners";
import PricingPage from "./pages/pricing";
import CommissionsPage from "./pages/commissions";
import ReportsPage from "./pages/reports";
import AuditPage from "./pages/audit";
import SettingsPage from "./pages/settings";
import MainLayout from "./components/layout/main-layout";
import NotFound from "@/pages/not-found";

function ProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  return (
    <MainLayout>
      <Component />
    </MainLayout>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/login" component={LoginPage} />
      <Route path="/" component={() => <ProtectedRoute component={DashboardPage} />} />
      <Route path="/dashboard" component={() => <ProtectedRoute component={DashboardPage} />} />
      <Route path="/work-orders" component={() => <ProtectedRoute component={WorkOrdersPage} />} />
      <Route path="/job-cards" component={() => <ProtectedRoute component={JobCardsPage} />} />
      <Route path="/partners" component={() => <ProtectedRoute component={PartnersPage} />} />
      <Route path="/pricing" component={() => <ProtectedRoute component={PricingPage} />} />
      <Route path="/commissions" component={() => <ProtectedRoute component={CommissionsPage} />} />
      <Route path="/reports" component={() => <ProtectedRoute component={ReportsPage} />} />
      <Route path="/audit" component={() => <ProtectedRoute component={AuditPage} />} />
      <Route path="/settings" component={() => <ProtectedRoute component={SettingsPage} />} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <Toaster />
          <Router />
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
