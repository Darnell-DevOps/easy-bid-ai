import { createClient } from "npm:@supabase/supabase-js@2";
import { readBoundedJson, readBoundedText } from "../_shared/bounded-json.ts";
import { resendDelivery, resendMessage, verifyResendDelivery } from "../_shared/resend-inbound.ts";

Deno.serve(async (request) => {
  if (request.method !== "POST") return new Response(null, { status: 405 });
  const secret = Deno.env.get("RESEND_INBOUND_WEBHOOK_SECRET");
  const apiKey = Deno.env.get("RESEND_INBOUND_API_KEY");
  if (!secret?.startsWith("whsec_") || !apiKey?.startsWith("re_")) return new Response(null, { status: 503 });

  let event: unknown;
  try {
    const raw = await readBoundedText(request, 65_536);
    event = verifyResendDelivery(raw, request.headers, secret);
  } catch {
    return new Response(null, { status: 401 });
  }

  const delivery = resendDelivery(event);
  if (!delivery) return new Response(null, { status: 200 });

  try {
    const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const [receipt, alias] = await Promise.all([
      db.from("resend_inbound_receipts").select("email_id").eq("email_id", delivery.emailId).maybeSingle(),
      db.from("user_inbound_aliases").select("user_id").eq("slug", delivery.alias).maybeSingle(),
    ]);
    if (receipt.error || alias.error) throw new Error("Inbound email lookup failed");
    if (receipt.data || !alias.data) return new Response(null, { status: 200 });

    const response = await fetch(`https://api.resend.com/emails/receiving/${delivery.emailId}?html_format=cid`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      redirect: "error",
      signal: AbortSignal.timeout(8_000),
    });
    if (!response.ok) {
      console.error("Resend inbound retrieval failed", response.status);
      await response.body?.cancel();
      return new Response(null, { status: 503 });
    }
    const message = resendMessage(await readBoundedJson(response, 1_048_576), delivery);
    if (!message) {
      console.warn("Resend inbound envelope did not match the retrieved message");
      return new Response(null, { status: 200 });
    }

    const { error } = await db.rpc("record_resend_inbound_email", {
      _email_id: delivery.emailId, _alias: delivery.alias, _expected_owner: alias.data.user_id,
      _from_email: message.fromEmail, _subject: message.subject, _body: message.body,
    });
    if (error) throw error;
    return new Response(null, { status: 200 });
  } catch {
    console.error("Resend inbound intake failed");
    return new Response(null, { status: 503 });
  }
});
