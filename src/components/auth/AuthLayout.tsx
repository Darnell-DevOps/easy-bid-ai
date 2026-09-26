import type { ReactNode } from "react";
import { ArrowLeft, Check, FileCheck2 } from "lucide-react";
import { Link } from "react-router-dom";

type AuthLayoutProps = {
  title: string;
  description: string;
  children: ReactNode;
  showPreview?: boolean;
  appearance?: "app" | "landing";
};

/** Shared presentation only; each page continues to own its authentication flow. */
export default function AuthLayout({ title, description, children, showPreview = true, appearance = "app" }: AuthLayoutProps) {
  return (
    <div className="cs-auth-shell" data-appearance={appearance}>
      <header className="cs-auth-header">
        <Link to="/" aria-label="CloseSync AI home" className="cs-auth-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
          <img src="/closesync-mark.png" alt="" width="32" height="32" />
          <span>Close<span className="cs-auth-brand-accent">Sync</span><small>AI</small></span>
        </Link>
        <Link to="/" className="cs-auth-home focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
          <ArrowLeft aria-hidden="true" /> Back to home
        </Link>
      </header>
      <div className={`cs-auth-body${showPreview ? "" : " cs-auth-body-centered"}`}>
        <main className="cs-auth-main">
          <div className="cs-auth-form">
            <div className="cs-auth-heading">
              <h1>{title}</h1>
              <p>{description}</p>
            </div>
            {children}
          </div>
        </main>
        {showPreview && (
          <aside className="cs-auth-preview" aria-labelledby="auth-preview-title">
            <div className="cs-auth-preview-copy">
              <h2 id="auth-preview-title">Every step, connected.</h2>
              <p>From first enquiry to ongoing work, every client step stays connected.</p>
            </div>
            <div className="cs-auth-record">
              <div className="cs-auth-record-heading">
                <strong>BrightStone website redesign</strong>
                <span>Illustrative product data</span>
              </div>
              <ol aria-label="Example client workflow">
                <li>
                  <Check aria-hidden="true" />
                  <span><strong>Enquiry</strong><small>Qualified lead</small></span>
                  <small>Complete</small>
                </li>
                <li aria-current="step">
                  <FileCheck2 aria-hidden="true" />
                  <span><strong>Proposal sent</strong><small>Awaiting decision</small></span>
                  <strong>£2,500</strong>
                </li>
                <li>
                  <span className="cs-auth-step" aria-hidden="true" />
                  <span><strong>Contract</strong><small>Agreement next</small></span>
                  <small>Upcoming</small>
                </li>
                <li>
                  <span className="cs-auth-step" aria-hidden="true" />
                  <span><strong>Payment</strong><small>Deposit follows</small></span>
                  <small>Upcoming</small>
                </li>
              </ol>
            </div>
            <p className="cs-auth-preview-note">Completed stages remain attached to the client record.</p>
          </aside>
        )}
      </div>
      <footer className="cs-auth-footer">
        <p>CloseSync AI</p>
        <nav aria-label="Legal information">
          <Link to="/terms" className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">Terms of Service</Link>
          <Link to="/privacy" className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">Privacy Policy</Link>
        </nav>
      </footer>
    </div>
  );
}
