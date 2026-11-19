import { useRef, useState } from 'react';
import { SAMPLE_LEASES } from '../lease/fixtures';
import { readPdfText } from '../lease/pdf';
import type { LeaseSource } from './useLeaseLawyer';

interface Props {
  selected: string | null;
  onPick: (source: LeaseSource) => void;
}

/** The most lease text the reader takes, from any source. */
export const MAX_TEXT_BYTES = 200_000;
const MAX_PDF_BYTES = 5_000_000;
const tooLong = (text: string) => new TextEncoder().encode(text).length > MAX_TEXT_BYTES;

/** The sample leases as case files, plus upload or paste for your own. */
export function CaseFiles({ selected, onPick }: Props) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [pasting, setPasting] = useState(false);
  const [pasted, setPasted] = useState('');
  const [problem, setProblem] = useState<string | null>(null);
  const [readingPdf, setReadingPdf] = useState(false);

  const readFile = async (file: File) => {
    setProblem(null);
    const name = file.name.replace(/\.[^.]+$/, '');
    if (/\.pdf$/i.test(file.name) || file.type === 'application/pdf') {
      if (file.size > MAX_PDF_BYTES) {
        setProblem('That PDF is over 5 MB. Upload a smaller copy, or paste the lease text instead.');
        return;
      }
      setReadingPdf(true);
      try {
        const { text, pages } = await readPdfText(await file.arrayBuffer());
        if (!text.trim()) {
          setProblem(`That PDF has no text to read (${pages} page${pages === 1 ? '' : 's'}); it may be a scan. Paste the lease text instead.`);
          return;
        }
        if (tooLong(text)) {
          setProblem('The text of that PDF is over 200 KB, more than one lease. Upload just the lease, or paste the part you need.');
          return;
        }
        onPick({ id: 'upload', name, text });
      } catch {
        setProblem('That PDF could not be read. It may be damaged or password-protected. Paste the lease text instead.');
      } finally {
        setReadingPdf(false);
      }
      return;
    }
    if (file.size > MAX_TEXT_BYTES) {
      setProblem('That file is over 200 KB. Paste the lease text instead.');
      return;
    }
    if (!/\.txt$|\.text$/i.test(file.name) && file.type && !file.type.startsWith('text/')) {
      setProblem('PDF or plain-text leases only (.pdf or .txt).');
      return;
    }
    const text = await file.text();
    onPick({ id: 'upload', name, text });
  };

  return (
    <div className="case-files">
      <ul className="case-grid" role="list">
        {SAMPLE_LEASES.map((s, i) => (
          <li key={s.id}>
            <button
              type="button"
              className="case"
              aria-pressed={selected === s.id}
              data-testid={`lease-${s.id}`}
              onClick={() => onPick({ id: s.id, name: s.name, text: s.text })}
            >
              <span className="case-tab">Case No. {String(i + 1).padStart(3, '0')}</span>
              <span className="case-name">{s.name}</span>
              <span className="case-blurb">{s.blurb}</span>
            </button>
          </li>
        ))}
        <li>
          <div className={`case case-own ${selected === 'upload' || selected === 'paste' ? 'is-on' : ''}`}>
            <span className="case-tab">Your own</span>
            <span className="case-name">Bring a lease</span>
            <span className="case-actions">
              <button type="button" className="chip" disabled={readingPdf} onClick={() => fileInput.current?.click()}>
                {readingPdf ? 'Reading PDF…' : 'Upload PDF or .txt'}
              </button>
              <button type="button" className="chip" aria-expanded={pasting} onClick={() => setPasting((p) => !p)}>
                Paste text
              </button>
            </span>
            <a className="sample-pdf" href="samples/gaslight-row-townhomes.pdf" download>
              Get a sample lease PDF
            </a>
            <input
              ref={fileInput}
              type="file"
              accept=".pdf,.txt,application/pdf,text/plain"
              className="visually-hidden"
              tabIndex={-1}
              data-testid="upload"
              aria-label="Upload a lease as a PDF or text file"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void readFile(f);
                e.target.value = '';
              }}
            />
          </div>
        </li>
      </ul>
      {problem && (
        <p className="error" role="alert">
          {problem}
        </p>
      )}
      {pasting && (
        <form
          className="paste"
          onSubmit={(e) => {
            e.preventDefault();
            if (!pasted.trim()) return;
            // Never cut a lease short without saying so: dropped clauses would look like a silent lease.
            if (tooLong(pasted)) {
              setProblem('That text is over 200 KB, more than one lease. Paste just the lease.');
              return;
            }
            setProblem(null);
            onPick({ id: 'paste', name: 'Pasted lease', text: pasted });
            setPasting(false);
          }}
        >
          <label htmlFor="paste-text">Lease text, with numbered sections such as &ldquo;6. SECURITY DEPOSIT.&rdquo;</label>
          <textarea id="paste-text" rows={8} value={pasted} onChange={(e) => setPasted(e.target.value)} />
          <button type="submit" className="lever small">
            Read this lease
          </button>
        </form>
      )}
    </div>
  );
}
