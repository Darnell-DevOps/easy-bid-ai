# CloseSync AI product direction and implementation order

Updated 20 November 2026. CloseSync should earn a subscription by completing a useful, recurring commercial job. The goal is independent of any fixed customer-count target.

## Customer and job

Serve owners and billing administrators at small marketing and creative agencies with monthly retainers and variable extra work. SEO, paid advertising, social media, content, design and ongoing website services share this billing process.

The customer needs to know what each client should be billed, which extras are approved, whether the invoice has been issued and what remains unpaid. New-client proposals and agreements feed that continuing job.

## Product promise

**CloseSync connects retainer agreements, extra-work approvals, monthly invoices and payment status so an agency can complete client billing with less manual administration.**

This is the intended finished product. Current public claims must describe current capabilities: scope records, approval links and billing review, with external invoicing and manually recorded payment status. Do not advertise accounting sync, automatic collection or measured time savings until verified.

## Commercial evidence

- [Ignition's Token Creative customer account](https://www.ignitionapp.com/customers/token-creative) describes a five-person agency with 15–20 clients using recurring fees, variable charges and automated invoicing/payment collection.
- [Ignition's DEFACTO customer account](https://www.ignitionapp.com/customers/defacto-co) describes a five-person social media agency adopting agreements and recurring payments.
- [ManyRequests' retainer workflow](https://manyrequests.com/solutions/retainers) and [Wayfront's paid plans](https://wayfront.com/pricing) show established commercial products serving related agency workflows.

These sources support category adoption and buying behaviour. Supplier-published results do not prove CloseSync's performance or optimal price. A £49 monthly plan is a proposal to evaluate after the paid workflow is complete, not an active price change. Maintain the existing £0/£9/£29 plans until checkout and backend entitlements are changed together.

## Review of the existing app

| Area | Product decision | Current gap |
| --- | --- | --- |
| Retainer agreements and client records | Primary setup and durable commercial record | Improve input validation, agreement changes and price history before automatic invoicing |
| Extra-work approvals | Core part of billing | Links work; delivery, reminders and approval evidence need a complete hosted check |
| Monthly billing review | Primary recurring task | Single-fee preparation and manual invoice/status handoff create repeated work |
| Accounting | Complete the billing handoff | No Xero or QuickBooks implementation in current source |
| Client payments | Connect each agency to its own merchant account | Stripe sandbox onboarding exists; collection, webhooks, reconciliation and payouts remain unverified |
| Proposals, contracts and templates | Support establishing the agreement | Preserve existing records and functionality; avoid separate product positioning |
| Leads, calendar, onboarding and other existing pages | Supporting capabilities | Keep reachable; defer expansion while billing is incomplete |
| Subscription packaging | Charge for the recurring outcome | Free currently includes retainer review; paid upgrades are mostly proposal-based |
| Landing page and sample | Demonstrate the available billing workflow | Published homepage still showed older broad positioning during the 20 November browser check; Lovable preview showed retainer review |

## Implementation order and acceptance criteria

1. **Monthly fee preparation.** Preview all due fees, prepare them together, preserve recorded amounts and handle replay, account isolation, month-end dates, existing payments and ended agreements. Preparing a review must never issue invoices or initiate charges. Test in a disposable database, then apply through Lovable and verify the hosted release.
2. **Accounting handoff.** Implement per-business Xero authorisation, contact mapping, correctly taxed draft invoices, durable retry protection and invoice/payment status synchronisation. Explicitly handle existing repeating invoices so the same monthly charge is not created twice.
3. **Approval delivery and evidence.** Verify controlled-inbox delivery, reminders, clear scope and final price, approval attribution, expiry, withdrawal and concurrent decisions. Never infer that a typed name proves budget authority.
4. **Complete payment path.** Use each agency's own payment arrangement. Verify successful, failed, retried and refunded payments and correct ownership. Preserve the separate CloseSync subscription integration.
5. **Commercial packaging and first use.** Set one clear paid offer, corresponding backend entitlements and matching checkout. Prove self-service setup and one complete billing cycle including the next period, without a sales call.
6. **Publishable operations.** Finish hosted email, legal approval, attachment protection, recovery and release checks. The owner keeps legal pages as drafts, payments in sandbox and permanent purging disabled until their respective gates are resolved.

## Lovable and release boundaries

Local code and tests establish implementation behaviour. GitHub checks establish source readiness. Lovable owns managed database changes, function deployment and publication. Verify the actual published app after each release; a matching synced commit does not prove the public bundle has updated.

Lovable offers a Xero connector, but its [documented limitations](https://docs.lovable.dev/integrations/xero#limitations) explicitly exclude per-end-user Xero login. Each connection is a shared account. CloseSync requires a separate agency-owned connection, so do not attach every customer's billing to the operator's books. Implement the appropriate per-user integration while keeping hosting and secrets on Lovable.

## Release evidence

On 20 November, GitHub main and Lovable's latest source matched `1a7b6e9e820fba52cf2b740a4f6665e3c5bf5eee`. Hosted billing tables and the preceding migration were present. Browser inspection found the published homepage and Lovable preview differed. No customer emails, live charges or permanent deletions were triggered in that review.
