
## Goal

Let each user (1) upload their own favicon that appears on all public-facing client pages, and (2) connect their own custom domain (e.g. `portal.acme.com`) via CNAME so client-facing share links use their domain instead of `closesync.io`. Internal dashboard stays on `closesync.io`.

## Scope

**Favicon** appears on:
- Client portal
- Public lead forms
- Proposal & contract sign pages
- Onboarding & booking pages

**Custom domain** rewrites only **public share links** (portal / form / proposal / contract / onboarding / booking URLs). Dashboard, emails-to-self, and internal links stay on `closesync.io`.

---

## 1. Favicon — per-user upload

**Storage**
- Add `favicon_url` and `favicon_path` columns to existing `business_branding` table.
- Create a public Supabase Storage bucket `user-favicons` (read-anon, write-authenticated-own-folder).

**Upload UI**
- Add a "Browser tab icon (favicon)" section to `BrandingSettings.tsx` — drag/drop, PNG/ICO/SVG, max 256KB, recommended 256×256. Live preview chip.
- Persist URL into `business_branding.favicon_url`.

**Runtime injection**
- Create `src/components/branding/DynamicFavicon.tsx` — fetches the page-owner's branding by `user_id` (resolved from the route's slug/token/proposal/etc.) and injects `<link rel="icon">` via `react-helmet-async` (already viable; install if not present).
- Mount it on: `ClientPortal.tsx`, `PublicLeadFormPage.tsx`, `ProposalView.tsx`, `ContractSignPage.tsx`, `OnboardingFormPage.tsx`, `PublicBookingPage.tsx`, `RetainerSubscribePage.tsx`, `RetainerRecoverPage.tsx`, `TestimonialSubmitPage.tsx`.
- Falls back to the existing `/favicon.png` when none set.

---

## 2. Custom domain — CNAME with managed SSL

**Data model**
- New table `user_custom_domains`:
  - `user_id`, `hostname` (unique), `purpose` enum (`portal` | `forms` | `proposals` | `contracts` | `onboarding` | `booking` | `all`), `status` (`pending` | `verifying` | `active` | `failed`), `verification_token`, `ssl_status`, `last_checked_at`, `verified_at`.
- GRANTs + RLS scoped to `auth.uid()`; `service_role` full access for the verification cron.

**Verification flow (BYO domain)**
- User adds hostname in **Settings → Domains for client pages**.
- We display two DNS records to add at their registrar:
  - `CNAME <subdomain> → portal.closesync.io`
  - `TXT _closesync-verify.<subdomain> → <verification_token>`
- New edge function `custom-domain-manage` (actions: `add`, `verify`, `remove`, `list`, `set_purpose`) does DNS lookups via Cloudflare DoH (`https://cloudflare-dns.com/dns-query`).
- Once both records resolve correctly → status `active`.

**SSL / hostname routing**
- Since Lovable hosting can't natively provision certs for arbitrary customer hostnames, we use **Cloudflare for SaaS** (Custom Hostnames API):
  - Add `CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ZONE_ID` secrets (requested via `add_secret`).
  - On verify, `custom-domain-manage` calls Cloudflare to register the custom hostname → CF auto-issues a cert and proxies to our origin.
  - Origin (`portal.closesync.io`) is a CNAME alias of our Lovable app; the React app reads `window.location.hostname`, resolves it back to a `user_id` via a public RPC `resolve_custom_domain(hostname)`, and renders the right tenant.

**Link rewriting (public share links only)**
- New helper `src/lib/public-urls.ts` → `buildShareUrl(userId, surface, path)`:
  - Looks up the user's active custom domain matching the surface (or `all`).
  - Returns `https://<custom-host><path>` if active, else falls back to current `closesync.io` URL.
- Update all "Copy link" / "Send" call sites:
  - `ClientPortalLauncher`, `ProposalView` share, `ContractDetail` share, `LeadFormsDashboard` share, `OnboardingDashboard` share, `PublicBookingPage` host share, retainer subscribe link generators.
- Outbound emails (`send-lead-reply`, proposal/contract/onboarding/reminder crons) read the same helper server-side so links in emails also use the custom domain.

**UI**
- New `src/components/settings/CustomDomainsSettings.tsx` — list, add, verify, set per-surface purpose, remove. Mirrors the look of existing `SendingDomainsCard.tsx`.
- Surface in `SettingsPage.tsx` under a new "Domains" section (alongside sending domains).

---

## 3. Phasing

1. **Favicon** (small, self-contained) — DB column, storage bucket, upload UI, runtime injection.
2. **Custom domain DB + UI + verification** — works in "DNS verified" state without SSL automation.
3. **Cloudflare for SaaS integration** — once user provides Cloudflare API token, automates SSL & routing.
4. **Link rewriting** — flip share-link generators to use the helper.

---

## Technical notes

- `react-helmet-async`: confirm install — favicon injection uses `<link rel="icon">` inside `<Helmet>`.
- Cloudflare for SaaS is the standard path for multi-tenant custom hostnames with managed SSL; alternative (Let's Encrypt + custom ALB) is heavier and requires infra we don't control.
- `resolve_custom_domain` RPC must be `SECURITY DEFINER`, anon-callable, returns only `user_id` + `purpose` (no PII).
- Existing routes use slugs/tokens for tenant resolution; we only need to detect "am I on a custom hostname?" to render the branded favicon and skip the default `closesync.io` chrome — route structure stays unchanged.
- Email link generators currently hardcode `https://closesync.io` in several places — audit and route through the new helper.

---

## Open question before build

Cloudflare for SaaS requires a paid CF plan + API token. Do you already have a Cloudflare account on the domain `closesync.io` you'd like to use, or should phase 3 ship as "DNS-verified only" (user provides their own cert via their proxy) until you set that up?
