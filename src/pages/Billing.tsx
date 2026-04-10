import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Lock } from "lucide-react";

const plans = [
  {
    name: "Free",
    price: "£0",
    period: "/month",
    features: [
      { text: "3 proposals per month", locked: false },
      { text: "Watermark on exports", locked: false },
      { text: "Invoice export", locked: true },
      { text: "Custom branding", locked: true },
      { text: "Unlimited proposals", locked: true },
    ],
    current: true,
    popular: false,
  },
  {
    name: "Pro",
    price: "£9",
    period: "/month",
    features: [
      { text: "Unlimited proposals", locked: false },
      { text: "No watermark", locked: false },
      { text: "PDF export", locked: false },
      { text: "Invoice export", locked: false },
      { text: "Custom branding", locked: false },
      { text: "Proposal history", locked: false },
    ],
    current: false,
    popular: true,
  },
];

export default function Billing() {
  return (
    <DashboardLayout>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-foreground">Billing</h1>
        <p className="text-sm text-muted-foreground mt-1">Manage your subscription plan</p>
      </div>

      <div className="grid md:grid-cols-2 gap-6 max-w-3xl">
        {plans.map((plan) => (
          <Card
            key={plan.name}
            className={`glass-card ${
              plan.popular
                ? "border-accent shadow-[0_0_20px_hsl(var(--accent)/0.3)] ring-1 ring-accent relative"
                : plan.current
                ? "border-accent relative"
                : "relative"
            }`}
          >
            {plan.popular && (
              <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                <Badge className="bg-accent text-accent-foreground shadow-md">Most Popular</Badge>
              </div>
            )}
            <CardContent className="p-6">
              <h3 className="font-semibold text-foreground text-lg">{plan.name}</h3>
              <div className="mt-2 mb-4">
                <span className="text-3xl font-bold text-foreground">{plan.price}</span>
                <span className="text-muted-foreground">{plan.period}</span>
              </div>
              <ul className="space-y-2 mb-6">
                {plan.features.map((f) => (
                  <li
                    key={f.text}
                    className={`text-sm flex items-center gap-2 ${
                      f.locked ? "text-muted-foreground/40" : "text-muted-foreground"
                    }`}
                  >
                    {f.locked ? (
                      <Lock className="w-3.5 h-3.5 flex-shrink-0" />
                    ) : (
                      <div className="w-1.5 h-1.5 rounded-full bg-accent flex-shrink-0" />
                    )}
                    {f.text}
                  </li>
                ))}
              </ul>
              <Button
                variant={plan.current ? "outline" : "default"}
                className={
                  plan.popular
                    ? "bg-accent text-accent-foreground hover:bg-accent/90 w-full shadow-[0_0_12px_hsl(var(--accent)/0.4)]"
                    : !plan.current
                    ? "bg-accent/80 text-accent-foreground hover:bg-accent/70 w-full"
                    : "w-full"
                }
                disabled={plan.current}
              >
                {plan.current ? "Current Plan" : "Upgrade"}
              </Button>
              {plan.popular && (
                <p className="text-xs text-muted-foreground text-center mt-3">
                  Used by freelancers closing more deals
                </p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </DashboardLayout>
  );
}