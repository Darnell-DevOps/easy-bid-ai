import { useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  ChevronDown,
  ChevronUp,
  ClipboardList,
  Copy,
  FileUp,
  MoreVertical,
  Pencil,
  Plus,
  RotateCcw,
  Star,
  Trash2,
  Users,
  Calendar,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  loadOnboardingTemplateRows,
  mergeOnboardingTemplates,
  templateToOnboardingForm,
  type MergedOnboardingTemplate,
  type OnboardingTemplateRow,
} from "@/lib/onboarding-templates";
import OnboardingTemplateEditorDialog from "@/components/templates/OnboardingTemplateEditorDialog";
import CreateOnboardingFromTemplateDialog from "@/components/templates/CreateOnboardingFromTemplateDialog";

export default function OnboardingTemplatesGallery() {
  const { toast } = useToast();
  const [rows, setRows] = useState<OnboardingTemplateRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [collapsed, setCollapsed] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorTarget, setEditorTarget] = useState<MergedOnboardingTemplate | undefined>();
  const [editorInitial, setEditorInitial] = useState<any>(undefined);
  const [forceCreate, setForceCreate] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<MergedOnboardingTemplate | null>(null);
  const [createTarget, setCreateTarget] = useState<MergedOnboardingTemplate | null>(null);

  const reload = async () => {
    try {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) return;
      const r = await loadOnboardingTemplateRows(auth.user.id);
      setRows(r);
    } catch (e: any) {
      toast({ title: "Failed to load templates", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { reload(); }, []);

  const merged = useMemo(() => mergeOnboardingTemplates(rows), [rows]);
  const builtins = merged.filter((m) => m.source === "builtin" || m.source === "builtin_override");
  const customs = merged.filter((m) => m.source === "custom" || m.source === "from_form");
  const defaultTpl = merged.find((m) => m.isDefault);

  const handleEdit = (t: MergedOnboardingTemplate) => {
    setEditorTarget(t);
    setEditorInitial(undefined);
    setForceCreate(false);
    setEditorOpen(true);
  };
  const handleDuplicate = (t: MergedOnboardingTemplate) => {
    setEditorTarget(t);
    setEditorInitial({ ...templateToOnboardingForm(t), name: `${t.name} (copy)` });
    setForceCreate(true);
    setEditorOpen(true);
  };
  const handleCreate = () => {
    setEditorTarget(undefined);
    setEditorInitial(undefined);
    setForceCreate(false);
    setEditorOpen(true);
  };
  const handleResetBuiltin = async (t: MergedOnboardingTemplate) => {
    if (!t.rowId) return;
    const { error } = await supabase.from("onboarding_templates" as any).delete().eq("id", t.rowId);
    if (error) {
      toast({ title: "Failed", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Reset to default" });
    reload();
  };
  const handleDelete = async () => {
    if (!deleteTarget?.rowId) return;
    const { error } = await supabase
      .from("onboarding_templates" as any)
      .delete()
      .eq("id", deleteTarget.rowId);
    if (error) {
      toast({ title: "Failed", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Template deleted" });
    setDeleteTarget(null);
    reload();
  };
  const handleSetDefault = async (t: MergedOnboardingTemplate) => {
    try {
      const { data: auth } = await supabase.auth.getUser();
      const userId = auth.user?.id;
      if (!userId) throw new Error("Not signed in");
      await supabase
        .from("onboarding_templates" as any)
        .update({ is_default: false })
        .eq("user_id", userId)
        .eq("is_default", true);
      if (t.rowId) {
        await supabase
          .from("onboarding_templates" as any)
          .update({ is_default: true })
          .eq("id", t.rowId);
      } else {
        await supabase.from("onboarding_templates" as any).insert({
          user_id: userId,
          name: t.name,
          description: t.description,
          service_type: t.service_type,
          best_for: t.best_for,
          intro: t.intro,
          fields: t.fields,
          file_requests: t.file_requests,
          deadlines: t.deadlines,
          notes: t.notes,
          icon: t.iconKey,
          accent: t.accent,
          source: "builtin_override",
          builtin_id: t.id,
          is_default: true,
        });
      }
      toast({ title: "Default template set" });
      reload();
    } catch (e: any) {
      toast({ title: "Failed", description: e.message, variant: "destructive" });
    }
  };

  return (
    <Card>
      <CardContent className="p-4 sm:p-5 space-y-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <ClipboardList className="w-4 h-4 text-accent" />
            <h2 className="text-sm font-semibold text-foreground">Onboarding templates</h2>
            {defaultTpl && (
              <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30 text-[10px] gap-1">
                <Star className="w-2.5 h-2.5 fill-current" /> Default: {defaultTpl.name}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={handleCreate} className="gap-1.5 h-8">
              <Plus className="w-3.5 h-3.5" /> Custom
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setCollapsed((c) => !c)} className="h-8">
              {collapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
            </Button>
          </div>
        </div>

        {!collapsed && (
          <>
            {loading ? (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {[0, 1, 2].map((i) => (
                  <Card key={i} className="animate-pulse"><CardContent className="p-4 h-28" /></Card>
                ))}
              </div>
            ) : (
              <Grid
                items={builtins}
                onUse={(t) => setCreateTarget(t)}
                onEdit={handleEdit}
                onDuplicate={handleDuplicate}
                onSetDefault={handleSetDefault}
                onResetBuiltin={handleResetBuiltin}
                onDelete={(t) => setDeleteTarget(t)}
              />
            )}

            {customs.length > 0 && (
              <>
                <div className="text-[11px] uppercase tracking-wider text-muted-foreground pt-1">
                  Your templates
                </div>
                <Grid
                  items={customs}
                  onUse={(t) => setCreateTarget(t)}
                  onEdit={handleEdit}
                  onDuplicate={handleDuplicate}
                  onSetDefault={handleSetDefault}
                  onDelete={(t) => setDeleteTarget(t)}
                />
              </>
            )}
          </>
        )}
      </CardContent>

      <OnboardingTemplateEditorDialog
        open={editorOpen}
        onOpenChange={setEditorOpen}
        template={editorTarget}
        initial={editorInitial}
        forceCreate={forceCreate}
        onSaved={reload}
      />

      <CreateOnboardingFromTemplateDialog
        open={!!createTarget}
        onOpenChange={(o) => !o && setCreateTarget(null)}
        template={createTarget}
      />

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this template?</AlertDialogTitle>
            <AlertDialogDescription>
              "{deleteTarget?.name}" will be permanently removed. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

interface GridProps {
  items: MergedOnboardingTemplate[];
  onUse: (t: MergedOnboardingTemplate) => void;
  onEdit: (t: MergedOnboardingTemplate) => void;
  onDuplicate: (t: MergedOnboardingTemplate) => void;
  onSetDefault: (t: MergedOnboardingTemplate) => void;
  onResetBuiltin?: (t: MergedOnboardingTemplate) => void;
  onDelete: (t: MergedOnboardingTemplate) => void;
}

function Grid({ items, onUse, onEdit, onDuplicate, onSetDefault, onResetBuiltin, onDelete }: GridProps) {
  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {items.map((t) => {
        const Icon = t.icon;
        const isCustomized = t.source === "builtin_override";
        const isCustom = t.source === "custom" || t.source === "from_form";
        return (
          <Card
            key={t.rowId || t.id}
            role="button"
            tabIndex={0}
            onClick={() => onUse(t)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onUse(t);
              }
            }}
            className="group relative cursor-pointer hover:shadow-lg hover:border-accent/40 hover:-translate-y-0.5 transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            <div className="absolute top-2 right-2 z-10 flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
              {t.isDefault && (
                <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30 text-[10px] px-1.5 py-0 gap-1 h-5">
                  <Star className="w-2.5 h-2.5 fill-current" />
                </Badge>
              )}
              {isCustomized && (
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-5">Customized</Badge>
              )}
              {isCustom && (
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5">Custom</Badge>
              )}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-6 w-6">
                    <MoreVertical className="w-3.5 h-3.5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => onEdit(t)} className="gap-2">
                    <Pencil className="w-4 h-4" /> {t.source === "builtin" ? "Customize" : "Edit"}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onDuplicate(t)} className="gap-2">
                    <Copy className="w-4 h-4" /> Duplicate
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onSetDefault(t)} disabled={t.isDefault} className="gap-2">
                    <Star className="w-4 h-4" /> Set as default
                  </DropdownMenuItem>
                  {isCustomized && onResetBuiltin && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => onResetBuiltin(t)} className="gap-2">
                        <RotateCcw className="w-4 h-4" /> Reset to default
                      </DropdownMenuItem>
                    </>
                  )}
                  {isCustom && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() => onDelete(t)}
                        className="gap-2 text-destructive focus:text-destructive"
                      >
                        <Trash2 className="w-4 h-4" /> Delete
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            <CardContent className="p-4 pr-12">
              <div className="flex items-start gap-3">
                <div className={`w-9 h-9 rounded-lg bg-gradient-to-br ${t.accent} flex items-center justify-center flex-shrink-0 shadow-sm`}>
                  <Icon className="w-4 h-4 text-white" />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-sm font-semibold text-foreground leading-tight">{t.name}</h3>
                  <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed line-clamp-2">{t.description}</p>
                  <div className="mt-2 flex items-center gap-3 flex-wrap text-[10px] text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <ClipboardList className="w-3 h-3" /> {t.fields.length} questions
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <FileUp className="w-3 h-3" /> {t.file_requests.length} files
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Calendar className="w-3 h-3" /> {t.deadlines.length} deadlines
                    </span>
                  </div>
                  {t.best_for && (
                    <div className="mt-1.5 inline-flex items-center gap-1 text-[10px] text-muted-foreground">
                      <Users className="w-3 h-3" /> {t.best_for}
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
