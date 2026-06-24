## Goal

After the client signs a contract, notify the owner to countersign. Once both have signed, render the contract as fully executed on both portals and let either side download the executed PDF.

## Flow

```text
Client signs ──► status = "signed"
            └─► owner gets in-app notification + email: "Countersign required"
                  │
                  ▼
Owner opens contract ──► "Countersign contract" CTA ──► types/draws signature
                                                  │
                                                  ▼
                                          status = "executed"
                                          countersigned_at = now()
                                  │                       │
                                  ▼                       ▼
                        Client gets email:        Both sides see both
                        "Contract executed"       signatures inline +
                        with link to portal       "Download Executed PDF"
```

## Data model (one migration)

- `contract_signatures.signer_role` text NOT NULL DEFAULT `'client'`, CHECK in (`'client'`,`'provider'`). Backfill existing rows as `'client'`. Add unique index `(contract_id, signer_role)` so each side signs once.
- `contracts.countersigned_at` timestamptz, `contracts.countersigner_name` text.
- Extend allowed `contracts.status` values to include `'executed'` (no CHECK constraint exists today — just used as a string).
- New RPC `contract_countersign(_contract_id uuid, _signer_name, _signer_email, _method, _signature_data, _ua)`:
  - Requires `auth.uid() = contracts.user_id`.
  - Rejects if contract status is not `'signed'` (client must sign first) or already executed.
  - Inserts a `contract_signatures` row with `signer_role='provider'`.
  - Updates contract: `status='executed'`, `countersigned_at=now()`, `countersigner_name=_signer_name`.
  - Inserts a `user_notifications` row (`category='contract'`, `key='contract_executed'`) for the owner's records.
- Update `contract_sign` RPC: tag new signature `signer_role='client'`; always insert a `user_notifications` row with `key='contract_awaiting_countersign'` (independent of the existing `contract_notify_signed` toggle, since countersigning is part of the core flow).

## Email notifications

Reuse `sendEmail()` and existing template machinery:

- `contract-awaiting-countersign` (to owner) — sent client-side from `ContractSignPage` right after a successful `contract_sign` call, using `contract.user_id` and the owner's email pulled via a small RPC `get_contract_owner_email(_token)` (security-definer, returns just the email so we don't expose `user_profiles` publicly).
- `contract-executed` (to client) — sent from `ContractDetail` right after `contract_countersign` succeeds, with a link back to `/sign/<token>` so the client sees the fully executed contract.

Both templates added to `src/lib/email-templates-defaults.ts` with merge tags `{title}`, `{client_name}`, `{from_name}`, `{url}`.

## UI changes

### `src/components/contracts/ContractRenderer.tsx`
- Accept an optional `providerSignature` prop alongside `clientSignature`.
- Detect the "Service Provider" label the same way "Client" is detected, and inline the provider signature image/typed name on its underscore placeholder line.

### `src/components/contracts/SignatureBlock.tsx`
- Group signatures into a "Client" column and a "Service Provider" column when `signer_role` is present.
- When both roles are present, show an "EXECUTED" pill at the top of the block with the execution date.

### `src/pages/ContractSignPage.tsx`
- Split `signatures` into `clientSignature` / `providerSignature` and pass both to `ContractRenderer`.
- Status badge: render `executed` (emerald) distinct from `signed` (purple — "Awaiting countersignature").
- When `status === 'executed'`, add a "Download Executed PDF" button next to the existing next-step CTAs, using the same `html2pdf` setup as `ContractDetail` (extracted to a tiny shared helper `src/lib/contract-pdf.ts`).
- Right after `contract_sign` succeeds, fire the `contract-awaiting-countersign` email (best-effort, non-blocking).

### `src/pages/ContractDetail.tsx`
- When `status === 'signed'` and no provider signature exists, show a prominent "Countersign contract" button that opens a new `CountersignDialog` (typed/drawn tabs, name prefilled from `user_profiles.full_name` / business branding).
- On submit, call `contract_countersign`, reload signatures, fire the `contract-executed` email to `contract.client_email`.
- Pass `providerSignature` to `ContractRenderer`; the PDF export surface naturally picks both signatures up.
- Add an "Executed" status badge style, and rename the download button to "Download Executed PDF" once executed.

### `src/pages/Dashboard.tsx` / `ContractsWidget.tsx`
- Surface "Awaiting your countersignature" count alongside the existing `pending` / `signed` counts, with a deep link straight into the first such contract.

## Out of scope

- No changes to payment gating, retainer flow, or proposal logic.
- PDF layout itself stays identical (same `pdf-export-surface` styles); the only difference is that both signatures are now present in the rendered body.

## Files touched

- New migration: schema + RPCs above.
- New: `src/lib/contract-pdf.ts`, `src/components/contracts/CountersignDialog.tsx`.
- Edit: `ContractRenderer.tsx`, `SignatureBlock.tsx`, `ContractSignPage.tsx`, `ContractDetail.tsx`, `ContractsWidget.tsx`, `lib/contracts.ts` (add `executed` label + signer_role type), `lib/email-templates-defaults.ts`.
