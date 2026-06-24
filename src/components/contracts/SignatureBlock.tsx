import type { ContractSignatureRow } from "@/lib/contracts";

interface SignatureBlockProps {
  signatures: Pick<
    ContractSignatureRow,
    "id" | "signer_name" | "signer_email" | "method" | "signature_data" | "signed_at" | "signer_role"
  >[];
}

/**
 * Renders the captured signature(s) inline at the foot of a contract document.
 * When both client and provider have signed, surfaces an "Executed" banner so
 * either side can see the contract is fully countersigned.
 */
export default function SignatureBlock({ signatures }: SignatureBlockProps) {
  if (!signatures || signatures.length === 0) return null;

  const hasClient = signatures.some((s) => s.signer_role === "client");
  const hasProvider = signatures.some((s) => s.signer_role === "provider");
  const executed = hasClient && hasProvider;
  // Sort so client is shown first, then provider — matches signing order.
  const ordered = [...signatures].sort((a, b) => {
    const order: Record<string, number> = { client: 0, provider: 1 };
    return (order[a.signer_role || "client"] ?? 2) - (order[b.signer_role || "client"] ?? 2);
  });
  const executedAt = ordered.find((s) => s.signer_role === "provider")?.signed_at;

  return (
    <div className="mt-10 pt-8 border-t border-border space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
          Signed by
        </p>
        {executed && (
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-600 bg-emerald-500/10 px-2.5 py-1 rounded-full">
            ● EXECUTED{executedAt ? ` · ${new Date(executedAt).toLocaleDateString()}` : ""}
          </span>
        )}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {ordered.map((s) => (
          <div
            key={s.id}
            className="rounded-lg border border-border bg-white p-4 flex flex-col"
          >
            <p className="text-[10px] uppercase tracking-wider font-semibold text-slate-500 mb-2">
              {s.signer_role === "provider" ? "Service Provider" : "Client"}
            </p>
            <div className="min-h-20 flex items-center justify-center">
              {s.method === "drawn" && s.signature_data?.startsWith("data:image") ? (
                <img
                  src={s.signature_data}
                  alt={`Signature of ${s.signer_name}`}
                  className="max-h-20 object-contain"
                />
              ) : (
                <p
                  className="text-3xl text-slate-900"
                  style={{ fontFamily: "'Caveat', 'Brush Script MT', cursive" }}
                >
                  {s.signature_data || s.signer_name}
                </p>
              )}
            </div>
            <div className="mt-3 pt-3 border-t border-slate-200">
              <p className="text-sm font-semibold text-slate-900">{s.signer_name}</p>
              {s.signer_email && (
                <p className="text-xs text-slate-500">{s.signer_email}</p>
              )}
              <p className="text-xs text-slate-500 mt-0.5">
                Signed {new Date(s.signed_at).toLocaleString()}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
