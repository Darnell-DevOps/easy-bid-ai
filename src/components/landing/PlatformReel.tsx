import { useEffect, useRef, useState } from "react";
import { LucideIcon } from "lucide-react";

type Item = { icon: LucideIcon; title: string; desc: string };

const DWELL = 3200;

export default function PlatformReel({ items }: { items: Item[] }) {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const [reduced, setReduced] = useState(false);
  const tickRef = useRef<number | null>(null);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    if (paused || reduced) return;
    tickRef.current = window.setTimeout(
      () => setActive((a) => (a + 1) % items.length),
      DWELL
    );
    return () => {
      if (tickRef.current) window.clearTimeout(tickRef.current);
    };
  }, [active, paused, reduced, items.length]);

  const current = items[active];
  const Icon = current.icon;

  return (
    <div
      className="relative rounded-xl border border-border/60 bg-card/40 overflow-hidden"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <div className="grid md:grid-cols-[minmax(0,260px)_1fr] min-h-[280px]">
        {/* Chip list */}
        <ul
          role="tablist"
          aria-label="Platform workflows"
          className="flex md:flex-col gap-1 p-3 md:p-4 md:border-r border-border/60 overflow-x-auto md:overflow-visible md:max-h-[380px] md:overflow-y-auto scrollbar-none"
        >
          {items.map((it, i) => {
            const isActive = i === active;
            return (
              <li key={it.title} className="shrink-0">
                <button
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => setActive(i)}
                  onKeyDown={(e) => {
                    if (e.key === "ArrowDown" || e.key === "ArrowRight") {
                      e.preventDefault();
                      setActive((a) => (a + 1) % items.length);
                    } else if (e.key === "ArrowUp" || e.key === "ArrowLeft") {
                      e.preventDefault();
                      setActive((a) => (a - 1 + items.length) % items.length);
                    }
                  }}
                  className={`group w-full flex items-center gap-2.5 whitespace-nowrap md:whitespace-normal text-left px-3 py-2 rounded-md text-xs font-medium transition-all duration-200 border-l-2 ${
                    isActive
                      ? "bg-accent/10 text-foreground border-accent"
                      : "text-muted-foreground border-transparent hover:text-foreground hover:bg-accent/[0.04]"
                  }`}
                >
                  <span
                    className={`font-mono text-[10px] tracking-widest ${
                      isActive ? "text-accent" : "text-muted-foreground/60"
                    }`}
                  >
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span>{it.title}</span>
                </button>
              </li>
            );
          })}
        </ul>

        {/* Detail pane */}
        <div className="relative p-6 md:p-10 flex flex-col justify-center">
          <div key={active} className="animate-fade-in">
            <div className="flex items-center justify-between mb-6">
              <div className="w-14 h-14 rounded-xl bg-secondary border border-border flex items-center justify-center text-accent">
                <Icon className="w-7 h-7" />
              </div>
              <span className="font-mono text-[10px] text-muted-foreground/60 tracking-widest">
                {String(active + 1).padStart(2, "0")} / {String(items.length).padStart(2, "0")}
              </span>
            </div>
            <h3 className="text-2xl md:text-3xl font-bold text-foreground tracking-tight mb-3">
              {current.title}
            </h3>
            <p className="text-sm md:text-base text-muted-foreground leading-relaxed max-w-md">
              {current.desc}
            </p>
          </div>
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-0.5 w-full bg-border/40">
        <div
          key={`${active}-${paused || reduced ? "still" : "run"}`}
          className="h-full bg-accent"
          style={{
            width: paused || reduced ? "100%" : "0%",
            animation:
              paused || reduced
                ? "none"
                : `platform-reel-progress ${DWELL}ms linear forwards`,
          }}
        />
      </div>

      <style>{`
        @keyframes platform-reel-progress {
          from { width: 0%; }
          to { width: 100%; }
        }
      `}</style>
    </div>
  );
}
