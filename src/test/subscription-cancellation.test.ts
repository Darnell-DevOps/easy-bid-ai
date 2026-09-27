import { readFileSync } from "node:fs";
import { transpileModule, ModuleKind, ScriptTarget } from "typescript";
import { describe, expect, it, vi } from "vitest";

function endpoint(subscription: Record<string,unknown> | null, provider: Record<string,unknown>) {
  const update = vi.fn();
  const chain: any = { error: null, select: () => chain, eq: () => chain, maybeSingle: async () => ({ data: subscription, error: null }), update: (value: unknown) => { update(value); return chain; } };
  const client = { from: () => chain, auth: { getUser: async () => ({ data: { user: { id: "caller-user" } }, error: null }) } };
  const cancel = vi.fn(async () => provider), get = vi.fn(async () => ({ ...provider, scheduledChange: null }));
  let handler: (req: Request) => Promise<Response>;
  const contents = readFileSync("supabase/functions/cancel-plan-subscription/index.ts","utf8");
  const js = transpileModule(contents, { compilerOptions: { module: ModuleKind.ES2022, target: ScriptTarget.ES2022 } }).outputText.replace(/^import[\s\S]*?;\s*/gm, "").replace(/export \{\};?/g, "");
  new Function("Deno","createClient","getServerPaddleEnv","getPaddleClient",js)(
    { env: { get: () => "test" }, serve: (fn: typeof handler) => { handler = fn; } },
    () => client, () => "sandbox", () => ({ subscriptions: { get, cancel } }),
  );
  const invoke = () => handler(new Request("https://test.invalid/cancel",{ method: "POST", headers: { Authorization: "Bearer test-user-token" }, body: JSON.stringify({ userId: "someone-else" }) }));
  return { invoke, update, cancel, get };
}
describe("subscription cancellation", () => {
  const subscription = { plan: "pro", paddle_subscription_id: "sub_test", environment: "sandbox" };
  const provider = { scheduledChange: { action: "cancel", effectiveAt: "2026-10-27T12:00:00Z" }, currentBillingPeriod: { endsAt: "2026-10-27T12:00:00Z" }, updatedAt: "2026-09-27T12:00:00Z" };
  it("stops renewal without changing the paid entitlement", async () => {
    const app = endpoint(subscription,provider);
    const response = await app.invoke();
    expect(response.status).toBe(200);
    expect(app.cancel).toHaveBeenCalledWith("sub_test",{ effectiveFrom: "next_billing_period" });
    expect(app.update).toHaveBeenCalledWith({ cancel_at_period_end: true, current_period_end: "2026-10-27T12:00:00Z", paddle_updated_at: provider.updatedAt });
    expect(await response.json()).toMatchObject({ ok: true, accessEndsAt: provider.scheduledChange.effectiveAt });
    expect(app.update.mock.calls[0][0]).not.toHaveProperty("plan");
  });
  it("does not alter entitlements when the provider does not confirm an end date", async () => {
    const app = endpoint(subscription,{ updatedAt: provider.updatedAt });
    expect((await app.invoke()).status).toBe(500);
    expect(app.update).not.toHaveBeenCalled();
  });
  it("refuses to cancel a pending or wrong-environment subscription", async () => {
    for (const row of [{ plan: "pro" }, { ...subscription, environment: "live" }]) {
      const app = endpoint(row,provider);
      expect((await app.invoke()).status).toBe(500);
      expect(app.cancel).not.toHaveBeenCalled();
      expect(app.update).not.toHaveBeenCalled();
    }
  });
  it("treats an already-free account as a no-op", async () => {
    const app = endpoint({ plan: "free" },provider);
    expect((await app.invoke()).status).toBe(200);
    expect(app.cancel).not.toHaveBeenCalled();
    expect(app.update).not.toHaveBeenCalled();
  });
});
