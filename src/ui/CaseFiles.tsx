import { useRef, useState } from 'react';
import { SAMPLE_LEASES } from '../lease/fixtures';
import type { LeaseSource } from './useLeaseLawyer';

interface Props {
  selected: string | null;
  onPick: (source: LeaseSource) => void;
}

const MAX_BYTES = 200_000;

/** The sample leases as case files, plus upload or paste for your own. */
export function CaseFiles({ selected, onPick }: Props) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [pasting, setPasting] = useState(false);
  const [pasted, setPasted] = useState('');
  const [problem, setProblem] = useState<string | null>(null);

  const readFile = async (file: File) => {
    setProblem(null);
    if (file.size > MAX_BYTES) {
      setProblem('That file is over 200 KB. Paste the lease text instead.');
      return;
    }
    if (!/\.txt$|\.text$/i.test(file.name) && file.type && !file.type.startsWith('text/')) {
      setProblem('Plain-text leases only for now (.txt). Copy the text out of a PDF and paste it.');
      return;
    }
    const text = await file.text();
    onPick({ id: 'upload', name: file.name.replace(/\.[^.]+$/, ''), text });
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
              <button type="button" className="chip" onClick={() => fileInput.current?.click()}>
                Upload .txt
              </button>
              <button type="button" className="chip" aria-expanded={pasting} onClick={() => setPasting((p) => !p)}>
                Paste text
              </button>
            </span>
            <input
              ref={fileInput}
              type="file"
              accept=".txt,text/plain"
              className="visually-hidden"
              tabIndex={-1}
              data-testid="upload"
              aria-label="Upload a lease as a text file"
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
            onPick({ id: 'paste', name: 'Pasted lease', text: pasted.slice(0, MAX_BYTES) });
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
