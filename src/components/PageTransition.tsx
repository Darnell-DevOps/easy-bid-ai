import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";

/**
 * Wraps route content and replays a smooth fade-in on each pathname change.
 * A thin top progress bar briefly appears on navigation for a premium feel.
 */
export function PageTransition({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const [loading, setLoading] = useState(false);
  const firstRender = useRef(true);

  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    setLoading(true);
    const t = setTimeout(() => setLoading(false), 400);
    return () => clearTimeout(t);
  }, [location.pathname]);

  return (
    <>
      <div
        aria-hidden
        className={`fixed top-0 left-0 right-0 z-[100] h-0.5 overflow-hidden pointer-events-none transition-opacity duration-300 ${
          loading ? "opacity-100" : "opacity-0"
        }`}
      >
        <div className="h-full w-full bg-accent/80 origin-left animate-progress-indeterminate" />
      </div>

      <div key={location.pathname} className="animate-page-in">
        {children}
      </div>
    </>
  );
}
