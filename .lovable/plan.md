Remove the "Ready to get started" CTA block from the proposal renderer.

In `src/components/proposal/PremiumProposalRenderer.tsx`, delete the `if (sectionType === "cta") { ... }` branch (lines ~180–222) so CTA-typed sections render nothing in the proposal output. No other functionality (pricing, acceptance buttons, PDF export) is affected.