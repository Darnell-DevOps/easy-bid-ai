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
        title="CloseSync AI | Retainer billing review for agencies"
        description="Track retainer scope, get extra work approved, and see what belongs on your next invoice."
        path="/"
      />
      <WorkflowSystemLanding
        retainerFocus
        onStartFree={(location) => track("cta_click", { location })}
      />
    </>
  );
}
