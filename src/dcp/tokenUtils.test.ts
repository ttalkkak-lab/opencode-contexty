import { describe, expect, test } from 'bun:test';

import {
  countTokens,
  estimateTokensBatch,
  extractToolContent,
  getTotalToolTokens,
} from './tokenUtils';
import type { SessionState, ToolParameterEntry } from './types';

function makeSessionState(toolParameters: Map<string, ToolParameterEntry>): SessionState {
  return {
    sessionId: null,
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
    toolParameters,
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

describe('tokenUtils', () => {
  test('countTokens returns a positive count for text', () => {
    expect(countTokens('Hello world')).toBeGreaterThan(0);
  });

  test('countTokens returns 0 for empty text', () => {
    expect(countTokens('')).toBe(0);
  });

  test('countTokens handles longer text reasonably', () => {
    const count = countTokens('a'.repeat(1000));
    expect(count).toBeGreaterThan(0);
    expect(count).toBeLessThan(400);
  });

  test('estimateTokensBatch returns a positive count', () => {
    expect(estimateTokensBatch(['a', 'b'])).toBeGreaterThan(0);
  });

  test('extractToolContent returns input and output for tool parts', () => {
    expect(
      extractToolContent({
        type: 'tool',
        state: {
          status: 'completed',
          input: { query: 'hello' },
          output: { result: 'world' },
        },
      }),
    ).toEqual(['{"query":"hello"}', '{"result":"world"}']);
  });

  test('extractToolContent returns empty array for non-tool parts', () => {
    expect(extractToolContent({ type: 'text', text: 'hello' })).toEqual([]);
  });

  test('getTotalToolTokens returns 0 for empty map', () => {
    expect(getTotalToolTokens(makeSessionState(new Map()), ['one'])).toBe(0);
  });

  test('getTotalToolTokens sums token counts', () => {
    const toolParameters = new Map([
      ['one', { tool: 'one', parameters: {}, turn: 1, tokenCount: 3 }],
      ['two', { tool: 'two', parameters: {}, turn: 2, tokenCount: 7 }],
    ]);
    expect(getTotalToolTokens(makeSessionState(toolParameters), ['one', 'two', 'missing'])).toBe(10);
  });
});
