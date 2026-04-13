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
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/sample" element={<SampleProposal />} />
          <Route path="/dashboard" element={<AuthGuard><Dashboard /></AuthGuard>} />
          <Route path="/dashboard/new" element={<AuthGuard><NewProposal /></AuthGuard>} />
          <Route path="/dashboard/proposal/:id" element={<AuthGuard><ProposalView /></AuthGuard>} />
          <Route path="/dashboard/billing" element={<AuthGuard><Billing /></AuthGuard>} />
          <Route path="/dashboard/settings" element={<AuthGuard><SettingsPage /></AuthGuard>} />
          <Route path="/dashboard/templates" element={<AuthGuard><Templates /></AuthGuard>} />
          <Route path="/dashboard/revenue" element={<AuthGuard><RevenueDashboard /></AuthGuard>} />
          <Route path="/dashboard/proposals" element={<AuthGuard><ProposalsDashboard /></AuthGuard>} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
