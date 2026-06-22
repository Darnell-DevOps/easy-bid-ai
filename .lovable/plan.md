## Goal
On `/contract/sign/:token`:
1. Drawn signatures should track the cursor/finger exactly.
2. After signing, the signature should be visible inside the contract (not just stored silently).

## Problem analysis

**1. Cursor misalignment when drawing**
The canvas is sized once in a `useEffect` that runs only when the user switches to the "Draw signature" tab. It captures `getBoundingClientRect()` at that moment and bakes `width = rect.width * dpr` into the canvas backing store, then scales the 2D context by `dpr`. After that, the backing store never re-syncs with the displayed size. So as soon as the layout shifts after init — the sticky header changes height on scroll, the page reflows when the agreement checkbox / name field grows, the viewport resizes, fonts finish loading, or the user rotates a phone — the CSS width of the canvas no longer matches its internal width. Mouse positions are computed in CSS pixels from a fresh `getBoundingClientRect()`, but the strokes land in the stale internal coordinate space, so the line draws offset from the pointer.

**2. Signature doesn't show on the signed contract**
The `contract_sign` RPC correctly inserts into `contract_signatures` (verified — recent rows exist with full `signature_data`). But `ContractSignPage` never reads that table back. After signing it flips to a generic "Contract signed successfully" success card and the contract body above it stays exactly as it was — no signature line, no signer name, no drawn image. From the signer's perspective the contract "is still empty" because nothing in the document changed.

`ContractDetail` (owner view) already renders a separate Signatures card, so the data is reachable; the gap is on the public sign page and inside the rendered document itself.

## Changes

### `src/pages/ContractSignPage.tsx`

**Canvas alignment**
- Replace the one-shot `useEffect([method])` sizer with a `resizeCanvas()` helper that:
  - reads `getBoundingClientRect()`,
  - saves the current strokes via `toDataURL()` before resizing (so a mid-session reflow doesn't wipe the signature),
  - sets `canvas.width/height = rect.width/height * dpr`,
  - resets transform then `ctx.scale(dpr, dpr)` and re-applies stroke style,
  - redraws the saved image back at CSS dimensions.
- Call `resizeCanvas()` on tab switch to "drawn", on `window` resize, via a `ResizeObserver` on the canvas, and once more at the start of `startDraw` as a cheap safety net so the very next stroke is always aligned.
- Keep `getPos` as-is (it already uses fresh `getBoundingClientRect()` in CSS pixels, which is correct once the backing store matches).

**Show the signature after signing**
- After a successful `contract_sign` RPC, fetch the newly-inserted row from `contract_signatures` for this `contract_id` (most recent) and store it in local state as `signedSignature`.
- In the "signed" success section, render a signature block above the next-step buttons:
  - signer name, email, timestamp;
  - for `method === "drawn"`: `<img src={signature_data}>` on a white card;
  - for `method === "typed"`: the name in the Caveat cursive style already used in the live preview.
- Also append a "Signed by" block at the bottom of the contract body section (still using `ContractRenderer` for the markdown, but render the signature card immediately under it inside the same bordered section) so the document itself visibly carries the signature, matching what the user expects from "the contract where it shows signatures."

### `src/pages/ContractDetail.tsx`
- No behavioral change needed (Signatures card already works), but mirror the same "signed by" block at the foot of the rendered contract body so the owner-facing document view is consistent with the public sign view.

## Out of scope
- No DB / RPC / RLS changes — `contract_sign` and `contract_signatures` already do the right thing.
- No changes to typed-signature flow beyond rendering it in the new "signed by" block.
- No changes to ContractRenderer's markdown parser.

## Verification
- Manually draw on the canvas at the top, middle, and bottom of the page after scrolling and after resizing the window — strokes should land under the cursor in every case.
- Sign a test contract with both typed and drawn methods; confirm the signature appears inside the contract section on the success screen and on `/contracts/:id` for the owner.
