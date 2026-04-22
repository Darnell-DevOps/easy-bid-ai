import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { FileText, Users, DollarSign, Clock } from "lucide-react";

interface StatsCardsProps {
  totalProposals: number;
  revenueGenerated: number;
  activeClients: number;
  timeSavedMinutes: number;
  layout?: "grid" | "stacked";
}

export default function StatsCards({ totalProposals, revenueGenerated, activeClients, timeSavedMinutes, layout = "grid" }: StatsCardsProps) {
  const navigate = useNavigate();
  const hours = Math.floor(timeSavedMinutes / 60);
  const mins = timeSavedMinutes % 60;
  const timeSaved = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
  const revDisplay = revenueGenerated >= 1000 ? `$${(revenueGenerated / 1000).toFixed(1)}k` : `$${revenueGenerated.toLocaleString()}`;

  const stats = [
    {
      label: "Revenue Generated",
      value: revDisplay,
      icon: DollarSign,
      accent: "text-emerald-400",
      link: "/dashboard/revenue",
      hint: revenueGenerated === 0 ? "Start earning today" : "Keep the momentum",
    },
    {
      label: "Total Proposals",
      value: totalProposals,
      icon: FileText,
      accent: "text-primary",
      link: "/dashboard/proposals",
      hint: totalProposals === 0 ? "Create your first one" : "Send one to get paid",
    },
    {
      label: "Active Clients",
      value: activeClients,
      icon: Users,
      accent: "text-accent",
      link: "/dashboard/clients",
      hint: activeClients === 0 ? "Add your first client" : "Add more to grow",
    },
    {
      label: "Time Saved",
      value: timeSaved,
      icon: Clock,
      accent: "text-amber-400",
      link: "/dashboard/time-saved",
      hint: timeSavedMinutes === 0 ? "Tracked per proposal" : "Hours back in your week",
    },
  ];

  const wrapperClass =
    layout === "stacked"
      ? "grid grid-cols-2 lg:grid-cols-1 gap-3"
      : "grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4";

  return (
    <div className={wrapperClass}>
      {stats.map((s) => (
        <Card
          key={s.label}
          className="group hover:shadow-lg hover:border-accent/20 transition-all duration-300 cursor-pointer"
          onClick={() => navigate(s.link)}
        >
          <CardContent className="p-4 sm:p-5">
            <div className="flex items-center justify-between mb-2">
              <div className="w-9 h-9 rounded-lg bg-accent/10 flex items-center justify-center">
                <s.icon className={`w-4 h-4 ${s.accent}`} />
              </div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground/70 font-medium">{s.label}</p>
            </div>
            <p className="text-2xl sm:text-3xl font-bold text-foreground leading-tight">{s.value}</p>
            <p className="text-xs text-muted-foreground mt-1">{s.hint}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
