import { describe, expect, it } from 'vitest';
import { parseLease, sentences } from '../../src/lease/parse';

const TEXT = `SAMPLE LEASE
Hollow Pines

1. RENT. Monthly rent is $1,850.00, due on the first day. Rent is paid online.

2. LANDLORD'S ENTRY. Landlord gives notice.
3. PETS. No pets.`;

describe('parseLease', () => {
  it('splits numbered sections into clauses with exact offsets', () => {
    const lease = parseLease('t', TEXT);
    expect(lease.clauses.map((c) => [c.id, c.title])).toEqual([
      ['s1', 'RENT'],
      ['s2', "LANDLORD'S ENTRY"],
      ['s3', 'PETS'],
    ]);
    const rent = lease.clauses[0]!;
    expect(lease.text.slice(rent.start, rent.end)).toBe('1. RENT. Monthly rent is $1,850.00, due on the first day. Rent is paid online.');
  });

  it('takes the second preamble line as the lease name', () => {
    expect(parseLease('t', TEXT).name).toBe('Hollow Pines');
  });

  it('normalizes Windows line endings', () => {
    const lease = parseLease('t', TEXT.replace(/\n/g, '\r\n'));
    expect(lease.text.includes('\r')).toBe(false);
    expect(lease.clauses).toHaveLength(3);
  });

  it('gives duplicate section numbers distinct ids', () => {
    const lease = parseLease('t', '1. RENT. A.\n\n1. RENT. B.');
    expect(lease.clauses.map((c) => c.id)).toEqual(['s1', 's1_2']);
  });

  it('returns no clauses for unnumbered text', () => {
    expect(parseLease('t', 'Just a letter with no sections.').clauses).toEqual([]);
  });
});

describe('sentences', () => {
  it('does not split on the decimal point in a dollar amount and skips the heading', () => {
    const lease = parseLease('t', TEXT);
    const s = sentences(lease, lease.clauses[0]!);
    expect(s.map((x) => x.text)).toEqual(['Monthly rent is $1,850.00, due on the first day.', 'Rent is paid online.']);
    for (const x of s) expect(lease.text.slice(x.start, x.end)).toBe(x.text);
  });
});
