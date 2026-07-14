interface ProposalHeaderProps {
  clientName: string;
  companyName: string;
  serviceType: string;
  createdAt: string;
}

export default function ProposalHeader({ clientName, companyName, serviceType, createdAt }: ProposalHeaderProps) {
  const dateStr = new Date(createdAt).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  return (
    <div className="pb-8 lg:pb-10 mb-2 border-b border-border">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-purple to-accent">
            <span className="text-xs font-bold text-accent-foreground">SS</span>
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground leading-tight">CloseSync</p>
            <p className="text-[11px] uppercase tracking-widest text-muted-foreground">Professional Proposal</p>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">{dateStr}</p>
      </div>
      <p className="text-xs font-medium uppercase tracking-[0.2em] text-purple mb-3">Prepared for {companyName || clientName}</p>
      <h1 className="text-3xl lg:text-5xl font-bold text-foreground tracking-tight leading-[1.1]">
        Proposal for {clientName}
      </h1>
      <p className="text-base lg:text-lg text-muted-foreground mt-4 max-w-2xl leading-relaxed">
        A clear plan to help you grow with{" "}
        <span className="text-foreground font-medium">{serviceType.toLowerCase()}</span> — built around your goals,
        delivered with care.
      </p>
    </div>
  );
}
