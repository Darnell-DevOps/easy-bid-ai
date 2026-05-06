import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Sparkles, UserPlus, ArrowRight, Wand2 } from "lucide-react";

export default function QuickActions() {
  const actions = [
    {
      label: "Generate Proposal from Lead",
      description: "Paste a lead — AI picks the best template",
      icon: Wand2,
      href: "/dashboard/leads?mode=smart",
      accent: "from-accent to-purple",
      primary: true,
    },
    {
      label: "Create Proposal",
      description: "Start from scratch or a template",
      icon: Sparkles,
      href: "/dashboard/new",
      accent: "from-blue-500 to-cyan-500",
      primary: false,
    },
    {
      label: "Add Client",
      description: "Save a new lead or client",
      icon: UserPlus,
      href: "/dashboard/clients/new",
      accent: "from-emerald-500 to-teal-500",
      primary: false,
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
      {actions.map((a) => (
        <Link key={a.label} to={a.href} className="group">
          <Card
            className={`hover:shadow-lg transition-all duration-300 cursor-pointer h-full ${
              a.primary
                ? "border-accent/30 bg-gradient-to-br from-accent/5 to-purple/5 hover:border-accent/50"
                : "hover:border-accent/20"
            }`}
          >
            <CardContent className="p-5 flex items-center gap-4">
              <div
                className={`w-11 h-11 rounded-lg bg-gradient-to-br ${a.accent} flex items-center justify-center flex-shrink-0 opacity-90 group-hover:opacity-100 transition-opacity shadow-md`}
              >
                <a.icon className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-foreground text-sm">{a.label}</p>
                <p className="text-xs text-muted-foreground">{a.description}</p>
              </div>
              <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-accent group-hover:translate-x-0.5 transition-all flex-shrink-0" />
            </CardContent>
          </Card>
        </Link>
      ))}
    </div>
  );
}
