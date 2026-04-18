import { describe, test, expect, beforeEach, afterEach, mock } from 'bun:test';
import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs/promises';
import { createBanCommandHook } from './commandExecuteBefore.hscmm';
import { writeToolLog, readToolLogBlacklist, type ToolPart } from '../hscmm';

function makePart(id: string, filePath: string): ToolPart {
  const now = Date.now();
  return {
    id,
    sessionID: 'ses_test',
    messageID: 'msg_test',
    type: 'tool',
    callID: `call_${id}`,
    tool: 'read',
    state: {
      status: 'completed',
      input: { filePath },
      output: 'content',
      title: filePath,
      metadata: {},
      time: {
        start: now,
        end: now,
      },
    },
  };
}

describe('createBanCommandHook', () => {
  let tempDir: string;
  let promptMock: ReturnType<typeof mock>;

  function createPluginInput() {
    promptMock = mock(async () => undefined);
    return {
      directory: tempDir,
      client: {
        session: {
          prompt: promptMock,
        },
      },
    } as any;
  }

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'contexty-ban-'));
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  test('adds matching part ids to blacklist for /ban @path', async () => {
    const sessionID = 'ses_test';
    await writeToolLog(tempDir, sessionID, {
      parts: [
        makePart('part-a', path.join(tempDir, 'src/app.ts')),
        makePart('part-b', path.join(tempDir, 'docs/readme.md')),
      ],
    });

    const hook = createBanCommandHook(createPluginInput());

    await expect(hook?.({ command: 'ban', arguments: '@src/app.ts', sessionID } as any, {} as any)).rejects.toThrow(
      '__BAN_HANDLED__'
    );

    await expect(readToolLogBlacklist(tempDir, sessionID)).resolves.toEqual({ ids: ['part-a'] });
    expect(promptMock).toHaveBeenCalledTimes(1);
    expect(promptMock.mock.calls[0]?.[0]).toMatchObject({
      path: { id: sessionID },
      body: {
        noReply: true,
        parts: [{ type: 'text', ignored: true }],
      },
    });
  });

  test('supports directory target from command arguments and preserves existing ids', async () => {
    const sessionID = 'ses_test';
    await writeToolLog(tempDir, sessionID, {
      parts: [
        makePart('part-a', path.join(tempDir, 'src/app.ts')),
        makePart('part-b', path.join(tempDir, 'src/lib/util.ts')),
        makePart('part-c', path.join(tempDir, 'docs/readme.md')),
      ],
    });

    const hook = createBanCommandHook(createPluginInput());

    await expect(hook?.({ command: 'ban', arguments: '@src', sessionID } as any, {} as any)).rejects.toThrow(
      '__BAN_HANDLED__'
    );

    await expect(readToolLogBlacklist(tempDir, sessionID)).resolves.toEqual({ ids: ['part-a', 'part-b'] });
    expect(promptMock).toHaveBeenCalledTimes(1);
  });

  test('returns usage when no target path is provided', async () => {
    const hook = createBanCommandHook(createPluginInput());

    await expect(hook?.({ command: 'ban', arguments: '', sessionID: 'ses_test' } as any, {} as any)).rejects.toThrow(
      '__BAN_HANDLED__'
    );

    expect(promptMock).toHaveBeenCalledTimes(1);
    expect(promptMock.mock.calls[0]?.[0]).toMatchObject({
      body: {
        noReply: true,
        parts: [{ text: 'Usage: /ban @<file-or-directory-path>', ignored: true }],
      },
    });
  });

  test('ignores unrelated commands', async () => {
    const hook = createBanCommandHook(createPluginInput());

    await expect(hook?.({ command: 'tls', arguments: '', sessionID: 'ses_test' } as any, {} as any)).resolves.toBeUndefined();

    expect(promptMock).not.toHaveBeenCalled();
  });

  test('returns not-found guidance when no matching tool parts exist', async () => {
    const sessionID = 'ses_test';
    await writeToolLog(tempDir, sessionID, {
      parts: [makePart('part-a', path.join(tempDir, 'docs/readme.md'))],
    });

    const hook = createBanCommandHook(createPluginInput());

    await expect(
      hook?.({ command: 'ban', arguments: '@src/hooks/command-execute-before.ban.ts', sessionID } as any, {} as any)
    ).rejects.toThrow('__BAN_HANDLED__');

    expect(promptMock).toHaveBeenCalledTimes(1);
    expect(promptMock.mock.calls[0]?.[0]).toMatchObject({
      body: {
        noReply: true,
        parts: [
          {
            ignored: true,
            text: 'No matching tool parts were found in this session for @src/hooks/command-execute-before.ban.ts. Read/edit that file in this session first, then run /ban again.',
          },
        ],
      },
    });
  });

  test('returns already-blacklisted message when all matches are already banned', async () => {
    const sessionID = 'ses_test';
    await writeToolLog(tempDir, sessionID, {
      parts: [makePart('part-a', path.join(tempDir, 'src/app.ts'))],
    });

    const hook = createBanCommandHook(createPluginInput());

    await expect(hook?.({ command: 'ban', arguments: '@src/app.ts', sessionID } as any, {} as any)).rejects.toThrow(
      '__BAN_HANDLED__'
    );
    await expect(hook?.({ command: 'ban', arguments: '@src/app.ts', sessionID } as any, {} as any)).rejects.toThrow(
      '__BAN_HANDLED__'
    );

    expect(promptMock).toHaveBeenCalledTimes(2);
    expect(promptMock.mock.calls[1]?.[0]).toMatchObject({
      body: {
        noReply: true,
        parts: [{ ignored: true, text: 'All matching part ids for @src/app.ts are already blacklisted.' }],
      },
    });
  });
});
