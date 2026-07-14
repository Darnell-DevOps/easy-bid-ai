interface BrandingLite {
  business_name?: string | null;
  tagline?: string | null;
  logo_url?: string | null;
  brand_color?: string | null;
  brand_secondary_color?: string | null;
  show_logo_on_proposals?: boolean | null;
  proposal_cover_show_name?: boolean | null;
  proposal_cover_show_tagline?: boolean | null;
  proposal_cover_show_date?: boolean | null;
}

interface ProposalHeaderProps {
  clientName: string;
  companyName: string;
  serviceType: string;
  createdAt: string;
  branding?: BrandingLite | null;
}

export default function ProposalHeader({
  clientName,
  companyName,
  serviceType,
  createdAt,
  branding,
}: ProposalHeaderProps) {
  const dateStr = new Date(createdAt).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const businessName = branding?.business_name?.trim() || "";
  const initials =
    (businessName || "")
      .split(/\s+/)
      .map((s) => s[0])
      .filter(Boolean)
      .slice(0, 2)
      .join("")
      .toUpperCase() || "";

  const brandColor = branding?.brand_color || undefined;
  const brandSecondary = branding?.brand_secondary_color || brandColor || undefined;
  const showLogo = branding?.show_logo_on_proposals !== false; // default on when unset
  const showName = branding?.proposal_cover_show_name !== false;
  const showTagline = branding?.proposal_cover_show_tagline !== false;
  const showDate = branding?.proposal_cover_show_date !== false;

  const eyebrowStyle = brandColor ? { color: brandColor } : undefined;
  const gradientStyle =
    brandColor && brandSecondary
      ? { backgroundImage: `linear-gradient(135deg, ${brandColor}, ${brandSecondary})` }
      : undefined;

  return (
    <div className="pb-8 lg:pb-10 mb-2 border-b border-border">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          {showLogo && branding?.logo_url ? (
            <img
              src={branding.logo_url}
              alt={businessName || "Logo"}
              className="h-9 w-auto max-w-[140px] object-contain"
            />
          ) : showLogo && initials ? (
            <div
              className={
                "flex h-9 w-9 items-center justify-center rounded-lg " +
                (gradientStyle ? "" : "bg-gradient-to-br from-purple to-accent")
              }
              style={gradientStyle}
            >
              <span className="text-xs font-bold text-white">{initials}</span>
            </div>
          ) : null}
          <div>
            {showName && businessName && (
              <p className="text-sm font-semibold text-foreground leading-tight">{businessName}</p>
            )}
            {showTagline && branding?.tagline ? (
              <p className="text-[11px] uppercase tracking-widest text-muted-foreground">
                {branding.tagline}
              </p>
            ) : (
              <p className="text-[11px] uppercase tracking-widest text-muted-foreground">
                Professional Proposal
              </p>
            )}
          </div>
        </div>
        {showDate && <p className="text-xs text-muted-foreground">{dateStr}</p>}
      </div>
      <p
        className="text-xs font-medium uppercase tracking-[0.2em] mb-3 text-purple"
        style={eyebrowStyle}
      >
        Prepared for {companyName || clientName}
      </p>
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
