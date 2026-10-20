import { isStripeAccountId, stripeRequest } from "./stripe-connect-request.ts";

type CreatedMerchant = {
  id?: string;
  livemode?: boolean;
  dashboard?: string;
  identity?: { country?: string };
  applied_configurations?: string[];
  defaults?: { responsibilities?: { fees_collector?: string; losses_collector?: string } };
};

/** Accounts v2 equivalent of a Standard merchant: full Dashboard, Stripe fees/losses. */
export async function createStripeConnectMerchant(
  key: string,
  owner: { userId: string; email: string; country: string },
): Promise<string> {
  if (!key.startsWith("sk_test_")) throw new Error("Only Stripe test accounts are supported");
  const account = await stripeRequest<CreatedMerchant>(key, "/core/accounts", {
    api: "v2", method: "POST",
    // A separate, stable namespace avoids replaying the confirmed cached v1
    // rejection. Retries/concurrent calls still refer to the same v2 creation.
    idempotencyKey: `closesync-connect-test-accounts-v2-${owner.userId}`,
    body: {
      contact_email: owner.email,
      identity: { country: owner.country.toLowerCase() },
      dashboard: "full",
      configuration: { merchant: { capabilities: { card_payments: { requested: true } } } },
      defaults: { responsibilities: { fees_collector: "stripe", losses_collector: "stripe" } },
      metadata: { closesync_user_id: owner.userId },
      include: ["identity", "defaults", "configuration.merchant"],
    },
  });
  const responsibility = account.defaults?.responsibilities;
  if (!isStripeAccountId(account.id) || account.livemode !== false ||
    account.identity?.country?.toUpperCase() !== owner.country.toUpperCase() ||
    account.dashboard !== "full" || !account.applied_configurations?.includes("merchant") ||
    responsibility?.fees_collector !== "stripe" || responsibility?.losses_collector !== "stripe") {
    throw new Error("Stripe returned an unexpected merchant account");
  }
  return account.id;
}
