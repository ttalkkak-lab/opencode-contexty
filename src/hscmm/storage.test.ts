/// <reference types="bun-types" />

import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import * as path from 'path';
import * as fs from 'fs/promises';
import * as os from 'os';
import {
  appendToolLogEntry,
  readToolLog,
  readToolLogBlacklist,
  writeToolLog,
  writeToolLogBlacklist,
  sessionsBaseDir,
  sessionPath,
  ensureSessionDir,
  type ToolPart,
  type ToolLogSpec,
  type ToolLogBlacklist,
} from './storage';

function makeTestToolPart(overrides?: Partial<ToolPart>): ToolPart {
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

describe('hscmm storage', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'contexty-hscmm-'));
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('returns an empty tool log when the file is missing', async () => {
    expect(readToolLog(tempDir, 'ses_test')).resolves.toEqual({ parts: [] });
  });

  it('reads a valid tool log from disk', async () => {
    const spec: ToolLogSpec = { parts: [makeTestToolPart()] };
    await fs.mkdir(path.join(tempDir, '.contexty', 'sessions', 'ses_test'), { recursive: true });
    await fs.writeFile(
      path.join(tempDir, '.contexty', 'sessions', 'ses_test', 'tool-parts.json'),
      JSON.stringify(spec, null, 2),
      'utf8'
    );

    expect(readToolLog(tempDir, 'ses_test')).resolves.toEqual(spec);
  });

  it('returns an empty tool log for corrupted JSON', async () => {
    await fs.mkdir(path.join(tempDir, '.contexty', 'sessions', 'ses_test'), { recursive: true });
    await fs.writeFile(path.join(tempDir, '.contexty', 'sessions', 'ses_test', 'tool-parts.json'), '{not-json', 'utf8');

    expect(readToolLog(tempDir, 'ses_test')).resolves.toEqual({ parts: [] });
  });

  it('returns an empty tool log when parts is not an array', async () => {
    await fs.mkdir(path.join(tempDir, '.contexty', 'sessions', 'ses_test'), { recursive: true });
    await fs.writeFile(
      path.join(tempDir, '.contexty', 'sessions', 'ses_test', 'tool-parts.json'),
      JSON.stringify({ parts: { not: 'an array' } }),
      'utf8'
    );

    expect(readToolLog(tempDir, 'ses_test')).resolves.toEqual({ parts: [] });
  });

  it('writes and reads a tool log round-trip', async () => {
    const spec: ToolLogSpec = { parts: [makeTestToolPart()] };

    await writeToolLog(tempDir, 'ses_test', spec);

    const written = JSON.parse(
      await fs.readFile(path.join(tempDir, '.contexty', 'sessions', 'ses_test', 'tool-parts.json'), 'utf8')
    );
    expect(written).toEqual(spec);
    expect(readToolLog(tempDir, 'ses_test')).resolves.toEqual(spec);
  });

  it('creates the .contexty directory when writing tool logs', async () => {
    const spec: ToolLogSpec = { parts: [makeTestToolPart()] };

    await writeToolLog(tempDir, 'ses_test', spec);

    const stat = await fs.stat(path.join(tempDir, '.contexty', 'sessions', 'ses_test'));
    expect(stat.isDirectory()).toBe(true);
  });

  it('appends to an empty tool log', async () => {
    const entry = makeTestToolPart();

    await appendToolLogEntry(tempDir, 'ses_test', entry);

    expect(readToolLog(tempDir, 'ses_test')).resolves.toEqual({ parts: [entry] });
  });

  it('appends multiple tool log entries', async () => {
    const first = makeTestToolPart({ id: 'part-1', callID: 'call-1' });
    const second = makeTestToolPart({ id: 'part-2', callID: 'call-2', messageID: 'msg_2' });

    await appendToolLogEntry(tempDir, 'ses_test', first);
    await appendToolLogEntry(tempDir, 'ses_test', second);

    expect(readToolLog(tempDir, 'ses_test')).resolves.toEqual({ parts: [first, second] });
  });

  it('preserves existing entries when appending', async () => {
    const first = makeTestToolPart({ id: 'part-1', callID: 'call-1' });
    const second = makeTestToolPart({ id: 'part-2', callID: 'call-2' });
    const existing: ToolLogSpec = { parts: [first] };

    await writeToolLog(tempDir, 'ses_test', existing);
    await appendToolLogEntry(tempDir, 'ses_test', second);

    expect(readToolLog(tempDir, 'ses_test')).resolves.toEqual({ parts: [first, second] });
  });

  it('returns an empty blacklist when the file is missing', async () => {
    expect(readToolLogBlacklist(tempDir, 'ses_test')).resolves.toEqual({ ids: [] });
  });

  it('reads a valid blacklist from disk', async () => {
    const spec: ToolLogBlacklist = { ids: ['part-1', 'part-2'] };
    await fs.mkdir(path.join(tempDir, '.contexty', 'sessions', 'ses_test'), { recursive: true });
    await fs.writeFile(
      path.join(tempDir, '.contexty', 'sessions', 'ses_test', 'tool-parts.blacklist.json'),
      JSON.stringify(spec, null, 2),
      'utf8'
    );

    expect(readToolLogBlacklist(tempDir, 'ses_test')).resolves.toEqual(spec);
  });

  it('returns an empty blacklist for corrupted JSON', async () => {
    await fs.mkdir(path.join(tempDir, '.contexty', 'sessions', 'ses_test'), { recursive: true });
    await fs.writeFile(
      path.join(tempDir, '.contexty', 'sessions', 'ses_test', 'tool-parts.blacklist.json'),
      '{not-json',
      'utf8'
    );

    expect(readToolLogBlacklist(tempDir, 'ses_test')).resolves.toEqual({ ids: [] });
  });

  it('writes and reads a blacklist round-trip', async () => {
    const spec: ToolLogBlacklist = { ids: ['part-1', 'part-2'] };

    await writeToolLogBlacklist(tempDir, 'ses_test', spec);

    expect(readToolLogBlacklist(tempDir, 'ses_test')).resolves.toEqual(spec);
  });

  it('two sessions writing simultaneously don\'t interfere', async () => {
    const spec: ToolLogSpec = { parts: [makeTestToolPart({ id: 'part-a' })] };

    await writeToolLog(tempDir, 'ses_abc', spec);

    expect(readToolLog(tempDir, 'ses_abc')).resolves.toEqual(spec);
    expect(readToolLog(tempDir, 'ses_xyz')).resolves.toEqual({ parts: [] });
  });
});

describe('Session path resolution', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'contexty-session-'));
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('sessionsBaseDir returns correct path', () => {
    expect(sessionsBaseDir('/workspace')).toBe('/workspace/.contexty/sessions');
    expect(sessionsBaseDir('/home/user/project')).toBe('/home/user/project/.contexty/sessions');
  });

  it('sessionPath returns correct path', () => {
    expect(sessionPath('/workspace', 'ses_abc', 'tool-parts.json')).toBe(
      '/workspace/.contexty/sessions/ses_abc/tool-parts.json'
    );
    expect(sessionPath('/workspace', 'ses_xyz', 'active-preset.json')).toBe(
      '/workspace/.contexty/sessions/ses_xyz/active-preset.json'
    );
  });

  it('sessionPath throws on empty sessionId', () => {
    expect(() => sessionPath('/workspace', '', 'tool-parts.json')).toThrow(
      'sessionId must be a non-empty string'
    );
  });

  it('sessionPath throws on whitespace-only sessionId', () => {
    expect(() => sessionPath('/workspace', '   ', 'tool-parts.json')).toThrow(
      'sessionId must be a non-empty string'
    );
  });

  it('sessionPath handles special characters in sessionId', () => {
    expect(() => sessionPath('/workspace', 'ses_abc-123_def.test', 'file.json')).not.toThrow();
  });

  it('ensureSessionDir creates directory', async () => {
    await ensureSessionDir(tempDir, 'ses_test');
    const dirPath = path.join(tempDir, '.contexty', 'sessions', 'ses_test');
    const stat = await fs.stat(dirPath);
    expect(stat.isDirectory()).toBe(true);
  });
});
