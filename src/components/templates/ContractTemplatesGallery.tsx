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
  Copy,
  MoreVertical,
  Pencil,
  Plus,
  RotateCcw,
  Sparkles,
  Star,
  Trash2,
  Users,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  loadContractTemplateRows,
  mergeContractTemplates,
  templateToContractForm,
  type ContractTemplateRow,
  type MergedContractTemplate,
} from "@/lib/contract-templates";
import ContractTemplateEditorDialog from "@/components/templates/ContractTemplateEditorDialog";

interface Props {
  onUseTemplate: (t: MergedContractTemplate) => void;
}

export default function ContractTemplatesGallery({ onUseTemplate }: Props) {
  const { toast } = useToast();
  const [rows, setRows] = useState<ContractTemplateRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [collapsed, setCollapsed] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorTarget, setEditorTarget] = useState<MergedContractTemplate | undefined>();
  const [editorInitial, setEditorInitial] = useState<any>(undefined);
  const [forceCreate, setForceCreate] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<MergedContractTemplate | null>(null);

  const reload = async () => {
    try {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) return;
      const r = await loadContractTemplateRows(auth.user.id);
      setRows(r);
    } catch (e: any) {
      toast({ title: "Failed to load templates", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    reload();
  }, []);

  const merged = useMemo(() => mergeContractTemplates(rows), [rows]);
  const builtins = merged.filter((m) => m.source === "builtin" || m.source === "builtin_override");
  const customs = merged.filter((m) => m.source === "custom" || m.source === "from_contract");
  const defaultTpl = merged.find((m) => m.isDefault);

  const handleEdit = (t: MergedContractTemplate) => {
    setEditorTarget(t);
    setEditorInitial(undefined);
    setForceCreate(false);
    setEditorOpen(true);
  };
  const handleDuplicate = (t: MergedContractTemplate) => {
    setEditorTarget(t);
    setEditorInitial({ ...templateToContractForm(t), name: `${t.name} (copy)` });
    setForceCreate(true);
    setEditorOpen(true);
  };
  const handleCreate = () => {
    setEditorTarget(undefined);
    setEditorInitial(undefined);
    setForceCreate(false);
    setEditorOpen(true);
  };
  const handleResetBuiltin = async (t: MergedContractTemplate) => {
    if (!t.rowId) return;
    const { error } = await supabase.from("contract_templates").delete().eq("id", t.rowId);
    if (error) {
      toast({ title: "Failed", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Reset to default" });
    reload();
  };
  const handleDelete = async () => {
    if (!deleteTarget?.rowId) return;
    const { error } = await supabase.from("contract_templates").delete().eq("id", deleteTarget.rowId);
    if (error) {
      toast({ title: "Failed", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Template deleted" });
    setDeleteTarget(null);
    reload();
  };
  const handleSetDefault = async (t: MergedContractTemplate) => {
    try {
      const { data: auth } = await supabase.auth.getUser();
      const userId = auth.user?.id;
      if (!userId) throw new Error("Not signed in");
      await supabase
        .from("contract_templates")
        .update({ is_default: false })
        .eq("user_id", userId)
        .eq("is_default", true);
      if (t.rowId) {
        await supabase.from("contract_templates").update({ is_default: true }).eq("id", t.rowId);
      } else {
        await supabase.from("contract_templates").insert({
          user_id: userId,
          name: t.name,
          description: t.description,
          contract_type: t.contract_type,
          service_type: t.service_type,
          best_for: t.best_for,
          default_scope: t.default_scope,
          default_timeline: t.default_timeline,
          default_budget: t.default_budget,
          default_payment_terms: t.default_payment_terms,
          extra_clauses: t.extra_clauses,
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
            <Sparkles className="w-4 h-4 text-accent" />
            <h2 className="text-sm font-semibold text-foreground">Contract templates</h2>
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
                  <Card key={i} className="animate-pulse"><CardContent className="p-4 h-24" /></Card>
                ))}
              </div>
            ) : (
              <Grid
                items={builtins}
                onUse={onUseTemplate}
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
                  onUse={onUseTemplate}
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

      <ContractTemplateEditorDialog
        open={editorOpen}
        onOpenChange={setEditorOpen}
        template={editorTarget}
        initial={editorInitial}
        forceCreate={forceCreate}
        onSaved={reload}
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
  items: MergedContractTemplate[];
  onUse: (t: MergedContractTemplate) => void;
  onEdit: (t: MergedContractTemplate) => void;
  onDuplicate: (t: MergedContractTemplate) => void;
  onSetDefault: (t: MergedContractTemplate) => void;
  onResetBuiltin?: (t: MergedContractTemplate) => void;
  onDelete: (t: MergedContractTemplate) => void;
}

function Grid({ items, onUse, onEdit, onDuplicate, onSetDefault, onResetBuiltin, onDelete }: GridProps) {
  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {items.map((t) => {
        const Icon = t.icon;
        const isCustomized = t.source === "builtin_override";
        const isCustom = t.source === "custom" || t.source === "from_contract";
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
                      <DropdownMenuItem onClick={() => onDelete(t)} className="gap-2 text-destructive focus:text-destructive">
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
                <div className="min-w-0">
                  <h3 className="text-sm font-semibold text-foreground leading-tight">{t.name}</h3>
                  <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed line-clamp-2">{t.description}</p>
                  {t.best_for && (
                    <div className="mt-2 inline-flex items-center gap-1 text-[10px] text-muted-foreground">
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
