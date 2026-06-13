## Goal
Give one-click access to any client's portal (`/proposal/view/:id`) from the sidebar — no more drilling into a proposal first.

## Changes

### 1. New sidebar section: "Client Portal"
In `src/components/DashboardLayout.tsx`, add a new `NavGroup` (placed under "Sales") with one item for now:

- **Open Client Portal** → `/dashboard/client-portal` (icon: `ExternalLink` or `Eye`)

Designed as a dedicated section so we can grow it later (portal settings, branding, activity, etc.).

### 2. New launcher page: `src/pages/ClientPortalLauncher.tsx`
A premium-dark page that lets the user pick a proposal and jump straight to its client portal in a new tab.

Layout:
- Page header: "Client Portal" + short subtitle "Preview the experience your clients see."
- Search input (filter by client name / proposal title)
- List/table of recent proposals — columns: Client, Proposal title, Status badge, Updated date, action: **Open portal** button (opens `/proposal/view/{id}` in a new tab via `window.open(..., "_blank", "noopener,noreferrer")`)
- Empty state when no proposals: CTA to "Create Proposal" (`/dashboard/new`)

Data:
- `supabase.from("proposals").select("id, title, client_name, status, updated_at").eq("user_id", user.id).order("updated_at", { ascending: false }).limit(50)`
- Client-side filter on the search query

Reuses existing UI primitives (`Card`, `Input`, `Button`, `Badge`) and dashboard layout — no visual redesign.

### 3. Route registration
In `src/App.tsx`, add:
```tsx
<Route path="/dashboard/client-portal" element={<AuthGuard><ClientPortalLauncher /></AuthGuard>} />
```
and the import.

## Out of scope
- No changes to the actual client portal view (`ClientPortal.tsx`).
- No proposal/list page changes — only the new launcher and sidebar entry.
- No business logic changes.
