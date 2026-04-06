/// <reference types="bun-types" />

import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import * as path from 'path';
import * as fs from 'fs/promises';
import * as os from 'os';
import {
  readToolLog,
  appendToolLogEntry,
  writeToolLogBlacklist,
  type ToolPart,
  type ToolLogSpec,
} from '../hscmm/storage';
import { sessionTracker, SessionTracker } from '../core/sessionTracker';
import { PermissionStorage } from '../acpm/storage';

function makeToolPart(overrides?: Partial<ToolPart>): ToolPart {
  return {
    id: 'test-part-1',
    sessionID: 'ses_test',
    messageID: 'msg_test',
    type: 'tool',
    callID: 'call_test',
    tool: 'bash',
    state: {
      status: 'completed',
      input: { command: 'ls' },
      output: 'file1.txt\nfile2.txt',
      title: 'List files',
      metadata: {},
      time: { start: Date.now(), end: Date.now() },
    },
    ...overrides,
  };
}

describe('session isolation integration', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'contexty-integration-'));
    sessionTracker.clearSessionId();
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
    sessionTracker.clearSessionId();
  });

  it('two sessions write HSCMM data without cross-contamination', async () => {
    const entryA = makeToolPart({ id: 'part-a', sessionID: 'ses_abc' });
    const entryB = makeToolPart({ id: 'part-b', sessionID: 'ses_xyz' });

    await Promise.all([
      appendToolLogEntry(tempDir, 'ses_abc', entryA),
      appendToolLogEntry(tempDir, 'ses_xyz', entryB),
    ]);

    const specA = await readToolLog(tempDir, 'ses_abc');
    const specB = await readToolLog(tempDir, 'ses_xyz');

    expect(specA.parts).toHaveLength(1);
    expect(specA.parts[0].id).toBe('part-a');
    expect(specB.parts).toHaveLength(1);
    expect(specB.parts[0].id).toBe('part-b');
  });

  it('each session can have a different ACPM active preset', async () => {
    const storage = new PermissionStorage(tempDir);

    await storage.writeActivePreset('ses_abc', 'strict');
    await storage.writeActivePreset('ses_xyz', 'permissive');

    const presetA = await storage.readActivePreset('ses_abc');
    const presetB = await storage.readActivePreset('ses_xyz');

    expect(presetA).toBe('strict');
    expect(presetB).toBe('permissive');
  });

  it('concurrent atomic writes produce valid JSON', async () => {
    const filePath = path.join(tempDir, '.contexty', 'sessions', 'ses_test', 'tool-parts.json');
    await fs.mkdir(path.dirname(filePath), { recursive: true });

    const entries = Array.from({ length: 10 }, (_, i) => makeToolPart({ id: `concurrent-${i}` }));

    await Promise.all(entries.map((entry) => appendToolLogEntry(tempDir, 'ses_test', entry)));

    const raw = await fs.readFile(filePath, 'utf8');
    const parsed: ToolLogSpec = JSON.parse(raw);

    expect(Array.isArray(parsed.parts)).toBe(true);
    expect(parsed.parts.length).toBeGreaterThan(0);

    for (const part of parsed.parts) {
      expect(typeof part.id).toBe('string');
      expect(part.id.length).toBeGreaterThan(0);
    }
  });

  it('session tracker propagates across reads', async () => {
    const tracker = new SessionTracker();

    tracker.setSessionId('ses_propagation');
    expect(tracker.getSessionId()).toBe('ses_propagation');

    tracker.setSessionId('ses_new');
    expect(tracker.getSessionId()).toBe('ses_new');

    tracker.clearSessionId();
    expect(tracker.getSessionId()).toBeUndefined();
  });

  it('session files land in correct directory structure', async () => {
    const entry = makeToolPart({ id: 'struct-test' });

    await appendToolLogEntry(tempDir, 'ses_structure', entry);
    await writeToolLogBlacklist(tempDir, 'ses_structure', { ids: ['banned-id'] });

    const sessionsDir = path.join(tempDir, '.contexty', 'sessions');
    const sessionDir = path.join(sessionsDir, 'ses_structure');

    const stat = await fs.stat(sessionDir);
    expect(stat.isDirectory()).toBe(true);

    const partsStat = await fs.stat(path.join(sessionDir, 'tool-parts.json'));
    expect(partsStat.isFile()).toBe(true);

    const banStat = await fs.stat(path.join(sessionDir, 'tool-parts.blacklist.json'));
    expect(banStat.isFile()).toBe(true);

    const legacyPath = path.join(tempDir, '.contexty', 'tool-parts.json');
    expect(fs.access(legacyPath)).rejects.toThrow();
  });
});
