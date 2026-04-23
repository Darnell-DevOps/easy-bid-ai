import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Send, CheckCircle2, DollarSign, Hourglass } from "lucide-react";

interface SalesMetricsProps {
  proposalsSentThisMonth: number;
  acceptedProposals: number;
  revenuePaid: number;
  pendingPayments: number;
  currencySymbol?: string;
}

export default function SalesMetrics({
  proposalsSentThisMonth,
  acceptedProposals,
  revenuePaid,
  pendingPayments,
  currencySymbol = "$",
}: SalesMetricsProps) {
  const navigate = useNavigate();

  const fmt = (n: number) =>
    n >= 1000 ? `${currencySymbol}${(n / 1000).toFixed(1)}k` : `${currencySymbol}${n.toLocaleString()}`;

  const stats = [
    {
      label: "Proposals Sent",
      sub: "This month",
      value: proposalsSentThisMonth.toString(),
      icon: Send,
      accent: "text-blue-500",
      iconWrap: "bg-blue-500/10",
      link: "/dashboard/proposals",
    },
    {
      label: "Accepted",
      sub: "All time",
      value: acceptedProposals.toString(),
      icon: CheckCircle2,
      accent: "text-emerald-500",
      iconWrap: "bg-emerald-500/10",
      link: "/dashboard/proposals",
    },
    {
      label: "Revenue (Paid)",
      sub: "All time",
      value: fmt(revenuePaid),
      icon: DollarSign,
      accent: "text-emerald-500",
      iconWrap: "bg-emerald-500/10",
      link: "/dashboard/revenue",
    },
    {
      label: "Pending Payments",
      sub: "Awaiting",
      value: fmt(pendingPayments),
      icon: Hourglass,
      accent: "text-amber-500",
      iconWrap: "bg-amber-500/10",
      link: "/dashboard/proposals",
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
      {stats.map((s) => {
        const Icon = s.icon;
        return (
          <Card
            key={s.label}
            className="group hover:shadow-lg hover:border-accent/20 transition-all duration-300 cursor-pointer"
            onClick={() => navigate(s.link)}
          >
            <CardContent className="p-4 sm:p-5">
              <div className="flex items-center justify-between mb-2">
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${s.iconWrap}`}>
                  <Icon className={`w-4 h-4 ${s.accent}`} />
                </div>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground/70 font-medium text-right">
                  {s.label}
                </p>
              </div>
              <p className="text-2xl sm:text-3xl font-bold text-foreground leading-tight">{s.value}</p>
              <p className="text-xs text-muted-foreground mt-1">{s.sub}</p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
