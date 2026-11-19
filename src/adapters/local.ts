import { extractFacts } from '../lease/extract';
import { classifyQuestion } from '../question/classify';
import type { LeaseReader, QuestionTranslator } from './types';

/** Free, offline reader: the rule-based extractor. */
export const localLeaseReader: LeaseReader = {
  name: 'Rule-based reader (local)',
  read: async (lease) => extractFacts(lease),
};

/** Free, offline translator: the keyword classifier. */
export const localQuestionTranslator: QuestionTranslator = {
  name: 'Keyword classifier (local)',
  translate: async (question) => classifyQuestion(question),
};
