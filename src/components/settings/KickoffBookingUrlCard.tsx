import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

export function KickoffBookingUrlCard() {
  const [value, setValue] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }
      const { data } = await (supabase.from("user_settings") as any)
        .select("kickoff_booking_url")
        .eq("user_id", user.id)
        .maybeSingle();
      if (cancelled) return;
      setValue((data?.kickoff_booking_url as string) || "");
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const trimmed = value.trim();
      const { error } = await (supabase.from("user_settings") as any)
        .upsert({ user_id: user.id, kickoff_booking_url: trimmed || null }, { onConflict: "user_id" });
      if (error) throw error;
      toast({ title: "Booking link saved" });
    } catch (e: any) {
      toast({ title: "Couldn't save", description: e?.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-xl border border-border bg-card p-6">
      <h2 className="text-lg font-semibold mb-1">Calendar defaults</h2>
      <p className="text-sm text-muted-foreground mb-5">
        Configure the scheduling link clients use to book their kickoff call.
      </p>
      <div className="space-y-2 max-w-xl">
        <Label htmlFor="kickoff-url">Kickoff call booking link</Label>
        <Input
          id="kickoff-url"
          type="url"
          placeholder="https://calendly.com/you/kickoff"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          disabled={loading || saving}
        />
        <p className="text-xs text-muted-foreground">
          Paste your Calendly, TidyCal, Google Calendar booking page, or any scheduling link. If set, this is used for kickoff call bookings instead of your internal booking page.
        </p>
        <div className="pt-2">
          <Button onClick={save} disabled={loading || saving}>
            {saving ? "Saving…" : "Save"}
          </Button>
        </div>
      </div>
    </div>
  );
}
