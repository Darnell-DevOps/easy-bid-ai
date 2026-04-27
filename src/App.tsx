import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import AuthGuard from "@/components/AuthGuard";
import Index from "./pages/Index";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import Dashboard from "./pages/Dashboard";
import NewProposal from "./pages/NewProposal";
import ProposalView from "./pages/ProposalView";
import Billing from "./pages/Billing";
import SettingsPage from "./pages/SettingsPage";
import SampleProposal from "./pages/SampleProposal";
import Templates from "./pages/Templates";
import RevenueDashboard from "./pages/RevenueDashboard";
import ProposalsDashboard from "./pages/ProposalsDashboard";
import Clients from "./pages/Clients";
import NewClient from "./pages/NewClient";
import ClientDetail from "./pages/ClientDetail";
import TimeSavedDashboard from "./pages/TimeSavedDashboard";
import LeadAssistant from "./pages/LeadAssistant";
import Policies from "./pages/Policies";
import NewPolicy from "./pages/NewPolicy";
import PolicyView from "./pages/PolicyView";
import ClientPortal from "./pages/ClientPortal";
import Onboarding from "./pages/Onboarding";
import CalendarPage from "./pages/CalendarPage";
import PublicBookingPage from "./pages/PublicBookingPage";
import ContractsPage from "./pages/ContractsPage";
import ContractDetail from "./pages/ContractDetail";
import ContractSignPage from "./pages/ContractSignPage";
import OnboardingFormPage from "./pages/OnboardingFormPage";
import OnboardingDashboard from "./pages/OnboardingDashboard";
import RetainersPage from "./pages/RetainersPage";
import NewRetainerPage from "./pages/NewRetainerPage";
import RetainerDetail from "./pages/RetainerDetail";
import NotFound from "./pages/NotFound";
import { PaymentTestModeBanner } from "@/components/PaymentTestModeBanner";
import { PageTransition } from "@/components/PageTransition";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <PaymentTestModeBanner />
        <PageTransition>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="/sample" element={<SampleProposal />} />
            <Route path="/proposal/view/:id" element={<ClientPortal />} />
            <Route path="/book/:slug" element={<PublicBookingPage />} />
            <Route path="/sign/:token" element={<ContractSignPage />} />
            <Route path="/onboard/:token" element={<OnboardingFormPage />} />
            <Route path="/onboarding" element={<AuthGuard><Onboarding /></AuthGuard>} />
            <Route path="/dashboard" element={<AuthGuard><Dashboard /></AuthGuard>} />
            <Route path="/dashboard/onboarding" element={<AuthGuard><OnboardingDashboard /></AuthGuard>} />
            <Route path="/dashboard/calendar" element={<AuthGuard><CalendarPage /></AuthGuard>} />
            <Route path="/dashboard/contracts" element={<AuthGuard><ContractsPage /></AuthGuard>} />
            <Route path="/dashboard/contracts/:id" element={<AuthGuard><ContractDetail /></AuthGuard>} />
            <Route path="/dashboard/retainers" element={<AuthGuard><RetainersPage /></AuthGuard>} />
            <Route path="/dashboard/retainers/new" element={<AuthGuard><NewRetainerPage /></AuthGuard>} />
            <Route path="/dashboard/retainers/:id" element={<AuthGuard><RetainerDetail /></AuthGuard>} />
            <Route path="/dashboard/new" element={<AuthGuard><NewProposal /></AuthGuard>} />
            <Route path="/dashboard/proposal/:id" element={<AuthGuard><ProposalView /></AuthGuard>} />
            <Route path="/dashboard/billing" element={<AuthGuard><Billing /></AuthGuard>} />
            <Route path="/dashboard/settings" element={<AuthGuard><SettingsPage /></AuthGuard>} />
            <Route path="/dashboard/templates" element={<AuthGuard><Templates /></AuthGuard>} />
            <Route path="/dashboard/revenue" element={<AuthGuard><RevenueDashboard /></AuthGuard>} />
            <Route path="/dashboard/proposals" element={<AuthGuard><ProposalsDashboard /></AuthGuard>} />
            <Route path="/dashboard/clients" element={<AuthGuard><Clients /></AuthGuard>} />
            <Route path="/dashboard/clients/new" element={<AuthGuard><NewClient /></AuthGuard>} />
            <Route path="/dashboard/clients/:id" element={<AuthGuard><ClientDetail /></AuthGuard>} />
            <Route path="/dashboard/time-saved" element={<AuthGuard><TimeSavedDashboard /></AuthGuard>} />
            <Route path="/dashboard/leads" element={<AuthGuard><LeadAssistant /></AuthGuard>} />
            <Route path="/dashboard/policies" element={<AuthGuard><Policies /></AuthGuard>} />
            <Route path="/dashboard/policies/new" element={<AuthGuard><NewPolicy /></AuthGuard>} />
            <Route path="/dashboard/policies/:id" element={<AuthGuard><PolicyView /></AuthGuard>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </PageTransition>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
