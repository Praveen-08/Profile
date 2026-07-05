/**
 * Export helpers: builds clean, print-friendly HTML in a new window (so
 * "Save as PDF" in the browser's print dialog gets a proper file name and a
 * clean header) instead of relying on the app's own page title/URL, and
 * generates consistent file-name bases like
 * "16A-Bliss-Court-Takanini_Portal-Copy_2026-07-06".
 */

export function slugify(text: string): string {
  return text
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

export function buildExportFileBase(address: string, suburb: string, sectionLabel: string): string {
  const location = [slugify(address), slugify(suburb)].filter(Boolean).join("-");
  return `${location}_${slugify(sectionLabel)}_${todayIsoDate()}`;
}

export interface ExportSectionInput {
  label: string;
  content: string;
}

export interface PrintExportOptions {
  fileNameBase: string;
  propertyAddress: string;
  suburb: string;
  sectionLabel: string;
  agentName?: string;
  agencyName?: string;
  sections: ExportSectionInput[];
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Opens a clean, isolated print window (own <title>, own styles) and triggers the print dialog. */
export function printCampaignExport(options: PrintExportOptions) {
  const { fileNameBase, propertyAddress, suburb, sectionLabel, agentName, agencyName, sections } = options;
  const generatedDate = new Date().toLocaleDateString("en-NZ", { day: "numeric", month: "long", year: "numeric" });

  const sectionsHtml = sections
    .map(
      (s) => `
        <section>
          <h2>${escapeHtml(s.label)}</h2>
          <pre>${escapeHtml(s.content || "(no content generated yet)")}</pre>
        </section>`
    )
    .join("\n");

  const html = `<!doctype html>
<html lang="en-NZ">
<head>
<meta charset="utf-8" />
<title>${escapeHtml(fileNameBase)}</title>
<style>
  body { font-family: -apple-system, "Segoe UI", "Helvetica Neue", Arial, sans-serif; color: #111; max-width: 720px; margin: 40px auto; padding: 0 24px; }
  header { border-bottom: 2px solid #B8944F; padding-bottom: 16px; margin-bottom: 24px; }
  header h1 { font-size: 22px; margin: 0 0 4px; }
  header p { margin: 2px 0; color: #555; font-size: 13px; }
  section { margin-bottom: 28px; page-break-inside: avoid; }
  section h2 { font-size: 14px; text-transform: uppercase; letter-spacing: 0.05em; color: #8F6E36; margin-bottom: 8px; border-bottom: 1px solid #eee; padding-bottom: 4px; }
  pre { white-space: pre-wrap; font-family: inherit; font-size: 14px; line-height: 1.6; margin: 0; }
  @media print { body { margin: 0; padding: 24px; } }
</style>
</head>
<body>
  <header>
    <h1>${escapeHtml(propertyAddress)}, ${escapeHtml(suburb)}</h1>
    <p>${escapeHtml(sectionLabel)}</p>
    ${agentName ? `<p>${escapeHtml(agentName)}${agencyName ? ` &middot; ${escapeHtml(agencyName)}` : ""}</p>` : ""}
    <p>Generated ${escapeHtml(generatedDate)}</p>
  </header>
  ${sectionsHtml}
</body>
</html>`;

  const printWindow = window.open("", "_blank");
  if (!printWindow) return;
  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
  printWindow.focus();
  setTimeout(() => printWindow.print(), 300);
}
