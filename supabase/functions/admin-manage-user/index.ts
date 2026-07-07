import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type ActionType = "update_profile" | "reset_password" | "suspend" | "reactivate" | "delete";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
  const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const auth = req.headers.get("Authorization");
  if (!auth) return json({ error: "unauthorized" }, 401);

  // Caller-scoped client (used to identify user + verify super_admin)
  const callerClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: auth } },
  });

  const { data: userData, error: userErr } = await callerClient.auth.getUser();
  if (userErr || !userData?.user) return json({ error: "unauthorized" }, 401);
  const callerId = userData.user.id;

  const { data: isAdmin, error: roleErr } = await callerClient.rpc("is_super_admin");
  if (roleErr || !isAdmin) return json({ error: "forbidden" }, 403);

  // Service-role client for privileged ops + writing to audit log
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return json({ error: "invalid_json" }, 400);
  }

  const action = body.action as ActionType;
  const targetUserId: string | undefined = body.target_user_id;

  if (!action) return json({ error: "missing_action" }, 400);
  if (!targetUserId) return json({ error: "missing_target_user_id" }, 400);

  const logAction = async (
    action_type: string,
    details: Record<string, unknown>,
    ok: boolean,
    error?: string,
  ) => {
    try {
      await admin.from("admin_actions_log").insert({
        admin_user_id: callerId,
        target_user_id: targetUserId,
        action_type,
        details: { ...details, ok, ...(error ? { error } : {}) },
      });
    } catch (_e) {
      // best-effort logging
    }
  };

  try {
    if (action === "update_profile") {
      const { email, full_name, business_name } = body;
      const updates: Record<string, unknown> = {};
      if (typeof email === "string" && email.trim()) updates.email = email.trim();
      if (typeof full_name === "string") {
        updates.user_metadata = { full_name };
      }

      let authUpdated = false;
      if (Object.keys(updates).length > 0) {
        const { error } = await admin.auth.admin.updateUserById(targetUserId, updates);
        if (error) {
          await logAction("update_profile", { updates, business_name }, false, error.message);
          return json({ error: error.message }, 400);
        }
        authUpdated = true;
      }

      let brandingUpdated = false;
      let aiPrefsUpdated = false;
      if (typeof business_name === "string" && business_name.trim()) {
        const bn = business_name.trim();
        const { error: bErr, count: bCount } = await admin
          .from("business_branding")
          .update({ business_name: bn })
          .eq("user_id", targetUserId)
          .select("user_id", { count: "exact", head: true });
        if (!bErr) brandingUpdated = (bCount ?? 0) > 0;

        const { error: aErr, count: aCount } = await admin
          .from("ai_preferences")
          .update({ business_name: bn })
          .eq("user_id", targetUserId)
          .select("user_id", { count: "exact", head: true });
        if (!aErr) aiPrefsUpdated = (aCount ?? 0) > 0;
      }

      await logAction(
        "update_profile",
        { updates, business_name, authUpdated, brandingUpdated, aiPrefsUpdated },
        true,
      );
      return json({ ok: true });
    }

    if (action === "reset_password") {
      const { data: tgt, error: getErr } = await admin.auth.admin.getUserById(targetUserId);
      if (getErr || !tgt?.user?.email) {
        await logAction("reset_password", {}, false, getErr?.message ?? "no_email");
        return json({ error: "target_email_unknown" }, 400);
      }
      const email = tgt.user.email;
      const redirectTo = body.redirect_to || `${new URL(req.url).origin}`;
      const { error } = await admin.auth.resetPasswordForEmail(email, { redirectTo });
      if (error) {
        await logAction("reset_password", { email }, false, error.message);
        return json({ error: error.message }, 400);
      }
      await logAction("reset_password", { email }, true);
      return json({ ok: true });
    }

    if (action === "suspend") {
      const { error } = await admin.auth.admin.updateUserById(targetUserId, {
        ban_duration: "876000h", // ~100 years, effectively indefinite
      } as any);
      if (error) {
        await logAction("suspend", {}, false, error.message);
        return json({ error: error.message }, 400);
      }
      await logAction("suspend", { ban_duration: "876000h" }, true);
      return json({ ok: true });
    }

    if (action === "reactivate") {
      const { error } = await admin.auth.admin.updateUserById(targetUserId, {
        ban_duration: "none",
      } as any);
      if (error) {
        await logAction("reactivate", {}, false, error.message);
        return json({ error: error.message }, 400);
      }
      await logAction("reactivate", {}, true);
      return json({ ok: true });
    }

    if (action === "delete") {
      if (targetUserId === callerId) {
        await logAction("delete", {}, false, "cannot_delete_self");
        return json({ error: "You cannot delete your own account with this tool." }, 400);
      }
      const { data: targetIsAdmin, error: chkErr } = await callerClient.rpc(
        "admin_is_super_admin_user",
        { _target_user_id: targetUserId },
      );
      if (chkErr) {
        await logAction("delete", {}, false, chkErr.message);
        return json({ error: chkErr.message }, 400);
      }
      if (targetIsAdmin) {
        await logAction("delete", {}, false, "target_is_super_admin");
        return json(
          { error: "Target user is a super admin. Demote them before deleting." },
          400,
        );
      }
      const { error } = await admin.auth.admin.deleteUser(targetUserId);
      if (error) {
        await logAction("delete", {}, false, error.message);
        return json({ error: error.message }, 400);
      }
      await logAction("delete", {}, true);
      return json({ ok: true });
    }

    return json({ error: "unknown_action" }, 400);
  } catch (e: any) {
    await logAction(action, {}, false, e?.message ?? String(e));
    return json({ error: e?.message ?? "internal_error" }, 500);
  }
});
