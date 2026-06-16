// One-shot sync: copies LEAD_QUALIFY_SECRET env into internal_config so the DB trigger can use it.
// Safe to expose: takes no input, only writes its own server-side env value to a fixed key.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const secret = Deno.env.get('LEAD_QUALIFY_SECRET');
    if (!secret) {
      return new Response(JSON.stringify({ error: 'LEAD_QUALIFY_SECRET not set' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { error } = await admin
      .from('internal_config')
      .upsert({ key: 'lead_qualify_secret', value: secret, updated_at: new Date().toISOString() });

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ ok: true, synced_at: new Date().toISOString() }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
