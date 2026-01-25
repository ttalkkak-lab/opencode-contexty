import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import * as path from 'path';
import * as fs from 'fs/promises';
import * as os from 'os';
import { createHSCMMTransformHook } from './transformer';

describe('HSCMM Transformer', () => {
  let tempDir: string;
  let hook: ReturnType<typeof createHSCMMTransformHook>;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'contexty-test-'));
    hook = createHSCMMTransformHook(tempDir);
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('should extract tool parts from messages and persist them', async () => {
    const messageID = 'msg-1';
    const toolPart = {
      type: 'tool',
      id: 'tool-1',
      messageID,
      metadata: { contexty: { source: 'original' } },
      tool: 'test-tool',
      state: { status: 'completed', input: {} },
    };

    const input = {};
    const output = {
      messages: [
        {
          info: { id: messageID, role: 'assistant' },
          parts: [toolPart],
        },
      ],
    };

    await hook(input, output);

    // Check if file was created
    const logPath = path.join(tempDir, '.contexty', 'tool-parts.json');
    const content = JSON.parse(await fs.readFile(logPath, 'utf-8'));

    expect(content.parts).toHaveLength(1);
    expect(content.parts[0].id).toBe('tool-1');

    // Check if part was removed from message (it should be, then re-injected)
    // Wait, the hook removes them and then re-injects them.
    // So output.messages[0].parts should contain the part, but with modified metadata.

    expect(output.messages[0].parts).toHaveLength(1);
    expect(output.messages[0].parts[0].metadata.contexty.source).toBe('tool-log');
  });

  it('should deduplicate existing tool parts', async () => {
    const messageID = 'msg-1';
    const toolPart = {
      type: 'tool',
      id: 'tool-1',
      messageID,
      tool: 'test-tool',
      state: { status: 'completed', input: {} },
    };

    const input = {};
    const output = {
      messages: [
        {
          info: { id: messageID, role: 'assistant' },
          parts: [toolPart],
        },
      ],
    };

    // First run
    await hook(input, output);

    // Second run with same part
    await hook(input, output);

    const logPath = path.join(tempDir, '.contexty', 'tool-parts.json');
    const content = JSON.parse(await fs.readFile(logPath, 'utf-8'));

    expect(content.parts).toHaveLength(1); // Should still be 1
  });

  it('should respect blacklist', async () => {
    const messageID = 'msg-1';
    const toolPart = {
      type: 'tool',
      id: 'tool-blocked',
      messageID,
      tool: 'test-tool',
      state: { status: 'completed', input: {} },
    };

    // Create blacklist
    const blacklistDir = path.join(tempDir, '.contexty');
    await fs.mkdir(blacklistDir, { recursive: true });
    await fs.writeFile(
      path.join(blacklistDir, 'tool-parts.blacklist.json'),
      JSON.stringify({ ids: ['tool-blocked'] })
    );

    const input = {};
    const output = {
      messages: [
        {
          info: { id: messageID, role: 'assistant' },
          parts: [toolPart],
        },
      ],
    };

    await hook(input, output);

    // Should NOT be in file
    const logPath = path.join(tempDir, '.contexty', 'tool-parts.json');
    try {
        const content = JSON.parse(await fs.readFile(logPath, 'utf-8'));
        expect(content.parts).toHaveLength(0);
    } catch {
        // File might not even exist if nothing was written, which is also fine
    }

    // Should NOT be in message (it gets removed and not re-injected)
    expect(output.messages[0].parts).toHaveLength(0);
  });

  it('should re-inject persisted parts into correct messages', async () => {
    const messageID = 'msg-1';
    const toolPart = {
      type: 'tool',
      id: 'tool-persisted',
      messageID,
      tool: 'test-tool',
      state: { status: 'completed', input: {} },
    };

    // Pre-populate storage
    const storageDir = path.join(tempDir, '.contexty');
    await fs.mkdir(storageDir, { recursive: true });
    await fs.writeFile(
      path.join(storageDir, 'tool-parts.json'),
      JSON.stringify({ parts: [toolPart] })
    );

    const input = {};
    const output = {
      messages: [
        {
          info: { id: messageID, role: 'assistant' },
          parts: [], // Empty initially
        },
      ],
    };

    await hook(input, output);

    expect(output.messages[0].parts).toHaveLength(1);
    expect(output.messages[0].parts[0].id).toBe('tool-persisted');
    expect(output.messages[0].parts[0].metadata.contexty.source).toBe('tool-log');
  });

  it('should fallback to last assistant message if messageID not found', async () => {
    const oldMessageID = 'msg-old';
    const newMessageID = 'msg-new';

    const toolPart = {
      type: 'tool',
      id: 'tool-orphan',
      messageID: oldMessageID, // ID that doesn't exist in current messages
      tool: 'test-tool',
      state: { status: 'completed', input: {} },
    };

    // Pre-populate storage
    const storageDir = path.join(tempDir, '.contexty');
    await fs.mkdir(storageDir, { recursive: true });
    await fs.writeFile(
      path.join(storageDir, 'tool-parts.json'),
      JSON.stringify({ parts: [toolPart] })
    );

    const input = {};
    const output = {
      messages: [
        {
          info: { id: newMessageID, role: 'assistant' },
          parts: [],
        },
      ],
    };

    await hook(input, output);

    expect(output.messages[0].parts).toHaveLength(1);
    expect(output.messages[0].parts[0].id).toBe('tool-orphan');
    // Should have originalMessageID metadata
    expect(output.messages[0].parts[0].metadata.contexty.originalMessageID).toBe(oldMessageID);
  });
});
