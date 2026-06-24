## Goal

Make every contract (and related record) tied to a client, and turn the Client detail page into a single source of truth that shows all activity for that client — proposals, contracts, retainers, onboarding forms and bookings.

## 1. Link contracts to clients on creation

Today the "New Contract" dialog on `/dashboard/contracts` collects a free‑text client name/email but never sets `contracts.client_id` (the column already exists). We'll fix that:

- Add a **Client picker** to the New Contract dialog (`src/pages/ContractsPage.tsx`):
  - Loads `clients` for the signed-in user.
  - Selecting a client auto-fills name, email, company.
  - "Auto-fill from proposal" continues to work and, if the proposal has a `client_id`, it pre-selects that client.
  - Falls back to a "No linked client" option for ad‑hoc contracts.
- On insert, write `client_id` alongside the existing fields.
- Backfill: a one-off migration matches existing `contracts` rows to `clients` by `(user_id, lower(client_email))` first, then `(user_id, lower(client_name))` when email is empty, and sets `client_id` where a unique match exists.
- Same picker pattern added to the **New Retainer** flow if it isn't already linked, so retainers also carry `client_id`.

## 2. Pre-fill contract creation from a client

Add a **"New Contract"** button on the Client detail hero/actions area that opens `/dashboard/contracts` with the dialog pre-opened and the client pre-selected (via `location.state`, mirroring the existing template flow).

## 3. Client detail: full activity view

Extend `src/pages/ClientDetail.tsx` to fetch and display everything related to the client. All queries scope by `client_id = client.id`.

New sections, added under the existing Proposals card in this order:

1. **Contracts** — list with title, type, status pill (Draft / Sent / Viewed / Awaiting countersignature / Executed), amount, signed/executed dates. Row click → `/dashboard/contracts/:id`. Header has a **New contract** button.
2. **Retainers** — list with title, billing cycle, MRR, status (Active / Paused / Cancelled), next invoice date. Row click → `/dashboard/retainers/:id`. Header has **New retainer**.
3. **Onboarding forms** — list with template title, status (Sent / In progress / Submitted), submitted date, link to the form.
4. **Bookings** — upcoming + past bookings for this client (name/email match on `bookings`), with date, link type, status.

Each section uses the existing `Card` pattern and shows an inline empty state when there's nothing yet.

### Updated stats strip

The 3-stat strip becomes 4 stats: Proposals, Contracts (executed / total), Retainer MRR, Revenue collected. Mobile keeps a 2×2 grid.

## 4. Data fetching

`ClientDetail` does a single parallel fetch on mount:

```ts
const [c, p, ct, r, of, bk] = await Promise.all([
  supabase.from("clients").select("*").eq("id", id).single(),
  supabase.from("proposals").select(...).eq("client_id", id),
  supabase.from("contracts").select(...).eq("client_id", id),
  supabase.from("retainers").select(...).eq("client_id", id),
  supabase.from("onboarding_forms").select(...).eq("client_id", id),
  supabase.from("bookings").select(...).eq("client_id", id),
]);
```

RLS already restricts each of these tables to the owning `user_id`, so no policy changes are required — only the backfill migration above.

## 5. Files touched

- `supabase/migrations/<new>.sql` — backfill `contracts.client_id` (and `retainers.client_id` if needed) by email/name match.
- `src/pages/ContractsPage.tsx` — client picker in the dialog, write `client_id`, support pre-open from navigation state.
- `src/pages/ClientDetail.tsx` — new fetches, new sections, new stats, "New contract" / "New retainer" buttons.
- Small shared helpers reused from `src/lib/contracts.ts`, `src/lib/retainers.ts`, `src/lib/onboarding.ts`, `src/lib/bookings.ts` for status labels/formatting.

No schema changes beyond the backfill; no edits to auto-generated Supabase files.
