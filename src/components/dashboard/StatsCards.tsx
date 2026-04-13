import { Card, CardContent } from "@/components/ui/card";
import { FileText, Users, DollarSign, TrendingUp, Clock } from "lucide-react";

interface StatsCardsProps {
  totalProposals: number;
  monthlyProposals: number;
  activeClients: number;
  timeSavedMinutes: number;
}

export default function StatsCards({ totalProposals, monthlyProposals, activeClients, timeSavedMinutes }: StatsCardsProps) {
  const hours = Math.floor(timeSavedMinutes / 60);
  const mins = timeSavedMinutes % 60;
  const timeSaved = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;

  const stats = [
    { label: "This Month", value: monthlyProposals, icon: TrendingUp, accent: "text-accent" },
    { label: "Total Proposals", value: totalProposals, icon: FileText, accent: "text-primary" },
    { label: "Active Clients", value: activeClients, icon: Users, accent: "text-emerald-400" },
    { label: "Time Saved", value: timeSaved, icon: Clock, accent: "text-amber-400" },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
      {stats.map((s) => (
        <Card key={s.label} className="group hover:shadow-lg hover:border-accent/20 transition-all duration-300">
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
