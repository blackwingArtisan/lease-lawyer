import wychwood from './fixtures/wychwood-arms.txt?raw';
import gaslight from './fixtures/gaslight-row.txt?raw';
import cobweb from './fixtures/cobweb-court.txt?raw';
import hollowmere from './fixtures/hollowmere-flats.txt?raw';

export interface SampleLease {
  id: string;
  name: string;
  blurb: string;
  text: string;
}

/** Four invented residential leases. Every name, address and number is fictional. */
export const SAMPLE_LEASES: readonly SampleLease[] = [
  {
    id: 'wychwood-arms',
    name: 'Wychwood Arms Apartments',
    blurb: 'A careful lease: job-relocation exit, no pets, consent to sublet.',
    text: wychwood,
  },
  {
    id: 'gaslight-row',
    name: 'Gaslight Row Townhomes',
    blurb: 'A greedy lease: wear-and-tear charges, 12-hour entry, a repair waiver.',
    text: gaslight,
  },
  {
    id: 'cobweb-court',
    name: 'Cobweb Court',
    blurb: 'A thin lease: silent on pets, subletting and leaving early.',
    text: cobweb,
  },
  {
    id: 'hollowmere-flats',
    name: 'Hollowmere Flats',
    blurb: 'Try to make it lie: a pets rider, an exhibit, "at any time" entry, a double negative.',
    text: hollowmere,
  },
];
