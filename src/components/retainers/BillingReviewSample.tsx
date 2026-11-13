import { useEffect, useRef, useState } from "react";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { billingMoney } from "@/lib/retainer-billing";

const base = 125000;
const approvedExtra = 35000;
const pendingExtra = 18000;
const money = (amount: number) => billingMoney(amount, "GBP");

export default function BillingReviewSample({ interactive = false }: { interactive?: boolean }) {
  const [previewApproval, setPreviewApproval] = useState(false);
  const [approved, setApproved] = useState(false);
  const [nextMonth, setNextMonth] = useState(false);
  const approveButton = useRef<HTMLButtonElement>(null);
  const confirmation = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    if (previewApproval) approveButton.current?.focus();
    else if (approved) confirmation.current?.focus();
  }, [previewApproval, approved]);

  const monthlyFee = { name: "Monthly SEO retainer", amount: base, type: "Monthly fee", ready: true };
  const lines = nextMonth ? [monthlyFee] : [
    monthlyFee,
    { name: "Campaign landing page", amount: approvedExtra, type: "Approved extra", ready: true },
    { name: "Additional ad creative", amount: pendingExtra, type: approved ? "Approved extra" : "One-off extra", ready: approved },
  ];
  const total = lines.reduce((sum, line) => line.ready ? sum + line.amount : sum, 0);

  return (
    <section className="billing-sample" aria-labelledby="sample-review-title">
      <div className="billing-sample-header">
        <div>
          <h2 id="sample-review-title">Northline Studio</h2>
          <p>Monthly billing review · Sample data</p>
        </div>
        {interactive && (
          <div className="billing-sample-months" role="group" aria-label="Sample billing period">
            <Button size="sm" variant={nextMonth ? "outline" : "secondary"} aria-pressed={!nextMonth} onClick={() => setNextMonth(false)}>This month</Button>
            <Button size="sm" variant={nextMonth ? "secondary" : "outline"} aria-pressed={nextMonth} onClick={() => { setNextMonth(true); setPreviewApproval(false); }}>Next month</Button>
          </div>
        )}
      </div>
      <ul className="billing-sample-lines" aria-label={nextMonth ? "Next month’s billing lines" : "This month’s billing lines"}>
        {lines.map((line) => (
          <li key={line.name}>
            <div><strong>{line.name}</strong><small>{line.type} · {line.ready ? "Ready to invoice" : "Needs approval"}</small></div>
            <span>{money(line.amount)}</span>
          </li>
        ))}
      </ul>
      <div className="billing-sample-total" aria-live={interactive ? "polite" : undefined}>
        <span>{nextMonth ? "Next month ready to invoice" : "This month ready to invoice"}</span>
        <strong>{money(total)}</strong>
      </div>
      {interactive && !nextMonth && !approved && (
        previewApproval ? (
          <div className="billing-sample-approval">
            <h3>What your client sees</h3>
            <p>One additional set of paid social ads · {money(pendingExtra)} one-off</p>
            <Button ref={approveButton} className="concept-button-primary" onClick={() => { setApproved(true); setPreviewApproval(false); }}>Approve sample extra</Button>
          </div>
        ) : (
          <div className="billing-sample-approval">
            <Button className="concept-button-primary" onClick={() => setPreviewApproval(true)}>Preview client approval <ArrowRight aria-hidden="true" /></Button>
          </div>
        )
      )}
      {interactive && approved && !nextMonth && (
        <p ref={confirmation} tabIndex={-1} className="billing-sample-confirmation">The extra is ready to invoice this month. The recurring fee stays {money(base)}.</p>
      )}
    </section>
  );
}
