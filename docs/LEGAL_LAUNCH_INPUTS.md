# Legal launch inputs for CloseSync AI

This is a preparation sheet, not published Terms or a Privacy Policy. The current public policy routes are visual previews. No operator or legal contact facts should be inferred from product branding.

## Facts the operator must confirm

- Full legal person operating CloseSync AI and relationship to StriveSync.
- Registered name, number, office address and registration jurisdiction if it is a limited company.
- Governing law and intended countries of sale at launch.
- Contact email for legal, privacy, support and account deletion requests; confirm that each mailbox is monitored.
- Exact Free and Pro entitlements, billing interval, tax presentation, cancellation and refund handling.
- Retention periods for account data, client records, documents, messages, logs and backups.

## Data-flow audit before drafting

The code indicates these flows; deployed configuration, processor contracts, locations and retention must be verified:

| Flow | Code evidence | Questions to confirm |
| --- | --- | --- |
| Account identity and sessions | Supabase Auth and optional Google/Apple sign-in | Auth email provider, account recovery, log retention |
| Client records and documents | Supabase tables and Storage; lead forms, proposals, contracts and onboarding | Data subjects, storage region, deletion/backup behavior |
| AI assistance | Edge Functions call Lovable gateway and Google Gemini models | Exact processor chain, data sent, training and retention settings |
| Payments | Paddle plan, proposal and retainer checkout plus webhooks | Merchant responsibilities, payment data, live country/tax coverage |
| Email and reminders | Resend gateway, auth email hook and scheduled Edge Functions | Sender domain, message contents, delivery/log retention |
| Technical protection | Turnstile and client error reports | Configuration, analytics/tracking, IP and device data |

The privacy notice needs the controller identity, purposes and lawful bases, recipients/processors, transfers, retention, rights and contact details. The Terms need the actual service, plan, cancellation, payment and support promises. Use the [ICO privacy-information checklist](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/individual-rights/the-right-to-be-informed/what-privacy-information-should-we-provide/) and [GOV.UK company website requirements](https://www.gov.uk/running-a-limited-company/signs-stationery-and-promotional-material) where applicable. Review storage and tracking against the [ICO's current guidance](https://ico.org.uk/for-organisations/direct-marketing-and-privacy-and-electronic-communications/guidance-on-the-use-of-storage-and-access-technologies/).

Do not remove the draft warning or no-index flag from the policy pages until the facts and wording have been reviewed.
