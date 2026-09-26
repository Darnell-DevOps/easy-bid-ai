# CloseSync functionality audit — 26 September 2026

This pass combines automated checks with live testing in the signed-in local app. It establishes that the flows below work within the tested conditions. It is not a production launch sign-off: provider delivery, recurring jobs, and the complete send/sign/pay lifecycle still require an isolated integration run.

## Verified live

| Journey | Result | Evidence and limit |
| --- | --- | --- |
| Create client | Passed | A synthetic client saved and survived a reload. |
| Edit client | Passed | Service and budget changes persisted through reload. |
| Generate AI proposal | Passed | A draft was generated, stored, and linked to the synthetic client. This verifies one successful generation, not output accuracy for every brief. |
| Open existing proposal from Clients | Fixed and passed | The list now offers Review Draft and opens the linked proposal rather than prompting another creation. |
| Generate contract | Passed | A linked draft agreement was generated. Required legal/details placeholders remained for owner review. |
| Edit contract draft | Fixed and passed | The new editor saved a test marker and the updated agreement survived reload. |
| Block incomplete contract sharing | Passed | Mark-as-sent was blocked while the agreement contained [TBD]. No contract was sent. |
| Public draft signing page | Passed | It displayed Being prepared and no signature form. |
| Draft proposal follow-up controls | Fixed and passed | An unsent proposal no longer offers a follow-up Send now action. No email was sent to test this. |

## Defects corrected

1. Clients inferred proposal readiness only from client status. Existing drafts could therefore prompt duplicate creation. The page now loads active proposal state, offers Review Draft, and falls back to View Client if proposal lookup fails. Client-load failures are shown as errors rather than a false empty workspace.
2. Generated contracts could contain [TBD] fields, while sharing was blocked and there was no editor to resolve them. Draft agreements now have a labelled Markdown editor. Saves require the row to still have draft status. Failed saves retain the text in the dialog. Sent agreements do not expose the editor.
3. Manual follow-ups were offered on unsent drafts, and the Edge Function could fall back to a nudge for them. The UI now allows manual follow-ups only for sent, viewed, or accepted unpaid proposals. The local Edge Function adds the equivalent owner-authorized state guard. **That server change has not been deployed.**
4. The dashboard excluded clients with a linked proposal from the lead stage but also excluded draft proposals from the proposal stage. A workspace containing only a draft therefore displayed Start your first client journey. Drafts now count in the proposal stage; a component regression test verifies this. The final live dashboard recheck was interrupted by suspended browser networking.

## Automated verification

| Check | Result | Scope |
| --- | --- | --- |
| Final npm run check:launch | Passed | Typecheck, 361 tests across 78 Vitest files, and production build. |
| Full browser suite earlier in this pass | 72 passed, 1 skipped | Public routes, accessibility, navigation, responsive layouts, and mock-authenticated workspace coverage. This run preceded the final workflow fixes. |
| Focused Clients and Contracts browser checks | 2 passed | Desktop/mobile page consistency after the client and contract changes. |
| New contract editor browser regressions | 4 passed | Save/reload; stale-save error retention; sent-contract editor absence; mobile cancel without a write. Supabase responses are mocked in these regressions. |
| New state regression tests | Passed | Client action selection, manual follow-up eligibility, and draft conversion-pipeline rendering. |
| git diff --check | Passed | No whitespace errors. |

The credentialed contract sign/countersign/executed-PDF browser test was skipped because TEST_USER_EMAIL and TEST_USER_PASSWORD were unavailable. Focused ESLint checks still report existing no-explicit-any findings in ContractDetail and FollowUpStatus. Build output warns about large bundles and an outdated Browserslist database. These are separate from the passing launch script.

## Workflows still needing integration evidence

| Area | Required next test |
| --- | --- |
| Signup, verification, recovery, MFA | Use dedicated test identities to confirm confirmation/recovery email delivery, expired links, session expiry, and MFA enrollment/challenge. Existing mocked and validation tests do not establish delivery. |
| Proposal and contract sending | Send to an explicitly authorized test inbox, verify the received URL/content and delivery log, then verify sent/viewed states. |
| Contract execution | Client signs a complete test agreement; owner countersigns; both views show executed; both PDFs contain the expected signatures. |
| Payments and retainers | Use provider sandbox checkout; verify webhook processing, idempotency, invoice/paid state, cancellation, failed payment, and recurring renewal behavior. No payments were made in this pass. |
| Inbound leads and email | Submit a public test form and an inbound provider message; verify correct ownership, deduplication, attachment restrictions, inbox state, and lead conversion. |
| Calendar and booking | Create an isolated test booking, verify timezone handling, reminders, reschedule/cancel links, and any external calendar sync. |
| Onboarding, kickoff, portal | Complete a synthetic client form and portal journey; verify persistence, owner/client visibility, and downstream kickoff state. |
| Recovery and scheduled follow-ups | Confirm deployed schedule/credentials; run with test records; check exactly-once delivery and stopping after rejection/payment. |
| Export, trash, restore, access isolation | Verify downloaded data, recoverable restore, and that a second test account cannot read or change the first account's records. No production deletion was exercised. |

Keep Terms and Privacy as drafts, as requested. Business identity and publishable policy details remain outside this test pass.

## Test data left for inspection

The live account contains one clearly labelled synthetic client, one linked proposal draft, and one contract draft. No email, WhatsApp message, signature, payment, or permanent deletion was performed.

- Client: CloseSync QA Test 2026-09-25; qa-client@example.test; id 53cd19f5-600b-4128-b696-675059be74f1.
- Proposal draft: id 0642d1ab-2922-41dc-a993-62eacadd0df4.
- Contract draft: id e90ae270-e278-4817-b2d7-9899f3e72b7b; includes the QA verification marker used to confirm edit persistence.

All code changes remain local and uncommitted. No production deployment or database migration was performed.
