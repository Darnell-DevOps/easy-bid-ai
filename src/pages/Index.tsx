import PageMeta from "@/components/PageMeta";
import { track } from "@/lib/landing-analytics";
import { consumeOAuthRedirect } from "@/lib/oauth-return";
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { WorkflowSystemLanding } from "./LandingConcepts";

export default function Index() {
  const navigate = useNavigate();

  useEffect(() => {
    track("landing_view");
  }, []);

  useEffect(() => {
    return consumeOAuthRedirect((path) => navigate(path, { replace: true }));
  }, [navigate]);

  return (
    <>
      <PageMeta
        title="CloseSync - Client operations, in one place"
        description="Manage proposals, contracts, payments, onboarding and ongoing client work in one clear workspace."
        path="/"
      />
      <WorkflowSystemLanding
        onStartFree={(location) => track("cta_click", { location })}
      />
    </>
  );
}
