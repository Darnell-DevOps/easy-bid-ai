import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";

/**
 * Wraps route content and replays a subtle fade/slide animation on each
 * pathname change, plus a thin top progress bar for a premium feel.
 */
export function PageTransition({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const [displayKey, setDisplayKey] = useState(location.pathname);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (location.pathname === displayKey) return;
    setLoading(true);
    // Brief delay so the bar is perceptible even on instant navigations
    const t = setTimeout(() => {
      setDisplayKey(location.pathname);
      setLoading(false);
    }, 180);
    return () => clearTimeout(t);
  }, [location.pathname, displayKey]);

  return (
    <>
      {/* Top progress bar */}
      <div
        aria-hidden
        className={`fixed top-0 left-0 right-0 z-[100] h-0.5 overflow-hidden pointer-events-none transition-opacity duration-200 ${
          loading ? "opacity-100" : "opacity-0"
        }`}
      >
        <div className="h-full w-full bg-accent/80 origin-left animate-progress-indeterminate" />
      </div>

      <div key={displayKey} className="animate-page-in">
        {children}
      </div>
    </>
  );
}
