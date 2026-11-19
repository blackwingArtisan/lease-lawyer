// Renders a sample lease to a letter-size PDF with real, selectable text, the way a property
// manager's word processor would. Used for the "sample PDF" link and the PDF upload test.
//   node scripts/make-sample-pdf.mjs [input.txt] [output.pdf]
import { readFile } from 'node:fs/promises';
import { chromium } from '@playwright/test';

const [input = 'src/lease/fixtures/gaslight-row.txt', output = 'public/samples/gaslight-row-townhomes.pdf'] = process.argv.slice(2);
const text = await readFile(input, 'utf8');
const escape = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const [kind, name, ...rest] = text.trim().split('\n');
const body = rest
  .join('\n')
  .split(/\n\s*\n/)
  .filter((p) => p.trim())
  .map((p) => `<p>${escape(p.trim())}</p>`)
  .join('\n');
const html = `<!doctype html><meta charset="utf-8"><style>
  body { font: 11.5pt/1.5 Georgia, 'Times New Roman', serif; margin: 0; color: #111; }
  h1 { font-size: 11pt; letter-spacing: 0.2em; text-align: center; margin: 0 0 4pt; font-weight: normal; }
  h2 { font-size: 16pt; text-align: center; margin: 0 0 18pt; }
  p { margin: 0 0 10pt; text-align: justify; }
</style><h1>${escape(kind)}</h1><h2>${escape(name)}</h2>${body}`;

const browser = await chromium.launch();
const page = await browser.newPage();
await page.setContent(html);
await page.pdf({ path: output, format: 'Letter', margin: { top: '0.9in', bottom: '0.9in', left: '1in', right: '1in' } });
await browser.close();
console.log(`wrote ${output}`);
