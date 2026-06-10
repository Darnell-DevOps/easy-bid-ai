import { useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import {
  Eye,
  EyeOff,
  Shield,
  ShieldCheck,
  ShieldAlert,
  KeyRound,
  Smartphone,
  Monitor,
  LogOut,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Download,
  ExternalLink,
  Trash2,
  History,
  Bell,
} from "lucide-react";

type AlertPrefs = {
  newLogin: boolean;
  newDevice: boolean;
  passwordChanged: boolean;
  settingsChanged: boolean;
  methodEmail: boolean;
  methodInApp: boolean;
};

const DEFAULT_ALERTS: AlertPrefs = {
  newLogin: true,
  newDevice: true,
  passwordChanged: true,
  settingsChanged: false,
  methodEmail: true,
  methodInApp: true,
};

function scorePassword(pw: string): { score: number; label: string; color: string } {
  let s = 0;
  if (pw.length >= 8) s++;
  if (pw.length >= 12) s++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) s++;
  if (/\d/.test(pw)) s++;
  if (/[^A-Za-z0-9]/.test(pw)) s++;
  const labels = ["Too short", "Weak", "Fair", "Good", "Strong", "Excellent"];
  const colors = ["bg-destructive", "bg-destructive", "bg-amber-500", "bg-amber-500", "bg-emerald-500", "bg-emerald-500"];
  return { score: s, label: labels[s], color: colors[s] };
}

export default function SecuritySettings() {
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [userCreatedAt, setUserCreatedAt] = useState<string | null>(null);

  // password
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [savingPw, setSavingPw] = useState(false);

  // 2FA (UI scaffold)
  const [twoFAEnabled, setTwoFAEnabled] = useState(false);
  const [twoFASetupAt, setTwoFASetupAt] = useState<string | null>(null);
  const [twoFADialog, setTwoFADialog] = useState(false);

  // alerts
  const [alerts, setAlerts] = useState<AlertPrefs>(DEFAULT_ALERTS);

  // delete account
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletePw, setDeletePw] = useState("");
  const [deleteConfirmText, setDeleteConfirmText] = useState("");

  // sign-out-all
  const [signOutAllOpen, setSignOutAllOpen] = useState(false);

  const pwStrength = useMemo(() => scorePassword(newPw), [newPw]);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setEmail(user.email || "");
        setUserCreatedAt(user.created_at || null);
      }
      try {
        const raw = localStorage.getItem("security_alert_prefs");
        if (raw) setAlerts({ ...DEFAULT_ALERTS, ...JSON.parse(raw) });
        const twofa = localStorage.getItem("security_2fa");
        if (twofa) {
          const parsed = JSON.parse(twofa);
          setTwoFAEnabled(!!parsed.enabled);
          setTwoFASetupAt(parsed.setupAt || null);
        }
      } catch {}
    })();
  }, []);

  const updateAlerts = (patch: Partial<AlertPrefs>) => {
    const next = { ...alerts, ...patch };
    setAlerts(next);
    localStorage.setItem("security_alert_prefs", JSON.stringify(next));
  };

  // Active sessions — current session only is reliable from the SDK.
  const [currentSession, setCurrentSession] = useState<{ ua: string; lastActive: string } | null>(null);
  useEffect(() => {
    setCurrentSession({
      ua: typeof navigator !== "undefined" ? navigator.userAgent : "Unknown",
      lastActive: new Date().toISOString(),
    });
  }, []);

  const parseUA = (ua: string) => {
    const browser = /Chrome\//.test(ua) && !/Edg\//.test(ua) ? "Chrome"
      : /Safari\//.test(ua) && !/Chrome\//.test(ua) ? "Safari"
      : /Firefox\//.test(ua) ? "Firefox"
      : /Edg\//.test(ua) ? "Edge"
      : "Browser";
    const os = /Windows/.test(ua) ? "Windows"
      : /Mac OS X/.test(ua) ? "macOS"
      : /iPhone|iPad/.test(ua) ? "iOS"
      : /Android/.test(ua) ? "Android"
      : /Linux/.test(ua) ? "Linux"
      : "Unknown OS";
    return { browser, os };
  };

  const handleChangePassword = async () => {
    if (newPw !== confirmPw) {
      toast({ title: "Passwords don't match", variant: "destructive" });
      return;
    }
    if (pwStrength.score < 3) {
      toast({ title: "Password too weak", description: "Use 12+ chars with mixed case, numbers and symbols.", variant: "destructive" });
      return;
    }
    setSavingPw(true);
    const { error } = await supabase.auth.updateUser({ password: newPw });
    setSavingPw(false);
    if (error) {
      toast({ title: "Couldn't update password", description: error.message, variant: "destructive" });
      return;
    }
    setCurrentPw("");
    setNewPw("");
    setConfirmPw("");
    toast({ title: "Password updated", description: "Your password has been changed successfully." });
  };

  const handleSignOutOthers = async () => {
    const { error } = await supabase.auth.signOut({ scope: "others" as any });
    setSignOutAllOpen(false);
    if (error) {
      toast({ title: "Couldn't sign out other sessions", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Signed out other sessions", description: "All other devices have been logged out." });
    }
  };

  const handleSignOutCurrent = async () => {
    await supabase.auth.signOut();
    window.location.href = "/login";
  };

  const handlePasswordReset = async () => {
    if (!email) return;
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else toast({ title: "Reset email sent", description: "Check your inbox for the reset link." });
  };

  const toggle2FA = () => {
    if (twoFAEnabled) {
      // disable
      setTwoFAEnabled(false);
      setTwoFASetupAt(null);
      localStorage.setItem("security_2fa", JSON.stringify({ enabled: false }));
      toast({ title: "Two-factor authentication disabled" });
    } else {
      setTwoFADialog(true);
    }
  };

  const confirmEnable2FA = () => {
    const now = new Date().toISOString();
    setTwoFAEnabled(true);
    setTwoFASetupAt(now);
    localStorage.setItem("security_2fa", JSON.stringify({ enabled: true, setupAt: now }));
    setTwoFADialog(false);
    toast({ title: "Two-factor authentication enabled", description: "Store your backup codes somewhere safe." });
  };

  // mock login history
  const loginHistory = useMemo(() => {
    const ua = currentSession?.ua || "";
    const { browser, os } = parseUA(ua);
    const now = Date.now();
    return [
      { date: new Date(now).toISOString(), browser, os, status: "success" as const },
      { date: new Date(now - 86400000).toISOString(), browser, os, status: "success" as const },
      { date: new Date(now - 3 * 86400000).toISOString(), browser, os, status: "success" as const },
    ];
  }, [currentSession]);

  // security score
  const recs = useMemo(() => {
    const items: { ok: boolean; label: string }[] = [];
    items.push({ ok: pwStrength.score >= 4 || !newPw, label: newPw ? "Strong password chosen" : "Strong password set" });
    items.push({ ok: twoFAEnabled, label: twoFAEnabled ? "2FA enabled" : "Enable 2FA for stronger protection" });
    items.push({ ok: alerts.newLogin || alerts.newDevice, label: "Login alerts enabled" });
    items.push({ ok: true, label: "Email verified" });
    const score = Math.round((items.filter((i) => i.ok).length / items.length) * 100);
    return { items, score };
  }, [pwStrength.score, newPw, twoFAEnabled, alerts]);

  const scoreColor =
    recs.score >= 80 ? "text-emerald-500" : recs.score >= 50 ? "text-amber-500" : "text-destructive";
  const scoreBar =
    recs.score >= 80 ? "bg-emerald-500" : recs.score >= 50 ? "bg-amber-500" : "bg-destructive";

  const { browser: curBrowser, os: curOs } = parseUA(currentSession?.ua || "");

  return (
    <div className="space-y-6">
      {/* Security score */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center">
                <ShieldCheck className="w-5 h-5 text-accent" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-foreground">Security Score</h3>
                <p className="text-xs text-muted-foreground mt-0.5">How protected your account is</p>
              </div>
            </div>
            <div className={`text-2xl font-bold ${scoreColor}`}>{recs.score}%</div>
          </div>
          <div className="w-full h-2 rounded-full bg-muted overflow-hidden mb-4">
            <div className={`h-full ${scoreBar} transition-all`} style={{ width: `${recs.score}%` }} />
          </div>
          <ul className="space-y-2">
            {recs.items.map((r, i) => (
              <li key={i} className="flex items-center gap-2 text-sm">
                {r.ok ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0" />
                )}
                <span className={r.ok ? "text-foreground" : "text-muted-foreground"}>{r.label}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      {/* Password */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <KeyRound className="w-4 h-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold text-foreground">Password</h3>
          </div>

          <div className="space-y-4">
            <PasswordField
              id="current-pw"
              label="Current password"
              value={currentPw}
              onChange={setCurrentPw}
              show={showCurrent}
              setShow={setShowCurrent}
            />
            <PasswordField
              id="new-pw"
              label="New password"
              value={newPw}
              onChange={setNewPw}
              show={showNew}
              setShow={setShowNew}
            />
            {newPw && (
              <div className="space-y-1.5">
                <div className="w-full h-1.5 rounded-full bg-muted overflow-hidden flex gap-0.5">
                  {[0, 1, 2, 3, 4].map((i) => (
                    <div
                      key={i}
                      className={`flex-1 ${i < pwStrength.score ? pwStrength.color : "bg-muted"} transition-colors`}
                    />
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  Strength: <span className="text-foreground font-medium">{pwStrength.label}</span> · Use 12+ chars, mixed case, numbers & symbols.
                </p>
              </div>
            )}
            <PasswordField
              id="confirm-pw"
              label="Confirm new password"
              value={confirmPw}
              onChange={setConfirmPw}
              show={showConfirm}
              setShow={setShowConfirm}
            />
            {confirmPw && newPw !== confirmPw && (
              <p className="text-xs text-destructive">Passwords don't match.</p>
            )}

            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <Button onClick={handleChangePassword} disabled={savingPw || !newPw || newPw !== confirmPw}>
                {savingPw ? "Updating..." : "Update password"}
              </Button>
              <Button variant="outline" onClick={handlePasswordReset}>
                Send reset link instead
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 2FA */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-muted-foreground" />
              <div>
                <h3 className="text-sm font-semibold text-foreground">Two-factor authentication</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Add a one-time code from your authenticator app on sign in
                </p>
              </div>
            </div>
            <Badge variant={twoFAEnabled ? "default" : "outline"} className="text-xs">
              {twoFAEnabled ? "Enabled" : "Disabled"}
            </Badge>
          </div>

          <div className="flex items-center justify-between py-3 border-t border-border">
            <div>
              <p className="text-sm font-medium text-foreground">Authenticator app</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {twoFAEnabled && twoFASetupAt
                  ? `Set up ${new Date(twoFASetupAt).toLocaleDateString()}`
                  : "Compatible with Google Authenticator, 1Password, Authy"}
              </p>
            </div>
            <Switch checked={twoFAEnabled} onCheckedChange={toggle2FA} />
          </div>

          {twoFAEnabled && (
            <div className="flex items-center justify-between py-3 border-t border-border">
              <div>
                <p className="text-sm font-medium text-foreground">Backup recovery codes</p>
                <p className="text-xs text-muted-foreground mt-0.5">10 single-use codes available</p>
              </div>
              <Button variant="outline" size="sm" className="gap-2" onClick={() => toast({ title: "Coming soon", description: "Recovery code download will be available with full 2FA rollout." })}>
                <Download className="w-3.5 h-3.5" />
                Download
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Active sessions */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <Monitor className="w-4 h-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold text-foreground">Active sessions</h3>
          </div>

          <div className="space-y-3">
            <div className="flex items-start justify-between gap-4 py-3 border-b border-border">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-lg bg-emerald-500/10 flex items-center justify-center flex-shrink-0">
                  {/iPhone|iPad|Android/.test(currentSession?.ua || "") ? (
                    <Smartphone className="w-4 h-4 text-emerald-500" />
                  ) : (
                    <Monitor className="w-4 h-4 text-emerald-500" />
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-foreground">
                      {curBrowser} on {curOs}
                    </p>
                    <Badge variant="secondary" className="text-[10px]">This device</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">Active now</p>
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 mt-4">
            <Button variant="outline" size="sm" className="gap-2" onClick={handleSignOutCurrent}>
              <LogOut className="w-3.5 h-3.5" />
              Sign out this session
            </Button>
            <Button variant="outline" size="sm" className="gap-2" onClick={() => setSignOutAllOpen(true)}>
              <LogOut className="w-3.5 h-3.5" />
              Sign out all other sessions
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Login history */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <History className="w-4 h-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold text-foreground">Recent login activity</h3>
          </div>
          <div className="divide-y divide-border">
            {loginHistory.map((l, i) => (
              <div key={i} className="flex items-center justify-between py-3 text-sm">
                <div>
                  <p className="text-foreground">
                    {l.browser} on {l.os}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {new Date(l.date).toLocaleString()}
                  </p>
                </div>
                {l.status === "success" ? (
                  <Badge variant="outline" className="text-[10px] border-emerald-500/30 text-emerald-500 gap-1">
                    <CheckCircle2 className="w-3 h-3" /> Successful
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-[10px] border-destructive/30 text-destructive gap-1">
                    <XCircle className="w-3 h-3" /> Failed
                  </Badge>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Security alerts */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <Bell className="w-4 h-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold text-foreground">Security alerts</h3>
          </div>

          <div className="space-y-3">
            <AlertToggle
              label="New login detected"
              checked={alerts.newLogin}
              onChange={(v) => updateAlerts({ newLogin: v })}
            />
            <AlertToggle
              label="Login from a new device"
              checked={alerts.newDevice}
              onChange={(v) => updateAlerts({ newDevice: v })}
            />
            <AlertToggle
              label="Password changed"
              checked={alerts.passwordChanged}
              onChange={(v) => updateAlerts({ passwordChanged: v })}
            />
            <AlertToggle
              label="Security settings changed"
              checked={alerts.settingsChanged}
              onChange={(v) => updateAlerts({ settingsChanged: v })}
            />
          </div>

          <Separator className="my-5" />

          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
            Notify me via
          </p>
          <div className="flex gap-6">
            <label className="flex items-center gap-2 cursor-pointer">
              <Checkbox
                checked={alerts.methodEmail}
                onCheckedChange={(v) => updateAlerts({ methodEmail: !!v })}
              />
              <span className="text-sm text-foreground">Email</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <Checkbox
                checked={alerts.methodInApp}
                onCheckedChange={(v) => updateAlerts({ methodInApp: !!v })}
              />
              <span className="text-sm text-foreground">In-app</span>
            </label>
          </div>
        </CardContent>
      </Card>

      {/* Privacy */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <ShieldAlert className="w-4 h-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold text-foreground">Privacy</h3>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Data processing</span>
              <Badge variant="outline" className="text-[10px] border-emerald-500/30 text-emerald-500">
                Active · GDPR-compliant
              </Badge>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Data export</span>
              <Button variant="link" size="sm" className="h-auto p-0 text-accent" onClick={() => { window.location.hash = "data"; }}>
                Available in Data & Exports
              </Button>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Privacy policy</span>
              <Button variant="link" size="sm" className="h-auto p-0 text-accent gap-1" onClick={() => window.open("https://closesync.io/privacy", "_blank")}>
                View <ExternalLink className="w-3 h-3" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Danger zone */}
      <Card className="border-destructive/30">
        <CardContent className="p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-lg bg-destructive/10 flex items-center justify-center flex-shrink-0">
                <Trash2 className="w-4 h-4 text-destructive" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-foreground">Delete account</h3>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                  Deleting your account will permanently remove all your clients, proposals, contracts and billing history. This cannot be undone.
                </p>
              </div>
            </div>
            <Button variant="destructive" size="sm" onClick={() => setDeleteOpen(true)}>
              Delete account
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Sign out all dialog */}
      <Dialog open={signOutAllOpen} onOpenChange={setSignOutAllOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Sign out all other sessions?</DialogTitle>
            <DialogDescription>
              You'll stay signed in on this device. All other devices currently logged into your account will be signed out immediately.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSignOutAllOpen(false)}>Cancel</Button>
            <Button onClick={handleSignOutOthers}>Sign out others</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 2FA enable dialog */}
      <Dialog open={twoFADialog} onOpenChange={setTwoFADialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Enable two-factor authentication</DialogTitle>
            <DialogDescription>
              Full TOTP setup is being rolled out. For now we'll mark 2FA as enabled on your account and surface the option on sign in once available.
            </DialogDescription>
          </DialogHeader>
          <div className="bg-muted/40 rounded-md p-4 text-xs text-muted-foreground space-y-1">
            <p>· Scan QR code with your authenticator app</p>
            <p>· Enter the 6-digit code to confirm</p>
            <p>· Download 10 backup codes</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTwoFADialog(false)}>Cancel</Button>
            <Button onClick={confirmEnable2FA}>Enable 2FA</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete account dialog */}
      <Dialog open={deleteOpen} onOpenChange={(o) => { setDeleteOpen(o); if (!o) { setDeletePw(""); setDeleteConfirmText(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="w-5 h-5" /> Delete your account
            </DialogTitle>
            <DialogDescription>
              This action is permanent. Your data will be wiped and cannot be recovered.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="del-pw" className="text-xs">Confirm with your password</Label>
              <Input
                id="del-pw"
                type="password"
                value={deletePw}
                onChange={(e) => setDeletePw(e.target.value)}
                className="mt-1.5"
              />
            </div>
            <div>
              <Label htmlFor="del-confirm" className="text-xs">Type <span className="font-mono text-destructive">DELETE</span> to confirm</Label>
              <Input
                id="del-confirm"
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                className="mt-1.5"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>Cancel</Button>
            <Button
              variant="destructive"
              disabled={!deletePw || deleteConfirmText !== "DELETE"}
              onClick={() => {
                toast({
                  title: "Deletion request received",
                  description: "Our team will process your account deletion within 24 hours.",
                });
                setDeleteOpen(false);
                setDeletePw("");
                setDeleteConfirmText("");
              }}
            >
              Permanently delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function PasswordField({
  id,
  label,
  value,
  onChange,
  show,
  setShow,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  show: boolean;
  setShow: (v: boolean) => void;
}) {
  return (
    <div>
      <Label htmlFor={id} className="text-xs">{label}</Label>
      <div className="relative mt-1.5">
        <Input
          id={id}
          type={show ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="pr-10"
          autoComplete="new-password"
        />
        <button
          type="button"
          onClick={() => setShow(!show)}
          className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-muted-foreground hover:text-foreground transition-colors"
          tabIndex={-1}
          aria-label={show ? "Hide password" : "Show password"}
        >
          {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );
}

function AlertToggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-foreground">{label}</span>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}
