import { describe, expect, test } from 'bun:test';
import { DEFAULT_PROTECTED_TOOLS } from '../protected-patterns';
import type { DCPConfig, SessionState, ToolParameterEntry } from '../types';
import { deduplicate } from './deduplication';

function createState(): SessionState {
  return {
    sessionId: 'session-1',
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
    currentTurn: 0,
    variant: undefined,
    modelContextLimit: undefined,
    systemPromptTokens: undefined,
  };
}

const config: DCPConfig = {
  enabled: true,
  debug: false,
  pruneNotification: 'off',
  pruneNotificationType: 'chat',
  commands: {
    enabled: true,
    protectedTools: [],
  },
  manualMode: {
    enabled: true,
    automaticStrategies: true,
  },
  turnProtection: {
    enabled: false,
    turns: 0,
  },
  experimental: {
    allowSubAgents: true,
    customPrompts: true,
  },
  protectedFilePatterns: [],
  compress: {
    mode: 'message',
    permission: 'allow',
    showCompression: false,
    summaryBuffer: false,
    maxContextLimit: 100,
    minContextLimit: 0,
    nudgeFrequency: 1,
    iterationNudgeThreshold: 1,
    nudgeForce: 'soft',
    protectedTools: [],
    protectUserMessages: false,
  },
  strategies: {
    deduplication: {
      enabled: true,
      protectedTools: [],
    },
    purgeErrors: {
      enabled: false,
      turns: 0,
      protectedTools: [],
    },
  },
};

function entry(tool: string, parameters: unknown, turn: number, callID: string): ToolParameterEntry & { callID: string } {
  return { tool, parameters, turn, callID };
}

describe('deduplication strategy', () => {
  test('marks older duplicate read_file calls for pruning', () => {
    const state = createState();
    const params = [
      entry('read_file', { filePath: 'src/a.ts' }, 1, 'call-1'),
      entry('read_file', { filePath: 'src/a.ts' }, 2, 'call-2'),
      entry('read_file', { filePath: 'src/a.ts' }, 3, 'call-3'),
    ];

    deduplicate(config, state, params);

    expect(state.prune.tools.get('call-1')).toBe(1);
    expect(state.prune.tools.get('call-2')).toBe(2);
    expect(state.prune.tools.has('call-3')).toBe(false);
  });

  test('does not deduplicate same tool with different params', () => {
    const state = createState();
    const params = [
      entry('read_file', { filePath: 'src/a.ts' }, 1, 'call-1'),
      entry('read_file', { filePath: 'src/b.ts' }, 2, 'call-2'),
    ];

    deduplicate(config, state, params);

    expect(state.prune.tools.size).toBe(0);
  });

  test('skips protected tools even when duplicated', () => {
    const state = createState();
    const params = [
      entry(DEFAULT_PROTECTED_TOOLS[0], { value: 1 }, 1, 'call-1'),
      entry(DEFAULT_PROTECTED_TOOLS[0], { value: 1 }, 2, 'call-2'),
    ];

    deduplicate(config, state, params);

    expect(state.prune.tools.size).toBe(0);
  });

  test('handles empty tool parameters without crashing', () => {
    const state = createState();

    expect(() => {
      deduplicate(config, state, [
        entry('read_file', undefined, 1, 'call-1'),
        entry('read_file', {}, 2, 'call-2'),
      ]);
    }).not.toThrow();
  });

  test('does not mark a single call', () => {
    const state = createState();

    deduplicate(config, state, [entry('read_file', { filePath: 'src/a.ts' }, 1, 'call-1')]);

    expect(state.prune.tools.size).toBe(0);
  });

  test('only marks duplicates in mixed input', () => {
    const state = createState();
    const params = [
      entry('read_file', { filePath: 'src/a.ts' }, 1, 'call-1'),
      entry('read_file', { filePath: 'src/a.ts' }, 4, 'call-4'),
      entry('read_file', { filePath: 'src/b.ts' }, 2, 'call-2'),
      entry('search', { query: 'bun' }, 3, 'call-3'),
    ];

    deduplicate(config, state, params);

    expect([...state.prune.tools.entries()]).toEqual([
      ['call-1', 1],
    ]);
  });

  test('normalizes and sorts parameters before comparing signatures', () => {
    const state = createState();
    const params = [
      entry('read_file', { b: 2, a: 1, nested: { y: 2, x: 1 } }, 1, 'call-1'),
      entry('read_file', { a: 1, nested: { x: 1, y: 2 }, b: 2 }, 2, 'call-2'),
    ];

    deduplicate(config, state, params);

    expect(state.prune.tools.get('call-1')).toBe(1);
    expect(state.prune.tools.has('call-2')).toBe(false);
  });
});
