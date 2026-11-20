# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

CloseSync AI serves owners and billing administrators at small marketing and creative agencies with ongoing client retainers and separately priced extra work. This includes SEO, advertising, social media, content, design and ongoing website services. Their shared need is to carry the agreed scope and price into accurate monthly billing.

The commercial goal is a dependable product whose recurring usefulness justifies a subscription. Customer-count targets do not set the product scope. Adoption of comparable paid software supports the category; CloseSync's own conversion, retention and optimal price remain unproven.

## Product Purpose

CloseSync AI connects retainer agreements, client approvals, monthly fees, invoices and payment status so an agency can complete client billing with less manual administration.

The intended outcome is a correct invoice for each billing period, supported by the agreed scope and approved changes, with a reliable view of what remains unpaid. Current implementation and planned integrations must be labelled accurately; billing review alone does not issue invoices or collect money.

## Positioning

CloseSync AI is an agency retainer billing workspace. One connected client record carries the agreement, approval decisions, billing periods and invoice references. Proposals and contracts establish the commercial agreement; recurring billing is the continuing job that should earn the subscription.

## Operating Context

Users review monthly fees, price and approve changes, prepare invoices and follow outstanding payments. Existing sales, onboarding and scheduling capabilities remain available while the primary workflow becomes complete. Avoid adding unrelated operational features before this job works end to end.

The launch is UK-first. The product should be able to support global users later, so future decisions should avoid unnecessary UK-only technical constraints unless they are required for the launch.

## Capabilities and Constraints

- Lead capture and AI-assisted qualification.
- Proposal creation, approval, and client-facing proposal experiences.
- Contract creation and electronic signatures.
- Retainer scope records, account-free extra-work approval links and monthly billing review.
- Invoice references and payment status currently recorded manually; external accounting sync is not implemented.
- Paddle handles CloseSync subscriptions. Central-Paddle client checkout remains blocked in live mode; Stripe Connect has a sandbox account-onboarding foundation, not a verified client-payment workflow.
- Client onboarding, kickoff, booking, and ongoing client management.
- Email communication, templates, reminders, and scheduled workflow automation.
- Authenticated operational dashboards and token-protected client-facing flows.
- Hosted as a web application using Lovable Cloud with Supabase-backed data and Edge Functions.
- UK-first launch with future global support.

## Brand Commitments

- Official product name: **CloseSync AI**.
- Parent and umbrella brand: **StriveSync**.
- Product messaging leads with accurate monthly client billing for agencies and describes only capabilities available in the release being shown.
- AI should be communicated as useful assistance inside a credible workflow, not as a gimmick or unsupported promise.

## Evidence on Hand

The repository contains working product flows, a sample proposal, client-facing previews, automated tests, and implementation evidence for the capabilities listed above.

There are no confirmed customer testimonials, customer counts, case studies, performance benchmarks, or outcome statistics yet. Future work must not invent or imply this proof.

## Product Principles

1. Keep agreements, approvals, billing and payment evidence connected to one durable client record.
2. Finish the monthly billing job, including exceptions, retries and the next period.
3. Use AI to reduce administrative effort while keeping important actions visible and controllable.
4. Earn trust through accurate product claims, dependable workflows, and professional client-facing experiences.
5. Make setup achievable without a sales call or migrating unrelated tools.
6. Charge for recurring operational value. Change prices and entitlements only with matching checkout, server enforcement and truthful public wording.

## Accessibility & Inclusion

Future work should target WCAG 2.1 AA as the default quality standard. This is a product quality target, not a claim that the entire application has been formally certified or independently audited.
