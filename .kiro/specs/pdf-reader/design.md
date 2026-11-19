# Design: PDF reader

> **Documented after the build.** Written from the code in `src/lease/pdf.ts`, `src/lease/pdfText.ts` and `src/ui/CaseFiles.tsx` after it shipped.

## Overview
```
File ─▶ CaseFiles.onFile
          ├─ .txt  ─▶ size check ─▶ text
          └─ .pdf  ─▶ size check (5 MB) ─▶ readPdfText ─▶ text check (empty, 200 KB) ─▶ text
                                    │
                        import('pdfjs-dist') on demand, worker from a hashed asset URL
                        page.getTextContent() ─▶ toRuns ─▶ pdfRunsToText
text ─▶ parseLease ─▶ the same reader, verifier and coverage check as every other lease
```

## Components
- **`readPdfText(data)`** (`src/lease/pdf.ts`) dynamically imports `pdfjs-dist` and its worker URL, so the first page load does not include pdf.js. It reads every page's text content, converts it with `toRuns`, and returns `{ text, pages }`. The loading task is always destroyed, even on error.
- **`toRuns(items)`** (`src/lease/pdfText.ts`) keeps only items with a `str` (marked-content items have none), taking the baseline from `transform[5]` and the height from `height` or `|transform[3]|`.
- **`pdfRunsToText(pages)`** groups runs into lines by baseline (within half a font height), then lines into paragraphs. A paragraph ends at a gap wider than 1.9 font heights or 1.4 times the smallest gap seen so far on the page, at a numbered heading (`^\d{1,3}\.\s+[A-Z]`), or at a page break. Lines are joined with one space and whitespace is collapsed, so a quote the reader takes from a wrapped sentence appears verbatim in the text the verifier checks.
- **`CaseFiles`** decides by extension or MIME type, refuses files over 5 MB before reading, refuses empty text (a scan) with the page count, refuses text over 200 KB, and refuses anything pdf.js throws on. Each refusal sets an `alert` message and leaves the current lease in place.
- **`scripts/make-sample-pdf.mjs`** renders a sample lease to a letter-size PDF with Playwright's Chromium, so the sample has a real text layer laid out the way a word processor would.

## Choices
- Text only, no OCR. A scan is refused with a reason instead of read badly; a wrong word in a quote would be dropped by the verifier and could make a clause look unread.
- Reflow is heuristic. When it fails, the cost is a missed fact, which the coverage check turns into "Can't tell", not a made-up one.

## Testing
- Unit (`tests/unit/pdf.test.ts`): reflow and paragraph breaks, headings at ordinary spacing, runs on one line and page breaks, an empty page, and the sample PDF reading to the same facts as its text with pdf.js under Node.
- End-to-end (`tests/e2e/lease-lawyer.spec.ts`): upload the sample PDF and get a cited No; download the sample PDF; refuse a PNG, an oversized text file and a damaged PDF while keeping the current lease.
