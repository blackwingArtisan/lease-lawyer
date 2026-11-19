import { pdfRunsToText, toRuns, type PdfRun } from './pdfText';

/**
 * Reads the text of a PDF in the browser with pdf.js. Nothing is uploaded anywhere. pdf.js is
 * loaded only when a PDF is chosen, so the first page load stays small. Scanned PDFs have no text
 * layer; they come back empty and the caller says so.
 */
export async function readPdfText(data: ArrayBuffer): Promise<{ text: string; pages: number }> {
  const [pdfjs, worker] = await Promise.all([import('pdfjs-dist'), import('pdfjs-dist/build/pdf.worker.min.mjs?url')]);
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
  const task = pdfjs.getDocument({ data: new Uint8Array(data) });
  try {
    const doc = await task.promise;
    const pages: PdfRun[][] = [];
    for (let n = 1; n <= doc.numPages; n++) {
      const page = await doc.getPage(n);
      const content = await page.getTextContent();
      pages.push(toRuns(content.items));
    }
    return { text: pdfRunsToText(pages), pages: doc.numPages };
  } finally {
    await task.destroy();
  }
}
