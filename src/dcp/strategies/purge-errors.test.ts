/// <reference types="bun-types" />

import { describe, expect, test } from 'bun:test';
import type { DCPConfig, SessionState, ToolParameterEntry } from '../types';
import { purgeErrors } from './purge-errors';

function createConfig(overrides?: Partial<DCPConfig['strategies']['purgeErrors']>): DCPConfig {
  return {
    enabled: true,
    debug: false,
    pruneNotification: 'minimal',
    pruneNotificationType: 'toast',
    commands: { enabled: true, protectedTools: [] },
    manualMode: { enabled: true, automaticStrategies: true },
    turnProtection: { enabled: true, turns: 3 },
    experimental: { allowSubAgents: true, customPrompts: false },
    protectedFilePatterns: [],
    compress: {
      mode: 'message',
      permission: 'ask',
      showCompression: false,
      summaryBuffer: false,
      maxContextLimit: 100,
      minContextLimit: 50,
      nudgeFrequency: 5,
      iterationNudgeThreshold: 2,
      nudgeForce: 'soft',
      protectedTools: [],
      protectUserMessages: true,
    },
    strategies: {
      deduplication: { enabled: true, protectedTools: [] },
      purgeErrors: {
        enabled: true,
        turns: 4,
        protectedTools: [],
        ...overrides,
      },
    },
  };
}

function createState(currentTurn: number): SessionState {
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
    currentTurn,
    variant: undefined,
    modelContextLimit: undefined,
    systemPromptTokens: undefined,
  };
}

function toolEntry(tool: string, turn: number, status: ToolParameterEntry['status'] = 'error', callID = `${tool}-${turn}`): ToolParameterEntry & { callID: string } {
  return {
    callID,
    tool,
    parameters: {},
    status,
    turn,
  };
}

describe('purge-errors', () => {
  test('marks old error tools for pruning', () => {
    const config = createConfig();
    const state = createState(6);
    const params = [toolEntry('read', 1)];

    purgeErrors(config, state, params);

    expect(state.prune.tools.get('read-1')).toBe(1);
  });

  test('does not mark recent error tools', () => {
    const config = createConfig();
    const state = createState(6);
    const params = [toolEntry('read', 3)];

    purgeErrors(config, state, params);

    expect(state.prune.tools.has('read-3')).toBe(false);
  });

  test('uses strict greater-than comparison at the threshold edge', () => {
    const config = createConfig();
    const state = createState(7);
    const params = [toolEntry('read', 3)];

    purgeErrors(config, state, params);

    expect(state.prune.tools.has('read-3')).toBe(false);
  });

  test('does not mark protected error tools', () => {
    const config = createConfig({ protectedTools: ['write'] });
    const state = createState(10);
    const params = [toolEntry('write', 1)];

    purgeErrors(config, state, params);

    expect(state.prune.tools.has('write-1')).toBe(false);
  });

  test('does not mark non-error tools', () => {
    const config = createConfig();
    const state = createState(10);
    const params = [toolEntry('read', 1, 'completed')];

    purgeErrors(config, state, params);

    expect(state.prune.tools.size).toBe(0);
  });

  test('does nothing when disabled', () => {
    const config = createConfig({ enabled: false });
    const state = createState(10);
    const params = [toolEntry('read', 1)];

    purgeErrors(config, state, params);

    expect(state.prune.tools.size).toBe(0);
  });

  test('handles empty tool params', () => {
    const config = createConfig();
    const state = createState(10);

    expect(() => purgeErrors(config, state, [])).not.toThrow();
    expect(state.prune.tools.size).toBe(0);
  });
});
