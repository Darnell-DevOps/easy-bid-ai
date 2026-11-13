import { Link } from "react-router-dom";
import BillingReviewSample from "@/components/retainers/BillingReviewSample";
import PageMeta from "@/components/PageMeta";
import { Button } from "@/components/ui/button";
import { ConceptHeader } from "./LandingConcepts";

export default function SampleBillingReview() {
  return (
    <div className="landing-shell landing-concept concept-system">
      <PageMeta title="Sample billing review | CloseSync AI" description="Try a sample retainer, approve an extra and see what belongs on the next invoice." path="/sample-billing-review" />
      <ConceptHeader showNavigation={false} showPrimaryAction={false} />
      <main id="landing-main" tabIndex={-1} className="billing-sample-page">
        <h1 className="cs-text-h1">Sample billing review</h1>
        <p>Approve the sample extra, then switch to next month to see what carries over.</p>
        <BillingReviewSample interactive />
        <Button asChild size="lg" variant="outline" className="concept-button-secondary"><Link to="/signup">Start free</Link></Button>
      </main>
    </div>
  );
}
