import { readFile } from 'node:fs/promises';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { describe, expect, it } from 'vitest';
import { extractFacts } from '../../src/lease/extract';
import { parseLease } from '../../src/lease/parse';
import { pdfRunsToText, toRuns, type PdfRun } from '../../src/lease/pdfText';
import { verifyFacts } from '../../src/lease/verify';
import { sample } from './helpers';

const run = (str: string, y: number, hasEOL = true): PdfRun => ({ str, y, height: 11, hasEOL });

describe('pdfRunsToText', () => {
  it('reflows a sentence wrapped across lines and splits paragraphs at wider gaps', () => {
    const text = pdfRunsToText([
      [
        run('TOWNHOME LEASE', 760),
        run('6. SECURITY DEPOSIT. Tenant shall pay a security deposit of', 720),
        run('$3,600.00 before move-in.', 704),
        run('7. PETS. Pets are permitted.', 670),
      ],
    ]);
    expect(text).toBe('TOWNHOME LEASE\n\n6. SECURITY DEPOSIT. Tenant shall pay a security deposit of $3,600.00 before move-in.\n\n7. PETS. Pets are permitted.');
  });

  it('starts a new paragraph at a numbered heading even with ordinary line spacing', () => {
    const text = pdfRunsToText([[run('1. RENT. Rent is $900.00 monthly.', 700), run('2. TERM. Month to month.', 684)]]);
    expect(text).toBe('1. RENT. Rent is $900.00 monthly.\n\n2. TERM. Month to month.');
  });

  it('joins runs on one line and starts each page as a new paragraph', () => {
    const text = pdfRunsToText([[run('3. RENT. ', 700, false), run('Rent is $900.00 monthly.', 700)], [run('continued on page two.', 760)]]);
    expect(text).toBe('3. RENT. Rent is $900.00 monthly.\n\ncontinued on page two.');
  });

  it('returns nothing for a page with no text, such as a scan', () => {
    expect(pdfRunsToText([[]])).toBe('');
  });
});

describe('the sample lease PDF', () => {
  it('reads to the same facts as the plain-text sample', async () => {
    const data = new Uint8Array(await readFile('public/samples/gaslight-row-townhomes.pdf'));
    const task = getDocument({ data, useSystemFonts: false, disableFontFace: true });
    const doc = await task.promise;
    const pages: PdfRun[][] = [];
    for (let n = 1; n <= doc.numPages; n++) pages.push(toRuns((await (await doc.getPage(n)).getTextContent()).items));
    await task.destroy();

    const lease = parseLease('pdf', pdfRunsToText(pages));
    const fromPdf = verifyFacts(lease, extractFacts(lease));
    const summary = (facts: typeof fromPdf.facts) => facts.map((f) => `${f.predicate}(${f.args.join(',')})@${f.clauseId}`);
    expect(summary(fromPdf.facts)).toEqual(summary(sample('gaslight-row').facts));
    expect(fromPdf.rejected).toEqual([]);
    expect(fromPdf.unread).toEqual([]);
  });
});
