// Shared client-side PDF export for contracts. Wraps html2pdf with the same
// "pdf-export-surface" styling used in ContractDetail so the dashboard and
// the public signing page produce identical executed PDFs.
// @ts-ignore - no types ship with html2pdf.js
import html2pdf from "html2pdf.js";

export async function downloadContractPdf(node: HTMLElement, title: string) {
  const safeTitle = title.replace(/[^a-z0-9-_ ]/gi, "").trim() || "contract";
  await html2pdf()
    .set({
      margin: [12, 12, 16, 12],
      filename: `${safeTitle}.pdf`,
      image: { type: "jpeg", quality: 0.95 },
      html2canvas: { scale: 2, backgroundColor: "#ffffff", useCORS: true },
      jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
    } as any)
    .from(node)
    .save();
}
