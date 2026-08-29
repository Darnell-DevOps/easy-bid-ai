import { useEffect, useRef } from "react";
import { matchPath, useLocation } from "react-router-dom";

type RouteTitle = {
  path: string;
  title: string;
};

// Keep specific paths above dynamic siblings such as /dashboard/policies/:id.
const ROUTE_TITLES: RouteTitle[] = [
  { path: "/", title: "CloseSync - Client operations, in one place" },
  { path: "/landing-concepts", title: "Landing page concepts | CloseSync AI" },
  { path: "/landing-concepts/:concept", title: "Landing page concept | CloseSync AI" },
  { path: "/.lovable/oauth/consent", title: "Authorize access | CloseSync AI" },
  { path: "/login", title: "Sign in | CloseSync AI" },
  { path: "/signup", title: "Create your CloseSync AI account" },
  { path: "/forgot-password", title: "Reset your password | CloseSync AI" },
  { path: "/reset-password", title: "Set a new password | CloseSync AI" },
  { path: "/sample", title: "Sample AI Proposal | CloseSync AI" },
  { path: "/proposal/view/:id", title: "View proposal | CloseSync AI" },
  { path: "/book/:slug", title: "Book an appointment | CloseSync AI" },
  { path: "/reschedule/:token", title: "Reschedule appointment | CloseSync AI" },
  { path: "/sign/:token", title: "Sign contract | CloseSync AI" },
  { path: "/onboard/:token", title: "Client onboarding | CloseSync AI" },
  { path: "/retainer/:token", title: "Retainer subscription | CloseSync AI" },
  { path: "/r/recover/:token", title: "Recover payment | CloseSync AI" },
  { path: "/testimonial/:token", title: "Submit testimonial | CloseSync AI" },
  { path: "/wall/:slug", title: "Testimonials | CloseSync AI" },
  { path: "/f/:slug", title: "Contact form | CloseSync AI" },
  { path: "/onboarding", title: "Set up your account | CloseSync AI" },
  { path: "/dashboard", title: "Dashboard | CloseSync AI" },
  { path: "/dashboard/recovery", title: "Payment recovery | CloseSync AI" },
  { path: "/dashboard/trash", title: "Trash | CloseSync AI" },
  { path: "/dashboard/kickoff", title: "Client kickoff | CloseSync AI" },
  { path: "/dashboard/onboarding", title: "Client onboarding | CloseSync AI" },
  { path: "/dashboard/onboarding/:id", title: "Onboarding response | CloseSync AI" },
  { path: "/dashboard/calendar", title: "Calendar | CloseSync AI" },
  { path: "/dashboard/contracts", title: "Contracts | CloseSync AI" },
  { path: "/dashboard/contracts/:id", title: "Contract details | CloseSync AI" },
  { path: "/dashboard/retainers", title: "Retainers | CloseSync AI" },
  { path: "/dashboard/retainers/new", title: "New retainer | CloseSync AI" },
  { path: "/dashboard/retainers/:id", title: "Retainer details | CloseSync AI" },
  { path: "/dashboard/new", title: "New proposal | CloseSync AI" },
  { path: "/dashboard/proposal/:id", title: "Proposal details | CloseSync AI" },
  { path: "/dashboard/billing", title: "Billing | CloseSync AI" },
  { path: "/dashboard/settings", title: "Settings | CloseSync AI" },
  { path: "/dashboard/templates", title: "Templates | CloseSync AI" },
  { path: "/dashboard/emails", title: "Emails | CloseSync AI" },
  { path: "/dashboard/revenue", title: "Revenue | CloseSync AI" },
  { path: "/dashboard/client-portal", title: "Client portal | CloseSync AI" },
  { path: "/dashboard/proposals", title: "Proposals | CloseSync AI" },
  { path: "/dashboard/clients", title: "Clients | CloseSync AI" },
  { path: "/dashboard/clients/new", title: "New client | CloseSync AI" },
  { path: "/dashboard/clients/:id", title: "Client details | CloseSync AI" },
  { path: "/dashboard/time-saved", title: "Time saved | CloseSync AI" },
  { path: "/dashboard/leads", title: "Lead assistant | CloseSync AI" },
  { path: "/dashboard/policies", title: "Policies | CloseSync AI" },
  { path: "/dashboard/policies/new", title: "New policy | CloseSync AI" },
  { path: "/dashboard/policies/:id", title: "Policy details | CloseSync AI" },
  { path: "/dashboard/testimonials", title: "Testimonials | CloseSync AI" },
  { path: "/dashboard/lead-forms", title: "Lead forms | CloseSync AI" },
  { path: "/dashboard/lead-forms/:id", title: "Edit lead form | CloseSync AI" },
  { path: "/dashboard/lead-inbox", title: "Lead inbox | CloseSync AI" },
  { path: "/admin", title: "Administration | CloseSync AI" },
];

export function getRouteTitle(pathname: string): string {
  return ROUTE_TITLES.find(({ path }) => matchPath({ path, end: true }, pathname))?.title
    ?? "Page not found | CloseSync AI";
}

export function focusRouteContent(): boolean {
  const selectors = [
    "main h1",
    '[role="main"] h1',
    "h1",
    "[data-route-focus-target]",
    "main",
    '[role="main"]',
  ];
  const target = selectors
    .map((selector) => document.querySelector<HTMLElement>(selector))
    .find((element): element is HTMLElement => element !== null);
  if (!target) return false;

  if (!target.hasAttribute("tabindex")) {
    target.setAttribute("tabindex", "-1");
    target.dataset.routeFocusManaged = "true";
    target.addEventListener("blur", () => {
      if (target.dataset.routeFocusManaged === "true") {
        target.removeAttribute("tabindex");
        delete target.dataset.routeFocusManaged;
      }
    }, { once: true });
  }

  target.focus();
  return document.activeElement === target;
}

/** Updates SPA route titles and sends keyboard/screen-reader focus to new content. */
export default function RouteAccessibility() {
  const { pathname } = useLocation();
  const firstRender = useRef(true);

  useEffect(() => {
    document.title = getRouteTitle(pathname);

    if (firstRender.current) {
      firstRender.current = false;
      return;
    }

    let observer: MutationObserver | null = null;
    let stopped = false;

    const stopObserving = () => {
      observer?.disconnect();
      observer = null;
    };

    const focusWhenReady = () => {
      if (stopped || !focusRouteContent()) return false;
      stopObserving();
      return true;
    };

    const focusTimer = window.setTimeout(() => {
      if (focusWhenReady()) return;
      observer = new MutationObserver(focusWhenReady);
      observer.observe(document.getElementById("root") ?? document.body, {
        childList: true,
        subtree: true,
      });
    }, 0);
    const stopTimer = window.setTimeout(stopObserving, 2_000);

    return () => {
      stopped = true;
      window.clearTimeout(focusTimer);
      window.clearTimeout(stopTimer);
      stopObserving();
    };
  }, [pathname]);

  return null;
}
