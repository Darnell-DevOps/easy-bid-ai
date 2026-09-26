import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { lazy, Suspense } from "react";
import { BrowserRouter, Route, Routes, useLocation } from "react-router-dom";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import AuthGuard from "@/components/AuthGuard";
import Index from "./pages/Index";
import LandingConcepts from "./pages/LandingConcepts";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import LegalPage from "./pages/LegalPage";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import SuperAdminGuard from "./components/admin/SuperAdminGuard";
import NotFound from "./pages/NotFound";
import OAuthConsent from "./pages/OAuthConsent";
import { PaymentTestModeBanner } from "@/components/PaymentTestModeBanner";
import { PageTransition } from "@/components/PageTransition";
import RouteAccessibility from "@/components/RouteAccessibility";

const Dashboard = lazy(() => import("./pages/Dashboard"));
const NewProposal = lazy(() => import("./pages/NewProposal"));
const ProposalView = lazy(() => import("./pages/ProposalView"));
const Billing = lazy(() => import("./pages/Billing"));
const SettingsPage = lazy(() => import("./pages/SettingsPage"));
const SampleProposal = lazy(() => import("./pages/SampleProposal"));
const Templates = lazy(() => import("./pages/Templates"));
const RevenueDashboard = lazy(() => import("./pages/RevenueDashboard"));
const ClientPortalLauncher = lazy(() => import("./pages/ClientPortalLauncher"));
const ProposalsDashboard = lazy(() => import("./pages/ProposalsDashboard"));
const Clients = lazy(() => import("./pages/Clients"));
const NewClient = lazy(() => import("./pages/NewClient"));
const ClientDetail = lazy(() => import("./pages/ClientDetail"));
const TimeSavedDashboard = lazy(() => import("./pages/TimeSavedDashboard"));
const LeadAssistant = lazy(() => import("./pages/LeadAssistant"));
const Policies = lazy(() => import("./pages/Policies"));
const NewPolicy = lazy(() => import("./pages/NewPolicy"));
const PolicyView = lazy(() => import("./pages/PolicyView"));
const ClientPortal = lazy(() => import("./pages/ClientPortal"));
const Onboarding = lazy(() => import("./pages/Onboarding"));
const CalendarPage = lazy(() => import("./pages/CalendarPage"));
const PublicBookingPage = lazy(() => import("./pages/PublicBookingPage"));
const ReschedulePage = lazy(() => import("./pages/ReschedulePage"));
const ContractsPage = lazy(() => import("./pages/ContractsPage"));
const ContractDetail = lazy(() => import("./pages/ContractDetail"));
const ContractSignPage = lazy(() => import("./pages/ContractSignPage"));
const OnboardingFormPage = lazy(() => import("./pages/OnboardingFormPage"));
const OnboardingDashboard = lazy(() => import("./pages/OnboardingDashboard"));
const OnboardingResponseDetail = lazy(() => import("./pages/OnboardingResponseDetail"));
const RetainersPage = lazy(() => import("./pages/RetainersPage"));
const NewRetainerPage = lazy(() => import("./pages/NewRetainerPage"));
const RetainerDetail = lazy(() => import("./pages/RetainerDetail"));
const RetainerSubscribePage = lazy(() => import("./pages/RetainerSubscribePage"));
const RetainerRecoverPage = lazy(() => import("./pages/RetainerRecoverPage"));
const RecoveryDashboard = lazy(() => import("./pages/RecoveryDashboard"));
const EmailsDashboard = lazy(() => import("./pages/EmailsDashboard"));
const AdminDashboard = lazy(() => import("./pages/AdminDashboard"));
const TestimonialsDashboard = lazy(() => import("./pages/TestimonialsDashboard"));
const TestimonialSubmitPage = lazy(() => import("./pages/TestimonialSubmitPage"));
const TestimonialWallPage = lazy(() => import("./pages/TestimonialWallPage"));
const LeadFormsDashboard = lazy(() => import("./pages/LeadFormsDashboard"));
const LeadFormEditor = lazy(() => import("./pages/LeadFormEditor"));
const PublicLeadFormPage = lazy(() => import("./pages/PublicLeadFormPage"));
const LeadInbox = lazy(() => import("./pages/LeadInbox"));
const Trash = lazy(() => import("./pages/Trash"));
const KickoffDashboard = lazy(() => import("./pages/KickoffDashboard"));
const queryClient = new QueryClient();

function RouteSkipLink() {
  const { pathname } = useLocation();
  const targetId = pathname === "/" || pathname.startsWith("/landing-concepts")
    ? "landing-main"
    : pathname === "/admin" || pathname.startsWith("/dashboard")
      ? "dashboard-main"
      : pathname === "/terms" || pathname === "/privacy"
        ? "legal-main"
        : null;
  if (!targetId) return null;

  return (
    <a href={`#${targetId}`} className="landing-skip-link">
      Skip to main content
    </a>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <BrowserRouter>
        <RouteAccessibility />
        <RouteSkipLink />
        <PaymentTestModeBanner />
        <PageTransition>
          <Suspense fallback={<div role="status" className="min-h-screen bg-background px-6 py-12 text-sm text-muted-foreground">Loading page…</div>}>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/landing-concepts" element={<LandingConcepts />} />
            <Route path="/landing-concepts/:concept" element={<LandingConcepts />} />
            <Route path="/.lovable/oauth/consent" element={<OAuthConsent />} />
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="/terms" element={<LegalPage kind="terms" />} />
            <Route path="/privacy" element={<LegalPage kind="privacy" />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/sample" element={<SampleProposal />} />
            <Route path="/proposal/view/:id" element={<ClientPortal />} />
            <Route path="/book/:slug" element={<PublicBookingPage />} />
            <Route path="/reschedule/:token" element={<ReschedulePage />} />
            <Route path="/sign/:token" element={<ContractSignPage />} />
            <Route path="/onboard/:token" element={<OnboardingFormPage />} />
            <Route path="/retainer/:token" element={<RetainerSubscribePage />} />
            <Route path="/r/recover/:token" element={<RetainerRecoverPage />} />
            <Route path="/testimonial/:token" element={<TestimonialSubmitPage />} />
            <Route path="/wall/:slug" element={<TestimonialWallPage />} />
            <Route path="/f/:slug" element={<PublicLeadFormPage />} />
            <Route path="/dashboard/recovery" element={<AuthGuard><RecoveryDashboard /></AuthGuard>} />
            <Route path="/onboarding" element={<AuthGuard><Onboarding /></AuthGuard>} />
            <Route path="/dashboard" element={<AuthGuard><Dashboard /></AuthGuard>} />
            <Route path="/dashboard/trash" element={<AuthGuard><Trash /></AuthGuard>} />
            <Route path="/dashboard/kickoff" element={<AuthGuard><KickoffDashboard /></AuthGuard>} />
            <Route path="/dashboard/onboarding" element={<AuthGuard><OnboardingDashboard /></AuthGuard>} />
            <Route path="/dashboard/onboarding/:id" element={<AuthGuard><OnboardingResponseDetail /></AuthGuard>} />
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
           <Route path="/dashboard/emails" element={<AuthGuard><EmailsDashboard /></AuthGuard>} />
            <Route path="/dashboard/revenue" element={<AuthGuard><RevenueDashboard /></AuthGuard>} />
            <Route path="/dashboard/client-portal" element={<AuthGuard><ClientPortalLauncher /></AuthGuard>} />
            <Route path="/dashboard/proposals" element={<AuthGuard><ProposalsDashboard /></AuthGuard>} />
            <Route path="/dashboard/clients" element={<AuthGuard><Clients /></AuthGuard>} />
            <Route path="/dashboard/clients/new" element={<AuthGuard><NewClient /></AuthGuard>} />
            <Route path="/dashboard/clients/:id" element={<AuthGuard><ClientDetail /></AuthGuard>} />
            <Route path="/dashboard/time-saved" element={<AuthGuard><TimeSavedDashboard /></AuthGuard>} />
            <Route path="/dashboard/leads" element={<AuthGuard><LeadAssistant /></AuthGuard>} />
            <Route path="/dashboard/policies" element={<AuthGuard><Policies /></AuthGuard>} />
            <Route path="/dashboard/policies/new" element={<AuthGuard><NewPolicy /></AuthGuard>} />
            <Route path="/dashboard/policies/:id" element={<AuthGuard><PolicyView /></AuthGuard>} />
            <Route path="/dashboard/testimonials" element={<AuthGuard><TestimonialsDashboard /></AuthGuard>} />
            <Route path="/dashboard/lead-forms" element={<AuthGuard><LeadFormsDashboard /></AuthGuard>} />
            <Route path="/dashboard/lead-forms/:id" element={<AuthGuard><LeadFormEditor /></AuthGuard>} />
            <Route path="/dashboard/lead-inbox" element={<AuthGuard><LeadInbox /></AuthGuard>} />
            <Route path="/admin" element={<AuthGuard><SuperAdminGuard><AdminDashboard /></SuperAdminGuard></AuthGuard>} />
            {/* Any other /dashboard/* path still requires a valid session */}
            <Route path="/dashboard/*" element={<AuthGuard><NotFound /></AuthGuard>} />
            <Route path="*" element={<NotFound />} />

          </Routes>
          </Suspense>
        </PageTransition>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
