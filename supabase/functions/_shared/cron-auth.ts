export function isCronAuthorized(req: Request): boolean {
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const cronSecret = Deno.env.get("CRON_SECRET");
  const authorization = req.headers.get("Authorization");
  const suppliedSecret = req.headers.get("x-cron-secret");

  return Boolean(
    (serviceKey && authorization === `Bearer ${serviceKey}`) ||
      (cronSecret && suppliedSecret === cronSecret),
  );
}

export function cronUnauthorized(): Response {
  return new Response(JSON.stringify({ error: "Unauthorized cron request" }), {
    status: 401,
    headers: { "Content-Type": "application/json" },
  });
}
