import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resolveSessionId } from './transformer';
import { sessionTracker } from '../core/sessionTracker';
import type { WithParts } from '../dcp/types';

function makeMessage(sessionID?: string): WithParts {
  return {
    info: {
      id: 'msg-1',
      role: 'assistant',
      sessionID,
      time: { created: Date.now() },
    },
    parts: [],
  } as WithParts;
}

describe('resolveSessionId', () => {
  beforeEach(() => {
    sessionTracker.clearSessionId();
  });

  afterEach(() => {
    sessionTracker.clearSessionId();
  });

  it('tracker-first prefers the tracked session over message session IDs', async () => {
    sessionTracker.setSessionId('ses_tracker');

    const resolved = await resolveSessionId([makeMessage('ses_message')]);

    expect(resolved).toBe('ses_tracker');
  });

  it('message fallback uses the message session ID when tracker is empty', async () => {
    const resolved = await resolveSessionId([makeMessage('ses_message')]);

    expect(resolved).toBe('ses_message');
  });

  it('no-client-fallback returns null when tracker and messages are empty', async () => {
    const resolved = await resolveSessionId([makeMessage()]);

    expect(resolved).toBeNull();
  });

  it('tracker-wins-over-message returns the tracker even when messages have a session ID', async () => {
    sessionTracker.setSessionId('ses_tracker');

    const resolved = await resolveSessionId([makeMessage('ses_message')]);

    expect(resolved).toBe('ses_tracker');
  });
});
