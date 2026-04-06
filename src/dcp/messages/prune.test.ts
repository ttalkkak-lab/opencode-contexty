import { describe, expect, test } from "bun:test";
import { wrapCompressedSummary } from "../compress/state";
import type { DCPConfig, SessionState, WithParts } from "../types";
import {
  filterCompressedRanges,
  PLACEHOLDER_COMPACTED,
  PLACEHOLDER_ERROR_INPUT,
  PLACEHOLDER_QUESTION,
  PLACEHOLDER_TOOL_OUTPUT,
  prune,
} from "./prune";

function createMessage(id: string, role: string, parts: any[]): WithParts {
  return { info: { id, role, sessionID: "test-session", time: { created: Date.now() } }, parts };
}

function createTextPart(text: string): any {
  return { type: "text", text };
}

function createToolPart(callID: string, tool: string, status: string, input?: any, output?: any): any {
  return { type: "tool", callID, tool, state: { status, input, output, time: {} } };
}

function createConfig(overrides?: Partial<DCPConfig>): DCPConfig {
  return {
    enabled: true,
    debug: false,
    pruneNotification: "off",
    pruneNotificationType: "chat",
    commands: { enabled: true, protectedTools: [] },
    manualMode: { enabled: true, automaticStrategies: true },
    turnProtection: { enabled: false, turns: 0 },
    experimental: { allowSubAgents: true, customPrompts: true },
    protectedFilePatterns: [],
    compress: {
      mode: "message",
      permission: "allow",
      showCompression: false,
      summaryBuffer: false,
      maxContextLimit: 100,
      minContextLimit: 0,
      nudgeFrequency: 1,
      iterationNudgeThreshold: 1,
      nudgeForce: "soft",
      protectedTools: [],
      protectUserMessages: false,
    },
    strategies: {
      deduplication: overrides?.strategies?.deduplication ?? { enabled: true, protectedTools: [] },
      purgeErrors: overrides?.strategies?.purgeErrors ?? { enabled: true, turns: 3, protectedTools: [] },
    },
  };
}

function createState(currentTurn = 10): SessionState {
  return {
    sessionId: "session-1",
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
    nudges: { contextLimitAnchors: new Set(), turnNudgeAnchors: new Set(), iterationNudgeAnchors: new Set() },
    stats: { pruneTokenCounter: 0, totalPruneTokens: 0 },
    compressionTiming: { pendingByCallId: new Map() },
    toolParameters: new Map(),
    subAgentResultCache: new Map(),
    toolIdList: [],
    messageIds: { byRawId: new Map(), byRef: new Map(), nextRef: 1 },
    lastCompaction: 0,
    currentTurn,
    variant: undefined,
    modelContextLimit: undefined,
    systemPromptTokens: undefined,
  };
}

const logger = { info() {}, warn() {}, error() {}, debug() {} };

describe("dcp prune pipeline", () => {
  test("runs the full pipeline and applies deduplication, purge errors, and pruning", () => {
    const config = createConfig();
    const state = createState(12);
    const messages: WithParts[] = [
      createMessage("raw-1", "assistant", [createToolPart("call-1", "read_file", "completed", { filePath: "a.ts" }, "one")]),
      createMessage("raw-2", "assistant", [createToolPart("call-2", "read_file", "completed", { filePath: "a.ts" }, "two")]),
      createMessage("raw-3", "assistant", [createToolPart("call-3", "search", "error", { query: "oops" }, "bad")]),
      createMessage("raw-4", "assistant", [createToolPart("call-4", "write", "completed", { path: "b.ts" }, "ok")]),
    ];

    prune(config, state, messages, logger);

    const first = messages[0].parts?.[0] as any;
    const second = messages[1].parts?.[0] as any;
    const third = messages[2].parts?.[0] as any;

    expect(first.state.output).toBe(PLACEHOLDER_TOOL_OUTPUT);
    expect(first.state.input).toBe(PLACEHOLDER_QUESTION);
    expect(second.state.output).toBe("two");
    expect(third.state.input).toBe(PLACEHOLDER_ERROR_INPUT);
    expect(third.state.output).toBe(PLACEHOLDER_ERROR_INPUT);
    expect(messages[3].parts?.[0]).toMatchObject({ state: { output: "ok" } });
  });

  test("handles empty message arrays", () => {
    const config = createConfig();
    const state = createState();
    const messages: WithParts[] = [];

    expect(() => prune(config, state, messages, logger)).not.toThrow();
    expect(messages).toEqual([]);
  });

  test("leaves unique tools untouched when no pruning is needed", () => {
    const config = createConfig();
    const state = createState(2);
    const messages: WithParts[] = [
      createMessage("raw-1", "assistant", [createToolPart("call-1", "read_file", "completed", { filePath: "a.ts" }, "one")]),
      createMessage("raw-2", "assistant", [createToolPart("call-2", "search", "completed", { query: "ok" }, "two")]),
    ];

    prune(config, state, messages, logger);

    expect(messages[0].parts?.[0]).toMatchObject({ state: { input: { filePath: "a.ts" }, output: "one" } });
    expect(messages[1].parts?.[0]).toMatchObject({ state: { input: { query: "ok" }, output: "two" } });
  });

  test("deduplicates repeated tool calls", () => {
    const config = createConfig({ strategies: { purgeErrors: { enabled: false, turns: 3, protectedTools: [] }, deduplication: { enabled: true, protectedTools: [] } } });
    const state = createState(5);
    const messages: WithParts[] = [
      createMessage("raw-1", "assistant", [createToolPart("call-1", "read_file", "completed", { filePath: "same.ts" }, "one")]),
      createMessage("raw-2", "assistant", [createToolPart("call-2", "read_file", "completed", { filePath: "same.ts" }, "two")]),
      createMessage("raw-3", "assistant", [createToolPart("call-3", "read_file", "completed", { filePath: "same.ts" }, "three")]),
    ];

    prune(config, state, messages, logger);

    expect(messages[0].parts?.[0]).toMatchObject({ state: { input: PLACEHOLDER_QUESTION, output: PLACEHOLDER_TOOL_OUTPUT } });
    expect(messages[1].parts?.[0]).toMatchObject({ state: { input: PLACEHOLDER_QUESTION, output: PLACEHOLDER_TOOL_OUTPUT } });
    expect(messages[2].parts?.[0]).toMatchObject({ state: { input: { filePath: "same.ts" }, output: "three" } });
  });

  test("purges old error tool inputs and outputs", () => {
    const config = createConfig({ strategies: { deduplication: { enabled: false, protectedTools: [] }, purgeErrors: { enabled: true, turns: 3, protectedTools: [] } } });
    const state = createState(10);
    const messages: WithParts[] = [
      createMessage("raw-1", "assistant", [createToolPart("call-1", "search", "error", { query: "old" }, "bad")]),
    ];

    prune(config, state, messages, logger);

    expect(messages[0].parts?.[0]).toMatchObject({ state: { input: PLACEHOLDER_ERROR_INPUT, output: PLACEHOLDER_ERROR_INPUT } });
  });

  test("filters compacted ranges into a wrapped summary and compacted tool parts", () => {
    const config = createConfig();
    const state = createState();
    const message = createMessage("raw-1", "user", [
      createTextPart("first"),
      createToolPart("call-1", "search", "completed", { query: "x" }, "y"),
    ]);

    state.prune.messages.byMessageId.set("raw-1", { tokenCount: 1, allBlockIds: [1], activeBlockIds: [1] });
    state.prune.messages.blocksById.set(1, {
      blockId: 1,
      runId: 1,
      active: true,
      deactivatedByUser: false,
      compressedTokens: 0,
      summaryTokens: 10,
      durationMs: 0,
      topic: "topic",
      startId: "m0001",
      endId: "m0001",
      anchorMessageId: "raw-1",
      compressMessageId: "raw-1",
      includedBlockIds: [],
      consumedBlockIds: [],
      parentBlockIds: [],
      directMessageIds: [],
      directToolIds: [],
      effectiveMessageIds: ["raw-1"],
      effectiveToolIds: [],
      createdAt: 1,
      summary: "summary",
    });
    state.prune.messages.activeBlockIds.add(1);

    filterCompressedRanges([message], state, config);

    expect(message.parts?.length).toBe(2);
    expect((message.parts?.[0] as any).text).toBe(wrapCompressedSummary(1, "summary"));
    expect((message.parts?.[1] as any).state.time.compacted).toBe(true);
    expect((message.parts?.[1] as any).state.input).toBe(PLACEHOLDER_COMPACTED);
    expect((message.parts?.[1] as any).state.output).toBe(PLACEHOLDER_COMPACTED);
  });

  test("applies deduplication, purge errors, and compression together", () => {
    const config = createConfig();
    const state = createState(20);
    const messages: WithParts[] = [
      createMessage("raw-1", "user", [createTextPart("keep"), createToolPart("call-1", "read_file", "completed", { filePath: "same.ts" }, "one")]),
      createMessage("raw-2", "assistant", [createToolPart("call-2", "read_file", "completed", { filePath: "same.ts" }, "two")]),
      createMessage("raw-3", "assistant", [createToolPart("call-3", "search", "error", { query: "old" }, "bad")]),
      createMessage("raw-4", "assistant", [createToolPart("call-4", "search", "error", { query: "older" }, "worse")]),
    ];

    state.prune.messages.byMessageId.set("raw-1", { tokenCount: 1, allBlockIds: [1], activeBlockIds: [1] });
    state.prune.messages.blocksById.set(1, {
      blockId: 1,
      runId: 1,
      active: true,
      deactivatedByUser: false,
      compressedTokens: 0,
      summaryTokens: 10,
      durationMs: 0,
      topic: "topic",
      startId: "m0001",
      endId: "m0001",
      anchorMessageId: "raw-1",
      compressMessageId: "raw-1",
      includedBlockIds: [],
      consumedBlockIds: [],
      parentBlockIds: [],
      directMessageIds: [],
      directToolIds: [],
      effectiveMessageIds: ["raw-1"],
      effectiveToolIds: [],
      createdAt: 1,
      summary: "summary",
    });
    state.prune.messages.activeBlockIds.add(1);

    prune(config, state, messages, logger);

    expect(messages[0].parts?.[0]).toMatchObject({ text: wrapCompressedSummary(1, "summary") });
    expect((messages[0].parts?.[1] as any).state.output).toBe(PLACEHOLDER_COMPACTED);
    expect((messages[0].parts?.[1] as any).state.input).toBe(PLACEHOLDER_COMPACTED);
    expect((messages[1].parts?.[0] as any).state.output).toBe("two");
    expect((messages[1].parts?.[0] as any).state.input).toEqual({ filePath: "same.ts" });
    expect((messages[2].parts?.[0] as any).state.input).toBe(PLACEHOLDER_ERROR_INPUT);
    expect((messages[3].parts?.[0] as any).state.input).toBe(PLACEHOLDER_ERROR_INPUT);
  });
});
