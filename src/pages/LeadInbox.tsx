import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Inbox, Loader2, UserPlus, Archive, FileDown } from "lucide-react";
import type { SmartField } from "@/lib/form-fields";
import LeadScoreBadge from "@/components/ai/LeadScoreBadge";

function parseFileValue(v: string): { path: string; name: string; size?: number; type?: string } | null {
  if (!v || typeof v !== "string") return null;
  const t = v.trim();
  if (!t.startsWith("{")) return null;
  try {
    const obj = JSON.parse(t);
    if (obj && typeof obj.path === "string" && typeof obj.name === "string") return obj;
  } catch { /* not a file */ }
  return null;
}

async function openSignedFile(path: string) {
  const { data: sess } = await supabase.auth.getSession();
  const token = sess.session?.access_token;
  if (!token) return;
  const { data, error } = await supabase.functions.invoke("form-upload-signed-read", {
    body: { path },
  });
  if (error || !(data as any)?.url) return;
  window.open((data as any).url, "_blank", "noopener");
}

interface Lead {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  company: string | null;
  responses: Record<string, string>;
  source: string;
  status: string;
  client_id: string | null;
  created_at: string;
  form_id: string | null;
}

interface FormLite { id: string; name: string; fields: SmartField[] }

const STATUS_TONE: Record<string, string> = {
  new: "bg-blue-500/15 text-blue-300 border border-blue-500/30",
  qualified: "bg-purple/15 text-purple border border-purple/30",
  converted: "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30",
  archived: "bg-muted/40 text-muted-foreground border border-border",
};

export default function LeadInbox() {
  const { toast } = useToast();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [forms, setForms] = useState<Record<string, FormLite>>({});
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Lead | null>(null);

  const load = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const [{ data: ldata }, { data: fdata }] = await Promise.all([
      supabase.from("leads" as any).select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(200),
      supabase.from("lead_forms" as any).select("id, name, fields").eq("user_id", user.id),
    ]);
    setLeads((ldata as any) || []);
    const fm: Record<string, FormLite> = {};
    ((fdata as any) || []).forEach((f: FormLite) => { fm[f.id] = f; });
    setForms(fm);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const convert = async (lead: Lead) => {
    const { data, error } = await supabase.rpc("lead_convert_to_client" as any, { _lead_id: lead.id });
    if (error) { toast({ title: "Couldn't convert", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Converted to client" });
    setSelected(null);
    load();
    if (data) window.location.assign(`/dashboard/clients/${data}`);
  };

  const archive = async (lead: Lead) => {
    await supabase.from("leads" as any).update({ status: "archived" }).eq("id", lead.id);
    toast({ title: "Archived" });
    setSelected(null);
    load();
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Inbox className="w-6 h-6 text-purple" /> Lead Inbox
            </h1>
            <p className="text-sm text-muted-foreground mt-1">Submissions from your lead forms. Convert qualified ones into clients.</p>
          </div>
          <Button asChild variant="outline"><Link to="/dashboard/lead-forms">Manage forms</Link></Button>
        </div>

        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
        ) : leads.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-card/30 p-12 text-center">
            <Inbox className="w-10 h-10 mx-auto text-muted-foreground/60 mb-3" />
            <h2 className="text-base font-semibold text-foreground">No leads yet</h2>
            <p className="text-sm text-muted-foreground mt-1 mb-4">Share a lead form to start collecting submissions.</p>
            <Button asChild><Link to="/dashboard/lead-forms">Create a form</Link></Button>
          </div>
        ) : (
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/30 text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="text-left px-4 py-2.5 font-medium">Name</th>
                  <th className="text-left px-4 py-2.5 font-medium hidden md:table-cell">Email</th>
                  <th className="text-left px-4 py-2.5 font-medium hidden lg:table-cell">Form</th>
                  <th className="text-left px-4 py-2.5 font-medium">Status</th>
                  <th className="text-left px-4 py-2.5 font-medium hidden md:table-cell">Score</th>
                  <th className="text-left px-4 py-2.5 font-medium hidden sm:table-cell">Received</th>
                </tr>
              </thead>
              <tbody>
                {leads.map((l) => (
                  <tr key={l.id} className="border-t border-border hover:bg-muted/20 cursor-pointer" onClick={() => setSelected(l)}>
                    <td className="px-4 py-3 font-medium text-foreground">{l.name || <span className="text-muted-foreground">Anonymous</span>}</td>
                    <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">{l.email || "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground hidden lg:table-cell">{l.form_id ? forms[l.form_id]?.name || "Form" : "Manual"}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] uppercase font-semibold ${STATUS_TONE[l.status] || STATUS_TONE.new}`}>
                        {l.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell" onClick={(e) => e.stopPropagation()}>
                      <LeadScoreBadge leadId={l.id} enabled={l.status !== "archived" && l.status !== "converted"} />
                    </td>
                    <td className="px-4 py-3 text-muted-foreground hidden sm:table-cell text-xs">
                      {new Date(l.created_at).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Sheet open={!!selected} onOpenChange={(v) => !v && setSelected(null)}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          {selected && (
            <>
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2 flex-wrap">
                  <span>{selected.name || "Anonymous lead"}</span>
                  <LeadScoreBadge leadId={selected.id} size="md" enabled={selected.status !== "archived" && selected.status !== "converted"} />
                </SheetTitle>
                <SheetDescription>
                  {selected.form_id ? `via ${forms[selected.form_id]?.name || "form"}` : "Manual entry"} · {new Date(selected.created_at).toLocaleString()}
                </SheetDescription>
              </SheetHeader>

              <div className="mt-6 space-y-4">
                {(selected.email || selected.phone || selected.company) && (
                  <div className="rounded-lg border border-border bg-muted/20 p-3 text-sm space-y-1">
                    {selected.email && <div><span className="text-muted-foreground">Email:</span> <a href={`mailto:${selected.email}`} className="text-foreground hover:text-purple">{selected.email}</a></div>}
                    {selected.phone && <div><span className="text-muted-foreground">Phone:</span> <span className="text-foreground">{selected.phone}</span></div>}
                    {selected.company && <div><span className="text-muted-foreground">Company:</span> <span className="text-foreground">{selected.company}</span></div>}
                  </div>
                )}
                <div>
                  <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-2">Responses</p>
                  <div className="space-y-2">
                    {(() => {
                      const labelMap: Record<string, string> = {};
                      const fields = selected.form_id ? forms[selected.form_id]?.fields || [] : [];
                      fields.forEach((f) => { labelMap[f.id] = f.label; });
                      const entries = Object.entries(selected.responses || {});
                      if (entries.length === 0) {
                        return <p className="text-xs text-muted-foreground">No additional answers.</p>;
                      }
                      return entries.map(([k, v]) => {
                        const file = parseFileValue(String(v));
                        return (
                          <div key={k} className="rounded-md border border-border bg-card p-3">
                            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{labelMap[k] || k}</div>
                            {file ? (
                              <button
                                onClick={() => openSignedFile(file.path)}
                                className="mt-1 inline-flex items-center gap-2 text-sm text-purple hover:underline"
                              >
                                <FileDown className="w-3.5 h-3.5" />
                                {file.name}
                                {file.size ? <span className="text-muted-foreground text-xs">· {(file.size / 1024).toFixed(0)} KB</span> : null}
                              </button>
                            ) : (
                              <div className="text-sm text-foreground mt-0.5 whitespace-pre-wrap">{String(v)}</div>
                            )}
                          </div>
                        );
                      });
                    })()}
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 pt-3 border-t border-border">
                  {selected.client_id ? (
                    <Button asChild className="gap-2"><Link to={`/dashboard/clients/${selected.client_id}`}><UserPlus className="w-4 h-4" />View client</Link></Button>
                  ) : (
                    <Button className="gap-2" onClick={() => convert(selected)}><UserPlus className="w-4 h-4" />Convert to client</Button>
                  )}
                  {selected.status !== "archived" && (
                    <Button variant="outline" className="gap-2" onClick={() => archive(selected)}><Archive className="w-4 h-4" />Archive</Button>
                  )}
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </DashboardLayout>
  );
}
