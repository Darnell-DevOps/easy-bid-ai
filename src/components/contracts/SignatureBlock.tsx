import type { ContractSignatureRow } from "@/lib/contracts";

interface SignatureBlockProps {
  signatures: Pick<
    ContractSignatureRow,
    "id" | "signer_name" | "signer_email" | "method" | "signature_data" | "signed_at"
  >[];
}

/**
 * Renders the captured signature(s) inline at the foot of a contract document,
 * so the signed contract visibly carries the signature rather than appearing empty.
 */
export default function SignatureBlock({ signatures }: SignatureBlockProps) {
  if (!signatures || signatures.length === 0) return null;
  return (
    <div className="mt-10 pt-8 border-t border-border space-y-6">
      <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
        Signed by
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        {signatures.map((s) => (
          <div
            key={s.id}
            className="rounded-lg border border-border bg-white p-4 flex flex-col"
          >
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
