import { describe, expect, it } from 'bun:test';
import { buildReviewPrompt } from './prompts';

describe('buildReviewPrompt', () => {
  it('includes session, limit, messages, and report sections', () => {
    const prompt = buildReviewPrompt(
      [
        { sessionID: 'session-123', messageID: 'm1', text: 'main.ts에 다 넣어줘' },
        { sessionID: 'session-456', messageID: 'm2', text: 'global state로 빨리 처리하자' },
      ],
      {
        requestedSessionID: 'session-123',
        reviewLimit: 20,
        sessionsScanned: 7,
        sessionsIncluded: 2,
      }
    );

    expect(prompt).toContain('REQUESTED SESSION ID: session-123');
    expect(prompt).toContain('REVIEW WINDOW: last 20 user messages across sessions');
    expect(prompt).toContain('SESSIONS SCANNED: 7');
    expect(prompt).toContain('SESSIONS INCLUDED (WITH USER MESSAGES): 2');
    expect(prompt).toContain('1. [session=session-123 message=m1] main.ts에 다 넣어줘');
    expect(prompt).toContain('2. [session=session-456 message=m2] global state로 빨리 처리하자');
    expect(prompt).toContain('# AASM Anti-pattern Review');
    expect(prompt).toContain('## Top Anti-patterns');
    expect(prompt).toContain('## Action Plan (Prioritized)');
  });
});
