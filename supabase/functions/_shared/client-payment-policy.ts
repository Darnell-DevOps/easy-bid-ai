// CloseSync's Paddle account is for CloseSync SaaS billing. Until each business
// has an approved merchant account, the legacy client checkout is test-only.
export function mayUseCentralClientCheckout(environment: string): boolean {
  return environment === "sandbox";
}
