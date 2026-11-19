import { describe, expect, it } from 'vitest';
import { TOPICS } from '../../src/logic/topics';
import { classifyQuestion } from '../../src/question/classify';

describe('classifyQuestion', () => {
  it('routes every example question to its own topic', () => {
    for (const topic of TOPICS) {
      for (const example of topic.examples) {
        expect(classifyQuestion(example).topic, example).toBe(topic.id);
      }
    }
  });

  it('picks up tenant facts stated in the question', () => {
    expect(classifyQuestion("Can I break the lease early if I'm transferred?").tenant).toEqual([
      { name: 'job_transfer', value: true, source: 'question' },
    ]);
    expect(classifyQuestion('I got military orders. Can I end my lease early?').tenant).toContainEqual({
      name: 'military_orders',
      value: true,
      source: 'question',
    });
    expect(classifyQuestion('Can I keep my emotional support cat?')).toEqual({
      topic: 'pets',
      tenant: [{ name: 'assistance_animal', value: true, source: 'question' }],
    });
  });

  it('reads simple denials', () => {
    const t = classifyQuestion("I'm not in the military. Can I break my lease?").tenant;
    expect(t).toContainEqual({ name: 'military_orders', value: false, source: 'question' });
  });

  it('returns no topic for questions outside the rule base', () => {
    expect(classifyQuestion('Who won the 1927 World Series?').topic).toBeNull();
    expect(classifyQuestion('').topic).toBeNull();
  });
});
