## Make the drawn signature visible on the dark contract

The drawn signature is captured in black ink on a white canvas, so when it renders on the dark contract background it nearly disappears. Fix: invert the rendered signature image so the strokes appear white (or light) on the dark contract.

### Changes

**`src/components/contracts/ContractRenderer.tsx`** — inline client signature
- Apply a CSS filter to the `<img>` for drawn signatures so black ink becomes white: `filter: invert(1) brightness(2) contrast(1.1)`. The original PNG (with white background + black strokes) becomes transparent-feeling white strokes on the dark contract surface.
- Typed signatures already use `text-foreground`, which is light on dark — no change needed there.

**`src/components/contracts/SignatureBlock.tsx`** — bottom "Signed by" receipt cards
- These cards have a white background (`bg-white`) so the black signature is already visible there. No change.

### Out of scope
- PDF export rendering (user previously asked we don't affect exports).
- Capture color on the signing canvas stays black so the white-card "Signed by" receipt and PDF still look correct.
