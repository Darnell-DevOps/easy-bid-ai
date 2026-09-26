import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { KeyRound, LogOut, Shield, Trash2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { performSignOut } from "@/lib/logout";

export default function SecuritySettings() {
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);
  const [factorId, setFactorId] = useState<string | null>(null);
  const [loadingFactor, setLoadingFactor] = useState(true);
  const [enrollment, setEnrollment] = useState<{ id: string; qr: string; secret: string } | null>(null);
  const [code, setCode] = useState("");
  const [mfaBusy, setMfaBusy] = useState(false);
  const [disableOpen, setDisableOpen] = useState(false);
  const [sessionsOpen, setSessionsOpen] = useState(false);

  const refreshFactor = useCallback(async () => {
    setLoadingFactor(true);
    const { data, error } = await supabase.auth.mfa.listFactors();
    if (error) {
      toast({ title: "Couldn't check your authenticator", description: error.message, variant: "destructive" });
    } else {
      setFactorId(data.totp.find((factor) => factor.status === "verified")?.id ?? null);
    }
    setLoadingFactor(false);
  }, [toast]);

  useEffect(() => {
    void supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? ""));
    void refreshFactor();
  }, [refreshFactor]);

  const updatePassword = async () => {
    if (newPassword.length < 12 || newPassword !== confirmPassword) {
      toast({ title: "Check your new password", description: "Use at least 12 characters and enter the same password twice.", variant: "destructive" });
      return;
    }
    setSavingPassword(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setSavingPassword(false);
    if (error) {
      toast({ title: "Couldn't update password", description: error.message, variant: "destructive" });
      return;
    }
    setNewPassword("");
    setConfirmPassword("");
    toast({ title: "Password updated" });
  };

  const sendResetLink = async () => {
    if (!email) return;
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin + "/reset-password" });
    toast(error
      ? { title: "Couldn't send reset link", description: error.message, variant: "destructive" }
      : { title: "Reset link requested", description: "Check your email for the link." });
  };

  const beginEnrollment = async () => {
    setMfaBusy(true);
    const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp", friendlyName: "CloseSync authenticator" });
    setMfaBusy(false);
    if (error || !data?.totp) {
      toast({ title: "Couldn't start authenticator setup", description: error?.message, variant: "destructive" });
      return;
    }
    setEnrollment({ id: data.id, qr: data.totp.qr_code, secret: data.totp.secret });
  };

  const cancelEnrollment = async () => {
    const id = enrollment?.id;
    setEnrollment(null);
    setCode("");
    if (id) await supabase.auth.mfa.unenroll({ factorId: id });
  };

  const verifyEnrollment = async () => {
    if (!enrollment || !/^\d{6}$/.test(code)) return;
    setMfaBusy(true);
    const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: enrollment.id, code });
    setMfaBusy(false);
    if (error) {
      toast({ title: "Code not accepted", description: "Check the current code in your authenticator and try again.", variant: "destructive" });
      return;
    }
    setEnrollment(null);
    setCode("");
    await refreshFactor();
    toast({ title: "Authenticator enabled" });
  };

  const disableMfa = async () => {
    if (!factorId) return;
    setMfaBusy(true);
    const { error } = await supabase.auth.mfa.unenroll({ factorId });
    setMfaBusy(false);
    setDisableOpen(false);
    if (error) {
      toast({ title: "Couldn't disable authenticator", description: error.message, variant: "destructive" });
      return;
    }
    await refreshFactor();
    toast({ title: "Authenticator disabled" });
  };

  const signOutOtherSessions = async () => {
    const { error } = await supabase.auth.signOut({ scope: "others" });
    setSessionsOpen(false);
    toast(error
      ? { title: "Couldn't sign out other sessions", description: error.message, variant: "destructive" }
      : { title: "Other sessions signed out" });
  };

  return (
    <div className="space-y-6">
      <Card><CardContent className="p-6">
        <h3 className="text-base font-semibold text-foreground">Sign-in</h3>
        <p className="mt-1 text-sm text-muted-foreground">{email ? "Signed in as " + email : "Checking your account…"}</p>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="security-new-password">New password</Label>
            <Input id="security-new-password" type="password" autoComplete="new-password" minLength={12} value={newPassword} onChange={(event) => setNewPassword(event.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="security-confirm-password">Confirm new password</Label>
            <Input id="security-confirm-password" type="password" autoComplete="new-password" minLength={12} value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} />
          </div>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">Use at least 12 characters.</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button onClick={updatePassword} disabled={savingPassword || !newPassword || !confirmPassword}>{savingPassword ? "Updating…" : "Update password"}</Button>
          <Button variant="outline" onClick={sendResetLink} disabled={!email}>Send reset link instead</Button>
        </div>
      </CardContent></Card>

      <Card><CardContent className="p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="flex items-center gap-2 text-base font-semibold text-foreground"><Shield className="h-4 w-4" aria-hidden="true" /> Authenticator app</h3>
            <p className="mt-1 text-sm text-muted-foreground">Require a six-digit code when opening your workspace after sign-in.</p>
          </div>
          <Badge variant={factorId ? "default" : "outline"}>{loadingFactor ? "Checking" : factorId ? "On" : "Off"}</Badge>
        </div>
        <div className="mt-5 flex items-center justify-between gap-4 border-t border-border pt-4">
          <Label htmlFor="security-mfa-switch">Use an authenticator app</Label>
          <Switch id="security-mfa-switch" aria-label="Use an authenticator app" checked={Boolean(factorId)} disabled={loadingFactor || mfaBusy} onCheckedChange={(checked) => checked ? void beginEnrollment() : setDisableOpen(true)} />
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          Recovery codes are not available yet. If you lose your authenticator, you will need help from support to regain access. Do not enable this until you can keep a second copy of your authenticator.
        </p>
      </CardContent></Card>

      <Card><CardContent className="p-6">
        <h3 className="text-base font-semibold text-foreground">Sessions</h3>
        <p className="mt-1 text-sm text-muted-foreground">Manage where your account is signed in.</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => void performSignOut("/login")}><LogOut className="mr-2 h-4 w-4" aria-hidden="true" /> Sign out here</Button>
          <Button variant="outline" onClick={() => setSessionsOpen(true)}>Sign out other sessions</Button>
        </div>
      </CardContent></Card>

      <Card><CardContent className="p-6">
        <h3 className="text-base font-semibold text-foreground">Privacy and account requests</h3>
        <p className="mt-1 text-sm text-muted-foreground">You can export workspace records in Data & Exports. For an account deletion request, email support; do not send your password.</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button asChild variant="outline"><Link to="/privacy">View privacy draft</Link></Button>
          <Button asChild variant="outline"><a href="mailto:support@closesync.io?subject=CloseSync%20account%20deletion%20request"><Trash2 className="mr-2 h-4 w-4" aria-hidden="true" /> Email a deletion request</a></Button>
        </div>
      </CardContent></Card>

      <Dialog open={Boolean(enrollment)} onOpenChange={(open) => { if (!open) void cancelEnrollment(); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Set up an authenticator</DialogTitle>
            <DialogDescription>Scan the QR code, then enter the current six-digit code. Keep access to your authenticator: recovery codes are not available.</DialogDescription>
          </DialogHeader>
          {enrollment && <div className="space-y-4">
            <img src={enrollment.qr} alt="Authenticator setup QR code" className="mx-auto h-44 w-44" />
            <div className="space-y-2"><Label htmlFor="mfa-secret">Manual setup key</Label><Input id="mfa-secret" value={enrollment.secret} readOnly /></div>
            <div className="space-y-2"><Label htmlFor="mfa-enrollment-code">Authenticator code</Label><Input id="mfa-enrollment-code" autoComplete="one-time-code" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))} /></div>
          </div>}
          <DialogFooter>
            <Button variant="outline" onClick={() => void cancelEnrollment()}>Cancel</Button>
            <Button onClick={verifyEnrollment} disabled={mfaBusy || code.length !== 6}>{mfaBusy ? "Verifying…" : "Enable authenticator"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={disableOpen} onOpenChange={setDisableOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Disable authenticator?</DialogTitle><DialogDescription>Your next sign-in will use your regular sign-in method without an authenticator code.</DialogDescription></DialogHeader>
          <DialogFooter><Button variant="outline" onClick={() => setDisableOpen(false)}>Keep enabled</Button><Button variant="destructive" onClick={disableMfa} disabled={mfaBusy}>Disable authenticator</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={sessionsOpen} onOpenChange={setSessionsOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Sign out other sessions?</DialogTitle><DialogDescription>This revokes other sessions. They may remain active until their current access tokens expire. Your current session stays open.</DialogDescription></DialogHeader>
          <DialogFooter><Button variant="outline" onClick={() => setSessionsOpen(false)}>Cancel</Button><Button onClick={signOutOtherSessions}>Sign out other sessions</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
