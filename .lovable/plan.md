# Side-by-side horizontal scroll: AI Assistant → Retainers

Combine the two landing sections — **"AI that helps you close clients faster"** (`AIAssistant.tsx`) and **"Turn one-time projects into recurring revenue"** (`RetainersSection.tsx`) — into a single pinned horizontal-scroll experience.

## Behavior
- As the user scrolls down the page, the section pins to the viewport.
- Two panels sit side-by-side on a 200vw-wide track. Panel 1 (AI Assistant) starts centered.
- Continued vertical scroll translates the track leftward, sliding Panel 1 out to the left while Panel 2 (Retainers) slides in from the right.
- Once fully scrolled, the pin releases and normal vertical scrolling resumes into the next section (Client Portal).

## Implementation

**New file:** `src/components/landing/AiRetainersScroller.tsx`
- Outer wrapper with `height: 200vh` (drives the scroll distance).
- Inner sticky container: `sticky top-0 h-screen overflow-hidden`.
- Track: `flex w-[200vw] h-full` containing two `w-screen` panels.
- Track `translateX` bound to scroll progress via `useScroll` + `useTransform` from `framer-motion` (already installed) — maps 0→1 progress to `0% → -50%`.
- Each panel wraps the existing `<AIAssistant />` and `<RetainersSection />` unchanged, but with their outer `<section>` height constraints normalized to fit `h-screen` (padding tightened, `min-h-screen` → `h-full`).
- Add a subtle progress indicator (2 dots) bottom-center to hint at the horizontal motion.
- Mobile (`<md`): fall back to stacked vertical layout — pinning + horizontal scroll disabled via a `matchMedia` check, panels render normally one above the other.
- Respect `prefers-reduced-motion`: same fallback as mobile.

**Edit:** `src/pages/Index.tsx`
- Replace the two adjacent renders (`<AIAssistant />` around line 488 and `<RetainersSection />` at line 492) with a single `<AiRetainersScroller />`.
- Remove the outer `<section>` wrappers inside AIAssistant/Retainers only if needed to avoid double padding (will adjust in-place with a `variant="embedded"` prop rather than editing the source components heavily).

**Minor edits:** `AIAssistant.tsx` and `RetainersSection.tsx`
- Accept an optional `embedded?: boolean` prop. When true: remove `min-h-screen`/large vertical padding so content fits within a single viewport panel. Visual design untouched.

## Technical notes
- Uses existing `framer-motion` package — no new deps.
- Pin technique: `sticky top-0` inside a taller parent is the standard scroll-jack pattern and works without ScrollTrigger/GSAP.
- Total added vertical scroll length: ~100vh extra (parent is 200vh, one screen for the transition).
- No changes to business logic, copy, or the two sections' internal designs.

## Out of scope
- No visual redesign of either section.
- No changes to other landing sections.
