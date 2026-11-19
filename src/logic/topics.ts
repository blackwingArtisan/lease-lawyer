/** The questions the rule base can prove. Each maps to the Prolog goal verdict(Topic, Verdict). */
export interface Topic {
  id: string;
  label: string;
  /** The question in canonical form, as the proof answers it. */
  question: string;
  examples: readonly string[];
}

export const TOPICS: readonly Topic[] = [
  {
    id: 'wear_and_tear',
    label: 'Deposit and wear and tear',
    question: 'Can the landlord keep part of my deposit for normal wear and tear?',
    examples: ['Can my landlord keep my deposit for normal wear and tear?', 'Can they charge my deposit for repainting and carpet cleaning?'],
  },
  {
    id: 'early_termination',
    label: 'Leaving early',
    question: 'Can I end my lease early?',
    examples: ["Can I break the lease early if I'm transferred?", 'Can I get out of my lease early?'],
  },
  {
    id: 'pets',
    label: 'Pets and assistance animals',
    question: 'Can I keep an animal in my home?',
    examples: ['Can I get a dog?', 'Can I keep my emotional support animal?'],
  },
  {
    id: 'entry_without_notice',
    label: 'Landlord entry',
    question: 'Can the landlord enter without notice?',
    examples: ['Can my landlord come in without telling me?', 'There is a burst pipe. Can the landlord enter without notice?'],
  },
  {
    id: 'late_fee',
    label: 'Late fees',
    question: 'Is the late fee in my lease enforceable?',
    examples: ['Is my late fee legal?', 'Can they charge a late fee the day after rent is due?'],
  },
  {
    id: 'sublet',
    label: 'Subletting',
    question: 'Can I sublet my home?',
    examples: ['Can I sublet my apartment for the summer?', 'Can I sublease to a friend?'],
  },
  {
    id: 'repair_and_deduct',
    label: 'Repairs',
    question: 'Can I pay for a repair myself and deduct it from rent?',
    examples: ['My heat is broken and the landlord ignores me. Can I fix it and deduct it from rent?', 'Can I take the repair cost out of my rent?'],
  },
  {
    id: 'rent_increase',
    label: 'Rent increases',
    question: 'Can the landlord raise my rent before the lease ends?',
    examples: ['Can my landlord raise the rent in the middle of my lease?', 'Can they increase my rent this year?'],
  },
];

export function topicById(id: string): Topic | undefined {
  return TOPICS.find((t) => t.id === id);
}
