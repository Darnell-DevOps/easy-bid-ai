## Goal

Make every toggle in **Settings → Automations** actually change behaviour, then verify enable/disable produces a different outcome for each one.

Today, `automation_preferences` is only read by its own settings UI. None of the **26** toggles are consumed anywhere else. This plan wires each one to a real trigger point and tests it on and off.

## The 26 toggles

- **Proposals (5)**: auto-send, follow-up reminder, create deadline from timeline, notify viewed, notify expired
- **Contracts (4)**: auto-generate after acceptance, auto-send after acceptance, follow-up if unsigned, notify signed
- **Payments (5)**: auto-send payment request after signing, auto-send payment confirmation, notify received, notify failed, follow-up reminder for unpaid invoices
- **Onboarding (4)**: auto-send after payment, auto-create onboarding task, notify completed, remind client if incomplete
- **Retainers (4)**: renewal reminder, notify before renewal, notify recurring payment failed, generate renewal proposal draft
- **Deadlines (4)**: from contracts, from proposals, notify before, notify overdue

Total: 5 + 4 + 5 + 4 + 4 + 4 = **26**.

## Trigger-point map

| Trigger (existing code)                              | Toggles wired here |
| ---------------------------------------------------- | ------------------ |
| `generate-proposal` / proposal-create flow           | proposal_auto_send, proposal_create_deadline, proposal_follow_up |
| `client_portal_respond` RPC (proposal accepted)      | contract_auto_generate, contract_auto_send, deadlines_from_proposals |
| Proposal view tracker + new expiry cron              | proposal_notify_viewed, proposal_notify_expired |
| `contract_sign` RPC                                  | payment_auto_request, contract_follow_up (cancel reminder), contract_notify_signed, deadlines_from_contracts |
| `payments-webhook` `transaction.completed`           | payment_auto_confirmation, payment_notify_received, onboarding_auto_send, onboarding_auto_task |
| `payments-webhook` `transaction.payment_failed`      | payment_notify_failed, retainer_notify_failed |
| New unpaid-invoice cron                              | payment_follow_up_unpaid |
| `onboarding_submit` RPC                              | onboarding_notify_completed |
| New onboarding reminder cron                         | onboarding_remind_client |
| New retainer renewal cron (or extend recovery cron)  | retainer_renewal_reminder, retainer_notify_before_renewal, retainer_generate_proposal_draft |
| New deadline cron                                    | deadlines_notify_before, deadlines_notify_overdue |

## Approach

1. **DB helper** `public.automation_enabled(_user_id uuid, _key text) returns boolean` — reads `automation_preferences.preferences ->> _key`, falling back to the same defaults as the UI. Used by SECURITY DEFINER RPCs and triggers.
2. **Edge helper** `_shared/automations.ts` exposing `isAutomationEnabled(userId, key)` — same defaults, single source of truth for edge functions.
3. Wire every toggle at exactly one trigger point, guarded by the helper.
4. Add the small number of crons that don't yet exist (expiry, unpaid invoices, onboarding reminder, deadline reminders, renewal reminder).

## Verification

For every toggle, two automated runs:
- Run 1: set toggle **on** → fire the trigger via `curl_edge_functions` or direct SQL → assert the expected side effect happened (row inserted, email enqueued, notification created).
- Run 2: set toggle **off** → fire the same trigger → assert the side effect did **not** happen.

Results written to `/mnt/documents/automation-test-results.md` with pass/fail for each of the 26 toggles (52 runs total).

## Important caveats

This is a large change: ~10 edge functions touched, several new cron jobs, a DB helper, light updates to a few RPCs. Expect multiple migration approvals.

A few toggles touch features that aren't fully built yet — I'll wire the trigger and stub the side effect minimally rather than build new product surface:
- **`payment_follow_up_unpaid`**: no unpaid-invoice table for proposals yet — wired for `retainer_invoices`, with a stub hook for proposals.
- **`onboarding_remind_client`**: new lightweight cron that uses existing email infra.
- **`retainer_generate_proposal_draft`**: creates a draft proposal row via `generate-proposal`; no auto-send.

If you'd rather cut scope (e.g. wire Payments + Contracts + Onboarding end-to-end first, defer cron-only toggles), say so and I'll re-plan tighter. Otherwise on approval I'll execute the full plan.