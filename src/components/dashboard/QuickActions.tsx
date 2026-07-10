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
      accent: "bg-accent text-accent-foreground",
      primary: true,
    },
    {
      label: "Create Proposal",
      description: "Start from scratch or a template",
      icon: Sparkles,
      href: "/dashboard/new",
      accent: "bg-secondary text-accent",
      primary: false,
    },
    {
      label: "Add Client",
      description: "Save a new lead or client",
      icon: UserPlus,
      href: "/dashboard/clients/new",
      accent: "bg-secondary text-success",
      primary: false,
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
      {actions.map((a) => (
        <Link key={a.label} to={a.href} className="group">
          <Card
            className={`transition-colors duration-200 cursor-pointer h-full ${
              a.primary
                ? "border-accent/25 bg-accent/[0.05] hover:border-accent/40"
                : "hover:border-accent/20"
            }`}
          >
            <CardContent className="p-5 flex items-center gap-4">
              <div
                className={`w-11 h-11 rounded-lg ${a.accent} flex items-center justify-center flex-shrink-0`}
              >
                <a.icon className="w-5 h-5" />
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
