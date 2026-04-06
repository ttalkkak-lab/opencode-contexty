import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { createHSCMMTransformHook } from './transformer';
import { sessionTracker } from '../core/sessionTracker';
import type { SessionState, DCPConfig, WithParts } from '../dcp/types';
import { writePruningState } from './storage';

type TestMessage = WithParts & { parts: any[] };

type TestClient = {
  session: {
    list: () => Promise<{ data: Array<{ id: string }> }>;
  };
};

function makeState(sessionId: string): SessionState {
  return {
    sessionId,
    isSubAgent: false,
    manualMode: false,
    compressPermission: undefined,
    pendingManualTrigger: null,
    prune: {
      tools: new Map(),
      messages: {
        byMessageId: new Map(),
        blocksById: new Map(),
        activeBlockIds: new Set(),
        activeByAnchorMessageId: new Map(),
        nextBlockId: 1,
        nextRunId: 1,
      },
    },
    nudges: {
      contextLimitAnchors: new Set(),
      turnNudgeAnchors: new Set(),
      iterationNudgeAnchors: new Set(),
    },
    stats: {
      pruneTokenCounter: 0,
      totalPruneTokens: 0,
    },
    compressionTiming: {
      pendingByCallId: new Map(),
    },
    toolParameters: new Map(),
    subAgentResultCache: new Map(),
    toolIdList: [],
    messageIds: {
      byRawId: new Map(),
      byRef: new Map(),
      nextRef: 1,
    },
    lastCompaction: 0,
    currentTurn: 1,
    variant: undefined,
    modelContextLimit: 200,
    systemPromptTokens: 0,
  };
}

function makeConfig(overrides: Partial<DCPConfig> = {}): DCPConfig {
  const config: DCPConfig = {
    enabled: true,
    debug: false,
    pruneNotification: 'off',
    pruneNotificationType: 'chat',
    commands: { enabled: true, protectedTools: [] },
    manualMode: { enabled: true, automaticStrategies: true },
    turnProtection: { enabled: false, turns: 0 },
    experimental: { allowSubAgents: true, customPrompts: true },
    protectedFilePatterns: [],
    compress: {
      mode: 'message',
      permission: 'allow',
      showCompression: false,
      summaryBuffer: false,
      maxContextLimit: 10,
      minContextLimit: 0,
      nudgeFrequency: 1,
      iterationNudgeThreshold: 1,
      nudgeForce: 'soft',
      protectedTools: [],
      protectUserMessages: false,
    },
    strategies: {
      deduplication: { enabled: true, protectedTools: [] },
      purgeErrors: { enabled: true, turns: 1, protectedTools: [] },
    },
  };

  Object.assign(config, overrides);
  config.compress = {
    ...config.compress,
    ...(overrides.compress ?? {}),
  };
  config.strategies = {
    deduplication: {
      ...config.strategies.deduplication,
      ...(overrides.strategies?.deduplication ?? {}),
    },
    purgeErrors: {
      ...config.strategies.purgeErrors,
      ...(overrides.strategies?.purgeErrors ?? {}),
    },
  };

  return config;
}

function makeTextMessage(id: string, role: 'user' | 'assistant', text: string, sessionID = 'ses_test'): TestMessage {
  return {
    info: { id, role, sessionID, time: { created: Date.now() } },
    parts: [{ type: 'text', text }],
  };
}

function makeToolPart(id: string, messageID: string, output = 'tool output') {
  return {
    id,
    sessionID: 'ses_test',
    messageID,
    type: 'tool',
    callID: `call-${id}`,
    tool: 'read',
    state: {
      status: 'completed',
      input: { filePath: 'src/a.ts' },
      output,
      title: 'src/a.ts',
      metadata: {},
      time: { start: Date.now(), end: Date.now() },
    },
    metadata: { contexty: { source: 'original' } },
  };
}

function makeDuplicateToolMessage(id: string, sessionID = 'ses_test') {
  const tool = {
    id: `tool-${id}`,
    sessionID,
    messageID: id,
    type: 'tool',
    callID: `call-${id}`,
    tool: 'read',
    state: {
      status: 'completed',
      input: { filePath: 'src/a.ts' },
      output: 'tool output',
      title: 'src/a.ts',
      metadata: {},
      time: { start: Date.now(), end: Date.now() },
    },
    metadata: { contexty: { source: 'original' } },
  };

  return {
    info: { id, role: 'assistant', sessionID, time: { created: Date.now() } },
    parts: [tool],
  } satisfies TestMessage;
}

describe('HSCMM transformer with DCP', () => {
  let tempDir: string;
  let hook: ReturnType<typeof createHSCMMTransformHook>;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'contexty-transformer-dcp-'));
    sessionTracker.clearSessionId();
  });

  afterEach(async () => {
    sessionTracker.clearSessionId();
    await fs.rm(tempDir, { recursive: true, force: true });
    await fs.rm(path.join(tempDir, '.contexty'), { recursive: true, force: true });
  });

  it('prunes duplicate tool turns before HSCMM reattaches persisted tools', async () => {
    const state = makeState('ses_test');
    state.toolParameters.set('call-1', { tool: 'read', parameters: { filePath: 'src/a.ts' }, status: 'completed', turn: 1 });
    state.toolParameters.set('call-2', { tool: 'read', parameters: { filePath: 'src/a.ts' }, status: 'completed', turn: 2 });
    await writePruningState(tempDir, 'ses_test', state);
    await fs.writeFile(path.join(tempDir, 'contexty.config.json'), JSON.stringify({ dcp: makeConfig() }), 'utf8');

    hook = createHSCMMTransformHook(tempDir, undefined, {
      session: {
        list: async () => ({ data: [{ id: 'ses_test' }] }),
      },
    });

    const output: { messages: TestMessage[] } = {
      messages: [
        makeTextMessage('msg-1', 'user', 'hello'),
        makeDuplicateToolMessage('msg-2'),
        makeDuplicateToolMessage('msg-3'),
      ],
    };

    await hook({}, output as any);

    const persisted = await fs.readFile(path.join(tempDir, '.contexty', 'sessions', 'ses_test', 'pruning-state.json'), 'utf8');
    const parsed = JSON.parse(persisted) as any;
    expect(parsed.prune.tools).toContainEqual(['call-msg-2', 2]);
    expect(output.messages[1].parts.some((part) => part.type === 'tool')).toBe(true);
    expect(output.messages[2].parts.some((part) => part.type === 'text' && typeof (part as any).text === 'string' && (part as any).text.includes('<dcp-message-id>m'))).toBe(true);
    expect(output.messages[1].parts.some((part) => part.type === 'tool' && (part as any).state?.output === '[Old tool result content cleared]')).toBe(true);
  });

  it('skips DCP when disabled and leaves HSCMM behavior intact', async () => {
    const configPath = path.join(tempDir, 'contexty.config.json');
    await fs.writeFile(configPath, JSON.stringify({ dcp: makeConfig({ enabled: false }) }), 'utf8');

    hook = createHSCMMTransformHook(tempDir, undefined, {
      session: { list: async () => ({ data: [{ id: 'ses_test' }] }) },
    });

    const output: { messages: TestMessage[] } = {
      messages: [
        {
          info: { id: 'msg-1', role: 'assistant', sessionID: 'ses_test', time: { created: Date.now() } },
          parts: [makeToolPart('tool-1', 'msg-1')],
        },
      ],
    };

    await hook({}, output as any);

    expect(output.messages[0].parts.some((part) => part.type === 'tool')).toBe(true);
    expect(output.messages[0].parts.some((part) => part.type === 'text' && typeof (part as any).text === 'string' && (part as any).text.includes('<dcp-message-id>'))).toBe(false);
  });

  it('gracefully degrades when pruning state is missing', async () => {
    await fs.writeFile(path.join(tempDir, 'contexty.config.json'), JSON.stringify({ dcp: makeConfig() }), 'utf8');

    hook = createHSCMMTransformHook(tempDir, undefined, {
      session: { list: async () => ({ data: [{ id: 'ses_test' }] }) },
    });

    const output: { messages: TestMessage[] } = {
      messages: [makeTextMessage('msg-1', 'assistant', 'hello')],
    };

    await expect(hook({}, output as any)).resolves.toBeUndefined();
    expect(output.messages[0].parts.some((part) => part.type === 'text' && typeof (part as any).text === 'string' && (part as any).text.includes('<dcp-message-id>m'))).toBe(true);
  });

  it('applies duplicate pruning, nudges, and message IDs in one pass', async () => {
    const state = makeState('ses_test');
    state.modelContextLimit = 50;
    state.systemPromptTokens = 0;
    await writePruningState(tempDir, 'ses_test', state);
    await fs.writeFile(path.join(tempDir, 'contexty.config.json'), JSON.stringify({ dcp: makeConfig({ compress: { maxContextLimit: 1, nudgeFrequency: 1, nudgeForce: 'soft', mode: 'message', permission: 'allow', showCompression: false, summaryBuffer: false, minContextLimit: 0, iterationNudgeThreshold: 1, protectedTools: [], protectUserMessages: false }, strategies: { deduplication: { enabled: true, protectedTools: [] }, purgeErrors: { enabled: true, turns: 1, protectedTools: [] } } }) }), 'utf8');

    hook = createHSCMMTransformHook(tempDir, undefined, {
      session: { list: async () => ({ data: [{ id: 'ses_test' }] }) },
    });

    const output: { messages: TestMessage[] } = {
      messages: [
        makeTextMessage('msg-1', 'user', 'x '.repeat(200)),
        {
          info: { id: 'msg-2', role: 'assistant', sessionID: 'ses_test', time: { created: Date.now() } },
          parts: [makeToolPart('tool-1', 'msg-2')],
        },
        makeDuplicateToolMessage('msg-3'),
      ],
    };

    await hook({}, output as any);

    const persisted = await fs.readFile(path.join(tempDir, '.contexty', 'sessions', 'ses_test', 'pruning-state.json'), 'utf8');
    const parsed = JSON.parse(persisted) as any;
    expect(parsed.prune.tools).toContainEqual(['call-tool-1', 2]);
    const taggedTexts = output.messages.flatMap((message) => message.parts).filter((part) => typeof (part as any).text === 'string').map((part) => (part as any).text as string);
    expect(taggedTexts.some((text) => text.includes('[DCP context-limit nudge]'))).toBe(true);
    expect(taggedTexts.some((text) => text.includes('<dcp-message-id>m0001</dcp-message-id>'))).toBe(true);
    expect(taggedTexts.some((text) => text.includes('<dcp-message-id>m0002</dcp-message-id>'))).toBe(true);
  });
});
