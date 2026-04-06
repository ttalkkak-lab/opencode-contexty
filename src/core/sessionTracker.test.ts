import { describe, it, expect, beforeEach } from 'bun:test';
import { sessionTracker, SessionTracker } from './sessionTracker';

describe('sessionTracker', () => {
  beforeEach(() => {
    sessionTracker.clearSessionId();
  });

  it('getSessionId returns undefined before any set', () => {
    const tracker = new SessionTracker();

    expect(tracker.getSessionId()).toBeUndefined();
  });

  it('setSessionId and getSessionId round-trip', () => {
    const tracker = new SessionTracker();

    tracker.setSessionId('ses_abc');

    expect(tracker.getSessionId()).toBe('ses_abc');
  });

  it('setSessionId overwrites previous value', () => {
    const tracker = new SessionTracker();

    tracker.setSessionId('ses_abc');
    tracker.setSessionId('ses_xyz');

    expect(tracker.getSessionId()).toBe('ses_xyz');
  });

  it('clearSessionId resets to undefined', () => {
    const tracker = new SessionTracker();

    tracker.setSessionId('ses_abc');
    tracker.clearSessionId();

    expect(tracker.getSessionId()).toBeUndefined();
  });

  it('SessionTracker can be instantiated independently', () => {
    const tracker = new SessionTracker();

    tracker.setSessionId('ses_independent');

    expect(tracker.getSessionId()).toBe('ses_independent');
    expect(sessionTracker.getSessionId()).toBeUndefined();
  });

  it('singleton sessionTracker is a SessionTracker instance', () => {
    expect(sessionTracker instanceof SessionTracker).toBe(true);
  });
});
