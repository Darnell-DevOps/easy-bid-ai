import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import DashboardLayout from "@/components/DashboardLayout";
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
  Globe,
  Share2,
  Palette,
  TrendingUp,
  ArrowRight,
  Sparkles,
  Clock,
  Wallet,
  Users,
  ShieldCheck,
  MoreVertical,
  Pencil,
  Copy,
  Trash2,
  RotateCcw,
  Plus,
  Star,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import TemplateEditorDialog from "@/components/templates/TemplateEditorDialog";
import ContractTemplatesGallery from "@/components/templates/ContractTemplatesGallery";
import RetainerTemplatesGallery from "@/components/templates/RetainerTemplatesGallery";
import type { MergedContractTemplate } from "@/lib/contract-templates";
import type { MergedRetainerTemplate } from "@/lib/retainer-templates";
import {
  loadProposalTemplateRows,
  mergeTemplates,
  type MergedTemplate,
  type ProposalTemplateRow,
  templateToForm,
} from "@/lib/proposal-templates";

export interface TemplateData {
  id: string;
  name: string;
  description: string;
  icon: React.ElementType;
  accent: string;
  serviceType: string;
  bestFor: string;
  dealSize: string;
  timeSaved: string;
  popular?: boolean;
  tone?: "professional" | "persuasive" | "concise";
  defaultGoals?: string;
  defaultDeliverables?: string;
  prefill: {
    project_scope: string;
    budget: string;
    timeline: string;
    notes: string;
  };
}

export const templates: TemplateData[] = [
  {
    id: "website-design",
    name: "Website Design Proposal",
    description:
      "A complete website design & development proposal covering UX, UI, responsive build, and launch support.",
    icon: Globe,
    accent: "from-accent to-purple",
    serviceType: "Web Design & Development",
    bestFor: "Freelancers & Studios",
    dealSize: "£1K–£5K",
    timeSaved: "~45 min",
    popular: true,
    tone: "persuasive",
    defaultGoals:
      "A modern, conversion-focused website that establishes credibility, attracts qualified leads, and drives measurable business growth within the first 90 days.",
    defaultDeliverables:
      "UX audit & sitemap, custom UI design for 5 core pages, mobile-responsive build, on-page SEO setup, analytics integration, browser/device QA, and post-launch support.",
    prefill: {
      project_scope:
        "Full website redesign including UX audit, custom UI design for key pages (Home, About, Services, Contact), mobile-responsive development, SEO optimisation, and browser/device testing.",
      budget: "£1,200",
      timeline: "2 weeks",
      notes: "Includes one round of revisions per phase. Content to be provided by the client.",
    },
  },
  {
    id: "social-media",
    name: "Social Media Management",
    description:
      "Monthly social media strategy, content creation, scheduling, community management, and performance reporting.",
    icon: Share2,
    accent: "from-blue-500 to-cyan-500",
    serviceType: "Social Media Management",
    bestFor: "Agencies & Solo Marketers",
    dealSize: "£500–£2K/mo",
    timeSaved: "~30 min",
    tone: "professional",
    defaultGoals:
      "Build a consistent, engaged audience that drives brand awareness, qualified inbound enquiries, and measurable ROI from organic social channels.",
    defaultDeliverables:
      "Monthly content calendar, 12 branded posts (graphics + copy), 4 short-form video concepts, community management (Mon–Fri), monthly analytics report with insights.",
    prefill: {
      project_scope:
        "Monthly social media management across Instagram, LinkedIn, and TikTok. Includes content strategy, 12 posts per month, community engagement, and a monthly analytics report.",
      budget: "£800/month",
      timeline: "3 months",
      notes: "First month includes brand audit and content pillar development.",
    },
  },
  {
    id: "branding",
    name: "Branding Package",
    description:
      "End-to-end brand identity design including logo, colour palette, typography, and brand guidelines document.",
    icon: Palette,
    accent: "from-pink-500 to-rose-500",
    serviceType: "Brand Identity",
    bestFor: "Designers & Studios",
    dealSize: "£1K–£3K",
    timeSaved: "~40 min",
    tone: "persuasive",
    defaultGoals:
      "A distinctive, memorable brand identity that builds instant trust, attracts the right clients, and positions the business as a category leader.",
    defaultDeliverables:
      "Discovery workshop, 3 logo concepts (2 revision rounds), full colour palette, typography system, brand guidelines PDF, social media avatar/banner kit, and brand asset pack.",
    prefill: {
      project_scope:
        "Complete brand identity package: logo design (3 concepts, 2 revision rounds), colour palette, typography system, brand guidelines PDF, and social media avatar/banner kit.",
      budget: "£1,500",
      timeline: "3 weeks",
      notes: "Includes a discovery workshop to align on brand values and positioning.",
    },
  },
  {
    id: "marketing-strategy",
    name: "Marketing Strategy",
    description:
      "A data-driven marketing strategy covering audience research, channel selection, campaign planning, and KPIs.",
    icon: TrendingUp,
    accent: "from-emerald-500 to-teal-500",
    serviceType: "Marketing Strategy",
    bestFor: "Consultants & Agencies",
    dealSize: "£2K–£8K",
    timeSaved: "~60 min",
    tone: "professional",
    defaultGoals:
      "A clear, data-backed marketing roadmap that aligns spend with revenue goals, reduces wasted budget, and unlocks measurable growth across priority channels.",
    defaultDeliverables:
      "Competitor & market analysis, audience segmentation, channel recommendations (paid + organic), 90-day campaign roadmap, KPI framework, budget allocation plan, executive summary deck.",
    prefill: {
      project_scope:
        "Comprehensive marketing strategy: competitor analysis, audience segmentation, channel recommendations (paid & organic), 90-day campaign roadmap, KPI framework, and budget allocation plan.",
      budget: "£2,000",
      timeline: "2 weeks",
      notes: "Deliverable is a full strategy document with actionable recommendations.",
    },
  },
];

export default function Templates() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [rows, setRows] = useState<ProposalTemplateRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorTarget, setEditorTarget] = useState<MergedTemplate | undefined>();
  const [editorInitial, setEditorInitial] = useState<any>(undefined);
  const [forceCreate, setForceCreate] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<MergedTemplate | null>(null);

  const reload = async () => {
    try {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) return;
      const r = await loadProposalTemplateRows(auth.user.id);
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

  const merged = useMemo(() => mergeTemplates(rows), [rows]);
  const defaultTpl = merged.find((m) => m.isDefault);

  const handleUseTemplate = (t: MergedTemplate) => {
    navigate("/dashboard/new", { state: { template: t, autoGenerate: true } });
  };

  const handleEdit = (t: MergedTemplate) => {
    setEditorTarget(t);
    setEditorInitial(undefined);
    setForceCreate(false);
    setEditorOpen(true);
  };

  const handleDuplicate = (t: MergedTemplate) => {
    setEditorTarget(t);
    setEditorInitial({ ...templateToForm(t), name: `${t.name} (copy)` });
    setForceCreate(true);
    setEditorOpen(true);
  };

  const handleCreate = () => {
    setEditorTarget(undefined);
    setEditorInitial(undefined);
    setForceCreate(false);
    setEditorOpen(true);
  };

  const handleResetBuiltin = async (t: MergedTemplate) => {
    if (!t.rowId) return;
    const { error } = await supabase.from("proposal_templates").delete().eq("id", t.rowId);
    if (error) {
      toast({ title: "Failed", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Reset to default" });
    reload();
  };

  const handleDelete = async () => {
    if (!deleteTarget?.rowId) return;
    const { error } = await supabase.from("proposal_templates").delete().eq("id", deleteTarget.rowId);
    if (error) {
      toast({ title: "Failed", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Template deleted" });
    setDeleteTarget(null);
    reload();
  };

  const handleSetDefault = async (t: MergedTemplate) => {
    try {
      const { data: auth } = await supabase.auth.getUser();
      const userId = auth.user?.id;
      if (!userId) throw new Error("Not signed in");

      // Clear current default
      await supabase
        .from("proposal_templates")
        .update({ is_default: false })
        .eq("user_id", userId)
        .eq("is_default", true);

      if (t.rowId) {
        await supabase.from("proposal_templates").update({ is_default: true }).eq("id", t.rowId);
      } else {
        // Built-in without a row yet — create an override row carrying the default flag.
        await supabase.from("proposal_templates").insert({
          user_id: userId,
          name: t.name,
          description: t.description,
          service_type: t.serviceType,
          best_for: t.bestFor,
          deal_size: t.dealSize,
          tone: t.tone || "professional",
          default_goals: t.defaultGoals || null,
          default_deliverables: t.defaultDeliverables || null,
          project_scope: t.prefill.project_scope,
          budget: t.prefill.budget,
          timeline: t.prefill.timeline,
          notes: t.prefill.notes,
          icon: "sparkles",
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

  const handleAIGenerate = () => navigate("/dashboard/new");

  const builtinList = merged.filter((m) => m.source === "builtin" || m.source === "builtin_override");
  const customList = merged.filter((m) => m.source === "custom" || m.source === "from_proposal");

  const handleUseContractTemplate = (t: MergedContractTemplate) => {
    navigate("/dashboard/contracts", { state: { contractTemplate: t } });
  };

  const handleUseRetainerTemplate = (t: MergedRetainerTemplate) => {
    navigate("/dashboard/retainers/new", { state: { retainerTemplate: t } });
  };

  return (
    <DashboardLayout>
      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight">
          Templates
        </h1>
        <p className="text-sm text-muted-foreground mt-2 max-w-2xl">
          Reusable, high-converting templates for every part of your client workflow.
        </p>
      </div>

      <Tabs defaultValue="proposals" className="w-full">
        <TabsList className="mb-6">
          <TabsTrigger value="proposals">Proposals</TabsTrigger>
          <TabsTrigger value="contracts">Contracts</TabsTrigger>
          <TabsTrigger value="retainers">Retainers</TabsTrigger>
        </TabsList>

        <TabsContent value="proposals" className="mt-0 space-y-0">
          <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
            <p className="text-xs text-muted-foreground/80 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" />
              Create a ready-to-send proposal in under 60 seconds.
            </p>
            <Button variant="outline" onClick={handleCreate} className="gap-2">
              <Plus className="w-4 h-4" /> New custom template
            </Button>
          </div>

          <Card className="mb-6 border-accent/30 bg-gradient-to-br from-accent/5 via-purple/5 to-transparent overflow-hidden relative">
            <CardContent className="p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center gap-4">
              <div className="flex items-start gap-3 flex-1 min-w-0">
                <div className="w-11 h-11 rounded-lg bg-gradient-to-br from-accent to-purple flex items-center justify-center flex-shrink-0 shadow-md">
                  <Sparkles className="w-5 h-5 text-white" />
                </div>
                <div className="min-w-0">
                  <h2 className="font-semibold text-foreground text-base leading-tight">
                    Generate Proposal with AI
                  </h2>
                  <p className="text-xs text-muted-foreground mt-1">
                    Let AI pick the best structure for you
                  </p>
                </div>
              </div>
              <Button
                onClick={handleAIGenerate}
                className="w-full sm:w-auto gap-2 bg-gradient-to-r from-accent to-purple text-white hover:brightness-110"
              >
                <Sparkles className="w-4 h-4" />
                Generate with AI
                <ArrowRight className="w-3.5 h-3.5" />
              </Button>
            </CardContent>
          </Card>

          <div className="flex items-center gap-2 mb-4 text-xs text-muted-foreground">
            <ShieldCheck className="w-3.5 h-3.5 text-accent" />
            <span>Based on proven client-winning proposal structures</span>
            {defaultTpl && (
              <span className="ml-auto inline-flex items-center gap-1">
                <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                Default: {defaultTpl.name}
              </span>
            )}
          </div>

          <h2 className="text-sm font-semibold text-foreground mb-3">Built-in templates</h2>
          <TemplateGrid
            items={builtinList}
            loading={loading}
            onUse={handleUseTemplate}
            onEdit={handleEdit}
            onDuplicate={handleDuplicate}
            onSetDefault={handleSetDefault}
            onResetBuiltin={handleResetBuiltin}
            onDelete={(t) => setDeleteTarget(t)}
          />

          <div className="mt-8">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-foreground">Your templates</h2>
              <Button size="sm" variant="ghost" onClick={handleCreate} className="gap-1.5 text-xs">
                <Plus className="w-3.5 h-3.5" /> New
              </Button>
            </div>
            {customList.length === 0 ? (
              <Card className="border-dashed">
                <CardContent className="py-10 text-center">
                  <p className="text-sm text-muted-foreground mb-3">No custom templates yet.</p>
                  <Button variant="outline" onClick={handleCreate} className="gap-2">
                    <Plus className="w-4 h-4" /> Create your first custom template
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <TemplateGrid
                items={customList}
                loading={false}
                onUse={handleUseTemplate}
                onEdit={handleEdit}
                onDuplicate={handleDuplicate}
                onSetDefault={handleSetDefault}
                onDelete={(t) => setDeleteTarget(t)}
              />
            )}
          </div>
        </TabsContent>

        <TabsContent value="contracts" className="mt-0">
          <ContractTemplatesGallery onUseTemplate={handleUseContractTemplate} />
        </TabsContent>
      </Tabs>

      <TemplateEditorDialog
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
    </DashboardLayout>
  );
}

interface GridProps {
  items: MergedTemplate[];
  loading: boolean;
  onUse: (t: MergedTemplate) => void;
  onEdit: (t: MergedTemplate) => void;
  onDuplicate: (t: MergedTemplate) => void;
  onSetDefault: (t: MergedTemplate) => void;
  onResetBuiltin?: (t: MergedTemplate) => void;
  onDelete: (t: MergedTemplate) => void;
}

function TemplateGrid({
  items,
  loading,
  onUse,
  onEdit,
  onDuplicate,
  onSetDefault,
  onResetBuiltin,
  onDelete,
}: GridProps) {
  if (loading) {
    return (
      <div className="grid sm:grid-cols-2 gap-4">
        {[0, 1].map((i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="p-6 h-40" />
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid sm:grid-cols-2 gap-4">
      {items.map((t) => {
        const Icon = t.icon;
        const isCustomized = t.source === "builtin_override";
        const isCustom = t.source === "custom" || t.source === "from_proposal";
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
            className="group relative cursor-pointer hover:shadow-xl hover:border-accent/40 hover:-translate-y-1 transition-all duration-300 flex flex-col focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            <div className="absolute top-3 right-3 z-10 flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
              {t.isDefault && (
                <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30 text-[10px] px-2 py-0.5 gap-1">
                  <Star className="w-2.5 h-2.5 fill-current" /> Default
                </Badge>
              )}
              {isCustomized && (
                <Badge variant="secondary" className="text-[10px] px-2 py-0.5">Customized</Badge>
              )}
              {isCustom && (
                <Badge variant="outline" className="text-[10px] px-2 py-0.5">Custom</Badge>
              )}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-7 w-7">
                    <MoreVertical className="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => onEdit(t)} className="gap-2">
                    <Pencil className="w-4 h-4" /> {t.source === "builtin" ? "Customize" : "Edit"}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onDuplicate(t)} className="gap-2">
                    <Copy className="w-4 h-4" /> Duplicate
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onSetDefault(t)} className="gap-2" disabled={t.isDefault}>
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

            <CardContent className="p-5 sm:p-6 flex flex-col h-full">
              <div className="flex items-start gap-4 mb-4 pr-24">
                <div
                  className={`w-11 h-11 rounded-lg bg-gradient-to-br ${t.accent} flex items-center justify-center flex-shrink-0 opacity-90 group-hover:opacity-100 transition-opacity shadow-md`}
                >
                  <Icon className="w-5 h-5 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-foreground text-sm leading-tight">{t.name}</h3>
                  <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed line-clamp-3">
                    {t.description}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 mb-4">
                {t.bestFor && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-medium text-muted-foreground bg-muted/60 rounded-full px-2 py-1">
                    <Users className="w-3 h-3" />
                    {t.bestFor}
                  </span>
                )}
                {t.dealSize && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-medium text-muted-foreground bg-muted/60 rounded-full px-2 py-1">
                    <Wallet className="w-3 h-3" />
                    {t.dealSize}
                  </span>
                )}
                <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 rounded-full px-2 py-1">
                  <Clock className="w-3 h-3" />
                  Saves {t.timeSaved}
                </span>
              </div>

              <div className="mt-auto">
                <Button
                  onClick={(e) => {
                    e.stopPropagation();
                    onUse(t);
                  }}
                  className="w-full gap-2 bg-gradient-to-r from-accent to-purple text-white hover:brightness-110 group-hover:shadow-md transition-shadow"
                >
                  Start Proposal
                  <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                </Button>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
