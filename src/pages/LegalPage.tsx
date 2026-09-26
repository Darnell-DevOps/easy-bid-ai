import { ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";
import PageMeta from "@/components/PageMeta";

const documents = {
  terms: {
    title: "Terms of Service",
    description: "The terms for using CloseSync AI.",
    sections: [
      ["operator", "Who operates CloseSync AI"],
      ["account", "Your account"],
      ["service", "Using the service"],
      ["subscriptions", "Plans and payments"],
      ["ending", "Ending your subscription"],
      ["contact", "Questions and contact details"],
    ],
  },
  privacy: {
    title: "Privacy Policy",
    description: "How personal information is handled when you use CloseSync AI.",
    sections: [
      ["controller", "Who is responsible for your information"],
      ["information", "Information collected"],
      ["use", "How information is used"],
      ["sharing", "Service providers and sharing"],
      ["retention", "Storage and retention"],
      ["contact", "Your choices and how to contact us"],
    ],
  },
} as const;

/** Visual draft only. Replace the placeholders with approved policy copy before publication. */
export default function LegalPage({ kind }: { kind: keyof typeof documents }) {
  const document = documents[kind];
  return (
    <div className="landing-shell cs-legal-shell">
      <PageMeta title={`${document.title} | CloseSync AI`} description={document.description} path={`/${kind}`} noIndex />
      <header className="cs-legal-header">
        <Link to="/" className="cs-legal-brand" aria-label="CloseSync AI home">
          <img src="/closesync-mark.png" alt="" width="32" height="32" />
          <span>Close<span>Sync</span> <small>AI</small></span>
        </Link>
        <Link to="/" className="cs-legal-back"><ArrowLeft aria-hidden="true" /> Back to home</Link>
      </header>
      <main id="legal-main" tabIndex={-1}>
        <div className="cs-legal-heading">
          <h1>{document.title}</h1>
          <p>{document.description}</p>
          <div className="cs-legal-draft">
            <strong>Design preview — policy wording pending</strong>
            <p>This page shows the proposed layout. It is not a published policy. Operator details and approved wording are still required.</p>
          </div>
        </div>
        <div className="cs-legal-body">
          <aside>
            <nav aria-label="On this page" className="cs-legal-contents">
              <h2>On this page</h2>
              <ul>
                {document.sections.map(([id, title]) => <li key={id}><a href={`#${kind}-${id}`}>{title}</a></li>)}
              </ul>
            </nav>
          </aside>
          <article className="cs-legal-copy" aria-label={document.title}>
            {document.sections.map(([id, title]) => (
              <section key={id} id={`${kind}-${id}`} aria-labelledby={`${kind}-${id}-title`}>
                <h2 id={`${kind}-${id}-title`}>{title}</h2>
                <p>Approved policy wording will appear here. This section is a layout placeholder.</p>
              </section>
            ))}
          </article>
        </div>
      </main>
      <footer className="cs-legal-footer">
        <p>CloseSync AI</p>
        <nav aria-label="Legal information">
          <Link to="/terms" aria-current={kind === "terms" ? "page" : undefined}>Terms of Service</Link>
          <Link to="/privacy" aria-current={kind === "privacy" ? "page" : undefined}>Privacy Policy</Link>
        </nav>
      </footer>
    </div>
  );
}
