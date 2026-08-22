import { act, cleanup, fireEvent, render, renderHook, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import AIAssistant from "@/components/landing/AIAssistant";
import ClientPortalShowcase from "@/components/landing/ClientPortalShowcase";
import { useReducedMotion } from "@/hooks/use-reduced-motion";

vi.mock("@/hooks/use-scroll-animation", () => ({
  AnimateIn: ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
    <div className={className}>{children}</div>
  ),
}));

function mockReducedMotion(initial: boolean) {
  let matches = initial;
  const listeners = new Set<() => void>();

  vi.spyOn(window, "matchMedia").mockImplementation((query: string) => ({
    get matches() { return matches; },
    media: query,
    onchange: null,
    addListener: () => undefined,
    removeListener: () => undefined,
    addEventListener: (_type: string, listener: EventListenerOrEventListenerObject) => {
      if (typeof listener === "function") listeners.add(listener as () => void);
    },
    removeEventListener: (_type: string, listener: EventListenerOrEventListenerObject) => {
      if (typeof listener === "function") listeners.delete(listener as () => void);
    },
    dispatchEvent: () => true,
  }) as MediaQueryList);

  return {
    set(value: boolean) {
      matches = value;
      act(() => listeners.forEach((listener) => listener()));
    },
  };
}

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("motion accessibility", () => {
  it("tracks changes to the operating-system reduced-motion preference", () => {
    const preference = mockReducedMotion(true);
    const { result } = renderHook(() => useReducedMotion());

    expect(result.current).toBe(true);
    preference.set(false);
    expect(result.current).toBe(false);
  });

  it("starts the portal demo paused for reduced-motion users but permits explicit playback", () => {
    vi.useFakeTimers();
    mockReducedMotion(true);
    render(<ClientPortalShowcase />);

    const section = document.getElementById("portal");
    expect(section).toHaveClass("motion-paused");
    expect(screen.getByText("40%")).toBeInTheDocument();

    act(() => vi.advanceTimersByTime(6_600));
    expect(screen.getByText("40%")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Play client portal demo" }));
    expect(screen.getByRole("button", { name: "Pause client portal demo" })).toBeInTheDocument();
    expect(section).not.toHaveClass("motion-paused");

    act(() => vi.advanceTimersByTime(2_200));
    expect(screen.getByText("60%")).toBeInTheDocument();
  });

  it("lets users pause and resume the client portal rotation", () => {
    vi.useFakeTimers();
    mockReducedMotion(false);
    render(<ClientPortalShowcase />);

    fireEvent.click(screen.getByRole("button", { name: "Pause client portal demo" }));
    expect(screen.getByText("40%")).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(6_600));
    expect(screen.getByText("40%")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Play client portal demo" }));
    act(() => vi.advanceTimersByTime(2_200));
    expect(screen.getByText("60%")).toBeInTheDocument();
  });

  it("pauses the AI feed, typewriter, and descendant CSS animations", () => {
    vi.useFakeTimers();
    mockReducedMotion(false);
    render(<AIAssistant />);

    fireEvent.click(screen.getByRole("button", { name: "Pause automatic AI activity" }));
    const section = document.getElementById("ai");
    const feed = screen.getByLabelText("Example AI activity");
    const pausedContent = feed.textContent;

    expect(section).toHaveClass("motion-paused");
    act(() => vi.advanceTimersByTime(7_200));
    expect(feed.textContent).toBe(pausedContent);

    fireEvent.click(screen.getByRole("button", { name: "Play automatic AI activity" }));
    expect(section).not.toHaveClass("motion-paused");
    act(() => vi.advanceTimersByTime(2_400));
    expect(feed.textContent).not.toBe(pausedContent);
  });
});
