/** One positioned run of text from a PDF page, as pdf.js reports it. */
export interface PdfRun {
  str: string;
  /** Baseline y in PDF units; larger is higher on the page. */
  y: number;
  /** Font height in PDF units. */
  height: number;
  hasEOL: boolean;
}

/** The fields of a pdf.js text item this module uses. Marked-content items have no `str`. */
type PdfItem = { str: string; transform: number[]; height: number; hasEOL: boolean } | { type: string };

/** Keeps the text items of one page, in order, as runs. */
export function toRuns(items: readonly PdfItem[]): PdfRun[] {
  const runs: PdfRun[] = [];
  for (const item of items) {
    if (!('str' in item)) continue;
    runs.push({ str: item.str, y: item.transform[5] ?? 0, height: item.height || Math.abs(item.transform[3] ?? 0), hasEOL: item.hasEOL });
  }
  return runs;
}

const HEADING = /^\d{1,3}\.\s+[A-Z]/;

/**
 * Turns the text runs of each page into lease text the parser can read: runs on one line are
 * joined, lines in one paragraph are reflowed with a space (so a sentence wrapped across lines
 * stays one sentence and quotes stay verbatim), and a new paragraph starts at a larger vertical
 * gap, at a numbered heading ("6. SECURITY DEPOSIT."), or at a new page.
 */
export function pdfRunsToText(pages: readonly (readonly PdfRun[])[]): string {
  const paragraphs: string[] = [];
  for (const runs of pages) {
    const lines: { y: number; height: number; text: string }[] = [];
    let current: { y: number; height: number; text: string } | null = null;
    for (const run of runs) {
      if (!current || Math.abs(run.y - current.y) > Math.max(1, run.height * 0.5)) {
        if (current) lines.push(current);
        current = { y: run.y, height: run.height, text: '' };
      }
      current.text += run.str;
      current.height = Math.max(current.height, run.height);
      if (run.hasEOL) {
        lines.push(current);
        current = null;
      }
    }
    if (current) lines.push(current);

    let paragraph = '';
    let lastY: number | null = null;
    let lastGap: number | null = null;
    for (const line of lines) {
      const text = line.text.replace(/\s+/g, ' ').trim();
      if (!text) continue;
      const gap = lastY === null ? null : lastY - line.y;
      // A gap clearly wider than the usual line spacing on this page ends the paragraph.
      const wide = gap !== null && (gap > line.height * 1.9 || (lastGap !== null && gap > lastGap * 1.4));
      if (paragraph && (wide || HEADING.test(text))) {
        paragraphs.push(paragraph);
        paragraph = '';
      }
      paragraph = paragraph ? `${paragraph} ${text}` : text;
      if (gap !== null && !wide) lastGap = lastGap === null ? gap : Math.min(lastGap, gap);
      lastY = line.y;
    }
    if (paragraph) paragraphs.push(paragraph);
  }
  return paragraphs.join('\n\n');
}
