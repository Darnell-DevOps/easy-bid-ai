import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { FileText, Users, DollarSign, Clock } from "lucide-react";

interface StatsCardsProps {
  totalProposals: number;
  revenueGenerated: number;
  activeClients: number;
  timeSavedMinutes: number;
}

export default function StatsCards({ totalProposals, revenueGenerated, activeClients, timeSavedMinutes }: StatsCardsProps) {
  const navigate = useNavigate();
  const hours = Math.floor(timeSavedMinutes / 60);
  const mins = timeSavedMinutes % 60;
  const timeSaved = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
  const revDisplay = revenueGenerated >= 1000 ? `$${(revenueGenerated / 1000).toFixed(1)}k` : `$${revenueGenerated.toLocaleString()}`;

  const stats = [
    { label: "Revenue Generated", value: revDisplay, icon: DollarSign, accent: "text-emerald-400", link: "/dashboard/revenue" },
    { label: "Total Proposals", value: totalProposals, icon: FileText, accent: "text-primary", link: "/dashboard/proposals" },
    { label: "Active Clients", value: activeClients, icon: Users, accent: "text-accent", link: "/dashboard" },
    { label: "Time Saved", value: timeSaved, icon: Clock, accent: "text-amber-400", link: "/dashboard" },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
      {stats.map((s) => (
        <Card
          key={s.label}
          className="group hover:shadow-lg hover:border-accent/20 transition-all duration-300 cursor-pointer"
          onClick={() => navigate(s.link)}
        >
          <CardContent className="p-4 sm:p-5">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-9 h-9 rounded-lg bg-accent/10 flex items-center justify-center">
                <s.icon className={`w-4 h-4 ${s.accent}`} />
              </div>
            </div>
            <p className="text-2xl sm:text-3xl font-bold text-foreground">{s.value}</p>
            <p className="text-xs text-muted-foreground mt-1">{s.label}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
