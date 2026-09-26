import { useId, useMemo } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight, TrendingUp } from "lucide-react";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { ChartDataTable } from "@/components/ui/chart-data-table";

interface PaidProposal { budget: string; client_paid?: boolean; paid_at?: string | null }
const money = (value: number) => new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 0 }).format(value);

export function monthlyPaidProposals(proposals: PaidProposal[], today = new Date()) {
  const months = Array.from({ length: 6 }, (_, i) => {
    const date = new Date(today.getFullYear(), today.getMonth() - 5 + i, 1);
    return { month: date.toLocaleDateString("en-GB", { month: "short" }), label: date.toLocaleDateString("en-GB", { month: "long", year: "numeric" }), year: date.getFullYear(), index: date.getMonth(), amount: 0 };
  });
  for (const proposal of proposals) {
    if (!proposal.client_paid || !proposal.paid_at) continue;
    const paid = new Date(proposal.paid_at);
    if (!Number.isFinite(paid.getTime()) || paid > today) continue;
    const month = months.find((item) => item.year === paid.getFullYear() && item.index === paid.getMonth());
    const amount = Number.parseFloat(proposal.budget.replace(/[^0-9.]/g, ""));
    if (month && Number.isFinite(amount)) month.amount += amount;
  }
  return months;
}

export default function RevenueActivity({ proposals }: { proposals: PaidProposal[] }) {
  const gradientId = useId().replace(/:/g, "");
  const months = useMemo(() => monthlyPaidProposals(proposals), [proposals]);
  const total = months.reduce((sum, month) => sum + month.amount, 0);
  const hasActivity = months.some((month) => month.amount > 0);
  return (
    <section className="cs-dashboard-panel cs-revenue-activity" aria-labelledby="revenue-activity-heading">
      <div className="cs-dashboard-panel-heading">
        <div><h2 id="revenue-activity-heading">Revenue activity</h2><p>Paid proposal value, by month</p></div>
        <span className="cs-dashboard-period">Last 6 months</span>
      </div>
      <div className="cs-revenue-total"><strong>{money(total)}</strong><span>in this period</span></div>
      <div className="cs-revenue-chart-wrap">
        <ChartContainer className="cs-revenue-chart" config={{ amount: { label: "Paid proposal value", color: "var(--cs-dashboard-chart)" } }} aria-hidden="true">
          <AreaChart data={months} margin={{ top: 16, right: 8, left: 0, bottom: 0 }} accessibilityLayer={false}>
            <defs><linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--color-amount)" stopOpacity={0.28} /><stop offset="100%" stopColor="var(--color-amount)" stopOpacity={0} /></linearGradient></defs>
            <CartesianGrid vertical={false} strokeDasharray="3 6" />
            <XAxis dataKey="month" tickLine={false} axisLine={false} tickMargin={12} />
            <YAxis tickLine={false} axisLine={false} width={48} domain={[0, hasActivity ? "auto" : 1000]} tickFormatter={(value: number) => value >= 1000 ? "£" + value / 1000 + "k" : "£" + value} />
            {hasActivity && <ChartTooltip content={<ChartTooltipContent formatter={(value) => money(Number(value))} />} />}
            <Area type="linear" dataKey="amount" stroke="var(--color-amount)" strokeWidth={2} fill={"url(#" + gradientId + ")"} isAnimationActive={false} dot={hasActivity ? { r: 3, strokeWidth: 2 } : false} />
          </AreaChart>
        </ChartContainer>
        {!hasActivity && <div className="cs-revenue-empty"><TrendingUp aria-hidden="true" /><strong>No paid proposals in this period</strong><span>Your monthly activity will appear here as clients pay.</span></div>}
      </div>
      <div className="sr-only"><ChartDataTable caption="Paid proposal value over the last six months" labelHeader="Month" valueHeader="Value" rows={months.map((month) => ({ label: month.label, value: money(month.amount) }))} /></div>
      <div className="cs-dashboard-panel-footer"><span>Based on recorded payment dates</span><Link to="/dashboard/revenue">View revenue <ArrowUpRight aria-hidden="true" /></Link></div>
    </section>
  );
}
