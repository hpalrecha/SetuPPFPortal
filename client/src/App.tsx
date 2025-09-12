import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "./hooks/use-auth";
import { OemProvider } from "./hooks/use-oem-context";
import LoginPage from "./pages/login";
import DashboardPage from "./pages/dashboard";
import WorkOrdersPage from "./pages/work-orders";
import JobCardsPage from "./pages/job-cards";
import PartnersPage from "./pages/partners";
import AllocationsPage from "./pages/allocations";
import PricingPage from "./pages/pricing";
import CommissionsPage from "./pages/commissions";
import ReportsPage from "./pages/reports";
import AuditPage from "./pages/audit";
import SettingsPage from "./pages/settings";
import OEMsPage from "./pages/oems";
import DealershipsPage from "./pages/dealerships";
import ShowroomsPage from "./pages/showrooms";
import SalesPersonsPage from "./pages/sales-persons";
import VehiclesPage from "./pages/vehicles";
import ServicesPage from "./pages/services";
import ServiceCategoriesPage from "./pages/ServiceCategories";
import PayoutSettlementPage from "./pages/payout-settlement";
import PartnerStaffPage from "./pages/partner-staff";
import PayoutsPage from "./pages/payouts";
import MainLayout from "./components/layout/main-layout";
import NotFound from "@/pages/not-found";
import { OemSelector } from "@/components/OemSelector";
import { useOemContext } from "./hooks/use-oem-context";

function ProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  const { needsOemSelection } = useOemContext();
  
  if (needsOemSelection) {
    return <OemSelector />;
  }
  
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
      <Route path="/work-orders/:id" component={() => <ProtectedRoute component={WorkOrdersPage} />} />
      <Route path="/work-orders/:id/edit" component={() => <ProtectedRoute component={WorkOrdersPage} />} />
      <Route path="/job-cards" component={() => <ProtectedRoute component={JobCardsPage} />} />
      <Route path="/partners" component={() => <ProtectedRoute component={PartnersPage} />} />
      <Route path="/partner-staff" component={() => <ProtectedRoute component={PartnerStaffPage} />} />
      <Route path="/payouts" component={() => <ProtectedRoute component={PayoutsPage} />} />
      <Route path="/allocations" component={() => <ProtectedRoute component={AllocationsPage} />} />
      <Route path="/pricing" component={() => <ProtectedRoute component={PricingPage} />} />
      <Route path="/commissions" component={() => <ProtectedRoute component={CommissionsPage} />} />
      <Route path="/payout-settlement" component={() => <ProtectedRoute component={PayoutSettlementPage} />} />
      <Route path="/oems" component={() => <ProtectedRoute component={OEMsPage} />} />
      <Route path="/dealerships" component={() => <ProtectedRoute component={DealershipsPage} />} />
      <Route path="/showrooms" component={() => <ProtectedRoute component={ShowroomsPage} />} />
      <Route path="/sales-persons" component={() => <ProtectedRoute component={SalesPersonsPage} />} />
      <Route path="/vehicles" component={() => <ProtectedRoute component={VehiclesPage} />} />
      <Route path="/services" component={() => <ProtectedRoute component={ServicesPage} />} />
      <Route path="/service-categories" component={() => <ProtectedRoute component={ServiceCategoriesPage} />} />
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
          <OemProvider>
            <Toaster />
            <Router />
          </OemProvider>
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
