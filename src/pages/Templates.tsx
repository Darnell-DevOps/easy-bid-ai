import { useNavigate } from "react-router-dom";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
} from "lucide-react";

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
    prefill: {
      project_scope:
        "Monthly social media management across Instagram, LinkedIn, and TikTok. Includes content strategy, 12 posts per month, community engagement, and a monthly analytics report.",
      budget: "£800/month",
      timeline: "Ongoing (3-month minimum)",
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

  const handleUseTemplate = (template: TemplateData) => {
    navigate("/dashboard/new", { state: { template } });
  };

  const handleAIGenerate = () => {
    navigate("/dashboard/new");
  };

  return (
    <DashboardLayout>
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight">
          Start your proposal in seconds
        </h1>
        <p className="text-sm text-muted-foreground mt-2 max-w-2xl">
          Use proven, high-converting templates designed to help you win clients faster.
        </p>
        <p className="text-xs text-muted-foreground/80 mt-1 flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5" />
          Create a ready-to-send proposal in under 60 seconds.
        </p>
      </div>

      {/* Primary AI CTA */}
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

      {/* Social proof */}
      <div className="flex items-center gap-2 mb-4 text-xs text-muted-foreground">
        <ShieldCheck className="w-3.5 h-3.5 text-accent" />
        <span>Based on proven client-winning proposal structures</span>
      </div>

      {/* Templates grid */}
      <div className="grid sm:grid-cols-2 gap-4">
        {templates.map((t) => (
          <Card
            key={t.id}
            role="button"
            tabIndex={0}
            onClick={() => handleUseTemplate(t)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                handleUseTemplate(t);
              }
            }}
            className="group relative cursor-pointer hover:shadow-xl hover:border-accent/40 hover:-translate-y-1 transition-all duration-300 flex flex-col focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            {t.popular && (
              <div className="absolute -top-2 left-4 z-10">
                <Badge className="bg-gradient-to-r from-orange-500 to-rose-500 text-white border-transparent shadow-md text-[10px] px-2 py-0.5">
                  🔥 Most Popular
                </Badge>
              </div>
            )}
            <CardContent className="p-5 sm:p-6 flex flex-col h-full">
              <div className="flex items-start gap-4 mb-4">
                <div
                  className={`w-11 h-11 rounded-lg bg-gradient-to-br ${t.accent} flex items-center justify-center flex-shrink-0 opacity-90 group-hover:opacity-100 transition-opacity shadow-md`}
                >
                  <t.icon className="w-5 h-5 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-foreground text-sm leading-tight">
                    {t.name}
                  </h3>
                  <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
                    {t.description}
                  </p>
                </div>
              </div>

              {/* Meta info */}
              <div className="flex flex-wrap gap-2 mb-4">
                <span className="inline-flex items-center gap-1 text-[10px] font-medium text-muted-foreground bg-muted/60 rounded-full px-2 py-1">
                  <Users className="w-3 h-3" />
                  Best for: {t.bestFor}
                </span>
                <span className="inline-flex items-center gap-1 text-[10px] font-medium text-muted-foreground bg-muted/60 rounded-full px-2 py-1">
                  <Wallet className="w-3 h-3" />
                  {t.dealSize}
                </span>
                <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 rounded-full px-2 py-1">
                  <Clock className="w-3 h-3" />
                  Saves {t.timeSaved}
                </span>
              </div>

              <div className="mt-auto">
                <Button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleUseTemplate(t);
                  }}
                  className="w-full gap-2 bg-gradient-to-r from-accent to-purple text-white hover:brightness-110 group-hover:shadow-md transition-shadow"
                >
                  Start Proposal
                  <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </DashboardLayout>
  );
}
