Remove the "Back to homepage" button from the lead form success screen in `src/pages/PublicLeadFormPage.tsx`.

- Delete the `!embed && <Button>...Back to homepage...</Button>` block in the `done` branch.
- Remove now-unused imports: `ArrowLeft`, `useNavigate`, and the `navigate` declaration if no longer referenced.
- No other behavior changes.