import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Plus, FileText, LayoutTemplate } from "lucide-react";

export default function QuickActions() {
  const actions = [
    { label: "New Proposal", description: "Create a new AI-powered proposal", icon: Plus, href: "/dashboard/new", accent: "from-accent to-purple" },
    { label: "Saved Proposals", description: "View and manage your proposals", icon: FileText, href: "/dashboard", accent: "from-primary to-accent" },
    { label: "View Templates", description: "Browse proposal templates", icon: LayoutTemplate, href: "/dashboard/templates", accent: "from-emerald-500 to-teal-500" },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
      {actions.map((a) => (
        <Link key={a.label} to={a.href}>
          <Card className="group hover:shadow-lg hover:border-accent/20 transition-all duration-300 cursor-pointer h-full">
            <CardContent className="p-5 flex items-center gap-4">
              <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${a.accent} flex items-center justify-center flex-shrink-0 opacity-90 group-hover:opacity-100 transition-opacity`}>
                <a.icon className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="font-medium text-foreground text-sm">{a.label}</p>
                <p className="text-xs text-muted-foreground">{a.description}</p>
              </div>
            </CardContent>
          </Card>
        </Link>
      ))}
    </div>
  );
}
