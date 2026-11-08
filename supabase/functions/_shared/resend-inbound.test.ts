import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { readBoundedText } from "./bounded-json.ts";
import { resendDelivery, resendMessage, verifyResendDelivery } from "./resend-inbound.ts";

const id = "4ef9a417-02e9-4d39-ad75-9611e0fcc33c";
const to = "leads-abc012abc012@leads.closesync.io";
const from = "prospect@example.invalid";
const envelope = { type: "email.received", data: { email_id: id, to: [to], from } };
const message = { object: "email", id, to: [to], from, subject: "Project enquiry", text: "Please send a quote." };

Deno.test("Resend verifies the exact signed body and rejects alterations and stale deliveries", async () => {
  const secretBytes = "close-sync-resend-test-secret";
  const secret = `whsec_${btoa(secretBytes)}`;
  const webhookId = "msg_ResendFixture";
  const raw = JSON.stringify(envelope, null, 2);
  const now = Math.floor(Date.now() / 1000);
  const headers = (timestamp: number) => new Headers({
    "svix-id": webhookId,
    "svix-timestamp": String(timestamp),
    "svix-signature": `v1,${createHmac("sha256", secretBytes).update(`${webhookId}.${timestamp}.${raw}`).digest("base64")}`,
  });
  const read = await readBoundedText(new Request("https://example.invalid", { method: "POST", body: raw }), 65_536);
  assert.deepEqual(verifyResendDelivery(read, headers(now), secret), envelope);
  assert.throws(() => verifyResendDelivery(JSON.stringify(envelope), headers(now), secret));
  assert.throws(() => verifyResendDelivery(raw, headers(now - 600), secret));
});

Deno.test("Resend routes only a single issued alias on the receiving subdomain", () => {
  assert.deepEqual(resendDelivery(envelope), { emailId: id, alias: "abc012abc012", fromEmail: from });
  for (const recipients of [
    ["leads-abc012abc012@other.example.invalid"],
    [`${to}@`],
    [to, "leads-abc012abc013@leads.closesync.io"],
  ]) {
    assert.equal(resendDelivery({ ...envelope, data: { ...envelope.data, to: recipients } }), null);
  }
  assert.equal(resendDelivery({ ...envelope, data: { ...envelope.data, email_id: "../../other" } }), null);
});

Deno.test("a fetched Resend message must match the signed delivery and renders as text", () => {
  const delivery = resendDelivery(envelope)!;
  assert.deepEqual(resendMessage(message, delivery), { fromEmail: from, subject: message.subject, body: message.text });
  assert.equal(resendMessage({ ...message, from: "other@example.invalid" }, delivery), null);
  assert.equal(resendMessage({ ...message, to: ["leads-abc012abc013@leads.closesync.io"] }, delivery), null);
  assert.equal(resendMessage({ ...message, id: "4ef9a417-02e9-4d39-ad75-9611e0fcc33d" }, delivery), null);
  assert.equal(resendMessage({ ...message, text: null, html: "<script>secret</script><p>Hello&nbsp;team.</p>" }, delivery)?.body, "Hello team.");
  assert.equal(resendMessage({ ...message, text: "x".repeat(20_000) }, delivery)?.body.length, 16_000);
});
