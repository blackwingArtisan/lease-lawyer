import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Adapters, LeaseReader } from '../adapters/types';
import { localLeaseReader } from '../adapters/local';
import { redTeamLeaseReader } from '../adapters/redTeam';
import { redTeamFixture } from '../lease/redTeam';
import { parseLease } from '../lease/parse';
import type { ParsedLease, VerificationResult } from '../lease/types';
import { verifyFacts } from '../lease/verify';
import { ask, type Answer } from '../logic/ask';
import type { TenantAnswer } from '../logic/program';

export interface LeaseSource {
  id: string;
  name: string;
  text: string;
  /** Id of a red-team fixture (src/lease/redTeam.ts). Set only by a sample lease that carries one. */
  redTeam?: string;
}

export type Status = 'idle' | 'reading' | 'thinking' | 'ready' | 'error';

export interface LabState {
  lease: ParsedLease | null;
  verification: VerificationResult | null;
  /** Name of the reader that produced the current facts. */
  readerName: string;
  status: Status;
  error: string | null;
  question: string;
  answer: Answer | null;
  /** The question did not match any topic in the rule base. */
  outOfScope: boolean;
  tenant: TenantAnswer[];
}

/** All app state and actions: read a lease, ask a question, answer follow-ups. */
export function useLeaseLawyer(adapters: Adapters) {
  const [lease, setLease] = useState<ParsedLease | null>(null);
  const [verification, setVerification] = useState<VerificationResult | null>(null);
  const [readerName, setReaderName] = useState(adapters.reader.name);
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState<string | null>(null);
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState<Answer | null>(null);
  const [outOfScope, setOutOfScope] = useState(false);
  const [questionFacts, setQuestionFacts] = useState<TenantAnswer[]>([]);
  const [followUps, setFollowUps] = useState<TenantAnswer[]>([]);
  const [topic, setTopic] = useState<string | null>(null);
  const run = useRef(0);

  const tenant = useMemo(() => {
    const byName = new Map<string, TenantAnswer>();
    for (const t of questionFacts) byName.set(t.name, t);
    for (const t of followUps) byName.set(t.name, t);
    return [...byName.values()];
  }, [questionFacts, followUps]);

  const loadLease = useCallback(
    async (source: LeaseSource) => {
      const id = ++run.current;
      setStatus('reading');
      setError(null);
      setAnswer(null);
      setOutOfScope(false);
      setFollowUps([]);
      const parsed = parseLease(source.id, source.text, source.name);
      setLease(parsed);
      setVerification(null);
      try {
        // A sample that carries a red-team fixture is read by the local reader plus that fixture's
        // recorded candidates: no network call and no Bedrock, whichever backend is configured.
        const fixture = source.redTeam ? redTeamFixture(source.redTeam) : undefined;
        const reader: LeaseReader = fixture ? redTeamLeaseReader(localLeaseReader, fixture) : adapters.reader;
        setReaderName(reader.name);
        const candidates = await reader.read(parsed);
        if (id !== run.current) return;
        setVerification(verifyFacts(parsed, candidates));
        setStatus('ready');
      } catch (e) {
        if (id !== run.current) return;
        setError(e instanceof Error ? e.message : String(e));
        setStatus('error');
      }
    },
    [adapters],
  );

  const prove = useCallback(
    async (topicId: string, tenantFacts: TenantAnswer[]) => {
      if (!verification) return;
      const id = ++run.current;
      setStatus('thinking');
      try {
        const result = await ask({ topic: topicId, facts: verification.facts, tenant: tenantFacts, unread: verification.unread });
        if (id !== run.current) return;
        setAnswer(result);
        setStatus('ready');
      } catch (e) {
        if (id !== run.current) return;
        setError(e instanceof Error ? e.message : String(e));
        setStatus('error');
      }
    },
    [verification],
  );

  const askQuestion = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || !verification) return;
      setQuestion(trimmed);
      setError(null);
      setFollowUps([]);
      setStatus('thinking');
      let translation;
      try {
        translation = await adapters.translator.translate(trimmed);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
        setStatus('error');
        return;
      }
      setQuestionFacts(translation.tenant);
      setTopic(translation.topic);
      if (!translation.topic) {
        setAnswer(null);
        setOutOfScope(true);
        setStatus('ready');
        return;
      }
      setOutOfScope(false);
      await prove(translation.topic, translation.tenant);
    },
    [adapters, verification, prove],
  );

  const answerFollowUp = useCallback(
    async (name: string, value: boolean) => {
      if (!topic) return;
      const next = [...followUps.filter((f) => f.name !== name), { name, value, source: 'answer' as const }];
      setFollowUps(next);
      const merged = new Map<string, TenantAnswer>();
      for (const t of questionFacts) merged.set(t.name, t);
      for (const t of next) merged.set(t.name, t);
      await prove(topic, [...merged.values()]);
    },
    [topic, followUps, questionFacts, prove],
  );

  // Re-prove the current question when the lease changes under it.
  const lastVerification = useRef<VerificationResult | null>(null);
  useEffect(() => {
    if (verification && verification !== lastVerification.current && topic && answer === null && !outOfScope && question) {
      void prove(topic, tenant);
    }
    lastVerification.current = verification;
  }, [verification, topic, answer, outOfScope, question, tenant, prove]);

  const state: LabState = { lease, verification, readerName, status, error, question, answer, outOfScope, tenant };
  return { state, loadLease, askQuestion, answerFollowUp };
}
