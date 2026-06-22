## Hide "Complete payment" button on signed contract page when proposal is already paid

**Problem:** On the public contract signing page (`/sign/:token`), after the contract is signed, a "Complete payment" button is shown whenever the contract is linked to a proposal — regardless of whether that proposal has already been paid.

**Fix:** In `src/pages/ContractSignPage.tsx`:

1. Add a `proposalPaid` state (boolean, default `false`).
2. In the existing load effect, when `data.proposal_id` is present, also fetch `client_paid` from the `proposals` table for that id and store it in `proposalPaid`.
3. In the post-signing success section (around line 368), change the conditional from `contract.proposal_id ? ...` to `contract.proposal_id && !proposalPaid ? ...` so the "Complete payment" button only renders when payment is still outstanding.

No changes to the client portal, proposal view, PDF export, or any other functionality. Pure presentation logic on the contract signing page.
