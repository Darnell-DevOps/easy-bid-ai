import { useEffect, useRef, useState } from "react";
import AIAssistant from "./AIAssistant";
import RetainersSection from "./RetainersSection";

/**
 * Pinned horizontal-scroll container: as the user scrolls vertically,
 * the AI Assistant panel slides left and the Retainers panel slides in
 * from the right. Falls back to a normal stacked layout on small screens
 * or when the user prefers reduced motion.
 */
export default function AiRetainersScroller() {
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const [progress, setProgress] = useState(0);
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    const mqDesktop = window.matchMedia("(min-width: 768px)");
    const mqReduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setEnabled(mqDesktop.matches && !mqReduced.matches);
    update();
    mqDesktop.addEventListener("change", update);
    mqReduced.addEventListener("change", update);
    return () => {
      mqDesktop.removeEventListener("change", update);
      mqReduced.removeEventListener("change", update);
    };
  }, []);

  useEffect(() => {
    if (!enabled) return;
    const el = wrapperRef.current;
    if (!el) return;

    let raf = 0;
    const compute = () => {
      raf = 0;
      const rect = el.getBoundingClientRect();
      const vh = window.innerHeight;
      // Total scrollable distance = wrapper height - vh (since inner is sticky at h-screen)
      const total = el.offsetHeight - vh;
      // scrolled amount past the top of the wrapper
      const scrolled = Math.min(Math.max(-rect.top, 0), total);
      setProgress(total > 0 ? scrolled / total : 0);
    };

    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(compute);
    };

    compute();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [enabled]);

  if (!enabled) {
    return (
      <>
        <AIAssistant />
        <RetainersSection />
      </>
    );
  }

  // Ease the progress a touch for a smoother feel.
  const eased = progress < 0.5 ? 2 * progress * progress : 1 - Math.pow(-2 * progress + 2, 2) / 2;
  const translate = -eased * 100; // 0% → -100% of a 200vw track

  return (
    <div ref={wrapperRef} className="relative" style={{ height: "220vh" }}>
      <div className="sticky top-0 h-screen w-full overflow-hidden">
        <div
          className="flex h-full will-change-transform"
          style={{
            width: "200vw",
            transform: `translate3d(${translate}vw, 0, 0)`,
            transition: "transform 80ms linear",
          }}
        >
          <div className="w-screen h-full flex items-center overflow-y-auto">
            <div className="w-full">
              <AIAssistant embedded />
            </div>
          </div>
          <div className="w-screen h-full flex items-center overflow-y-auto">
            <div className="w-full">
              <RetainersSection embedded />
            </div>
          </div>
        </div>

        {/* Progress dots */}
        <div className="pointer-events-none absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-2 z-10">
          <span
            className="h-1.5 rounded-full bg-accent transition-all duration-300"
            style={{ width: progress < 0.5 ? 28 : 8, opacity: progress < 0.5 ? 1 : 0.4 }}
          />
          <span
            className="h-1.5 rounded-full bg-accent transition-all duration-300"
            style={{ width: progress >= 0.5 ? 28 : 8, opacity: progress >= 0.5 ? 1 : 0.4 }}
          />
        </div>
      </div>
    </div>
  );
}
