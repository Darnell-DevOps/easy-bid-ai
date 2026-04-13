import { useNavigate } from "react-router-dom";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Globe, Share2, Palette, TrendingUp, ArrowRight } from "lucide-react";

export interface TemplateData {
  id: string;
  name: string;
  description: string;
  icon: React.ElementType;
  accent: string;
  serviceType: string;
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
    description: "A complete website design & development proposal covering UX, UI, responsive build, and launch support.",
    icon: Globe,
    accent: "from-accent to-purple",
    serviceType: "Web Design & Development",
    prefill: {
      project_scope: "Full website redesign including UX audit, custom UI design for key pages (Home, About, Services, Contact), mobile-responsive development, SEO optimisation, and browser/device testing.",
      budget: "£1,200",
      timeline: "2 weeks",
      notes: "Includes one round of revisions per phase. Content to be provided by the client.",
    },
  },
  {
    id: "social-media",
    name: "Social Media Management",
    description: "Monthly social media strategy, content creation, scheduling, community management, and performance reporting.",
    icon: Share2,
    accent: "from-blue-500 to-cyan-500",
    serviceType: "Social Media Management",
    prefill: {
      project_scope: "Monthly social media management across Instagram, LinkedIn, and TikTok. Includes content strategy, 12 posts per month, community engagement, and a monthly analytics report.",
      budget: "£800/month",
      timeline: "Ongoing (3-month minimum)",
      notes: "First month includes brand audit and content pillar development.",
    },
  },
  {
    id: "branding",
    name: "Branding Package",
    description: "End-to-end brand identity design including logo, colour palette, typography, and brand guidelines document.",
    icon: Palette,
    accent: "from-pink-500 to-rose-500",
    serviceType: "Brand Identity",
    prefill: {
      project_scope: "Complete brand identity package: logo design (3 concepts, 2 revision rounds), colour palette, typography system, brand guidelines PDF, and social media avatar/banner kit.",
      budget: "£1,500",
      timeline: "3 weeks",
      notes: "Includes a discovery workshop to align on brand values and positioning.",
    },
  },
  {
    id: "marketing-strategy",
    name: "Marketing Strategy",
    description: "A data-driven marketing strategy covering audience research, channel selection, campaign planning, and KPIs.",
    icon: TrendingUp,
    accent: "from-emerald-500 to-teal-500",
    serviceType: "Marketing Strategy",
    prefill: {
      project_scope: "Comprehensive marketing strategy: competitor analysis, audience segmentation, channel recommendations (paid & organic), 90-day campaign roadmap, KPI framework, and budget allocation plan.",
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

  return (
    <DashboardLayout>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-foreground">Templates</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Pick a template to jumpstart your next proposal
        </p>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        {templates.map((t) => (
          <Card
            key={t.id}
            className="group hover:shadow-lg hover:border-accent/20 transition-all duration-300"
          >
            <CardContent className="p-6 flex flex-col h-full">
              <div className="flex items-start gap-4 mb-4">
                <div
                  className={`w-11 h-11 rounded-lg bg-gradient-to-br ${t.accent} flex items-center justify-center flex-shrink-0 opacity-90 group-hover:opacity-100 transition-opacity`}
                >
                  <t.icon className="w-5 h-5 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-foreground text-sm leading-tight">
                    {t.name}
                  </h3>
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                    {t.description}
                  </p>
                </div>
              </div>
              <div className="mt-auto pt-4">
                <Button
                  onClick={() => handleUseTemplate(t)}
                  variant="outline"
                  size="sm"
                  className="w-full gap-2 group-hover:border-accent/40 group-hover:text-accent transition-colors"
                >
                  Use Template <ArrowRight className="w-3.5 h-3.5" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </DashboardLayout>
  );
}
