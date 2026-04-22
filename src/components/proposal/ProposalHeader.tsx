import { Separator } from "@/components/ui/separator";

interface ProposalHeaderProps {
  clientName: string;
  companyName: string;
  serviceType: string;
  createdAt: string;
}

export default function ProposalHeader({ clientName, companyName, serviceType, createdAt }: ProposalHeaderProps) {
  return (
    <div className="rounded-xl border border-border bg-card p-6 lg:p-10">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-purple to-accent">
            <span className="text-sm font-bold text-accent-foreground">SS</span>
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">StriveSync</p>
            <p className="text-xs text-muted-foreground">Professional Proposal</p>
          </div>
        </div>
        <div className="text-right text-xs text-muted-foreground leading-relaxed">
          <p>{new Date(createdAt).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}</p>
        </div>
      </div>
      <Separator className="my-6 bg-border" />
      <div>
        <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground mb-2">Prepared for</p>
        <h1 className="text-2xl lg:text-3xl font-bold text-foreground">{clientName}</h1>
        <p className="text-sm text-muted-foreground mt-1">{companyName} · {serviceType}</p>
      </div>
    </div>
  );
}
