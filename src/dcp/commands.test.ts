import { describe, expect, test } from "bun:test";

import { handleDcpCommand } from "./commands";
import type { DCPConfig, SessionState } from "./types";
import type { DCPLogger } from "./logger";

const makeLogger = (): DCPLogger =>
  ({
    info() {},
    debug() {},
    warn() {},
    error() {},
  }) as unknown as DCPLogger;

const makeConfig = (): DCPConfig => ({
  enabled: true,
  debug: false,
  pruneNotification: "off",
  pruneNotificationType: "chat",
  commands: { enabled: true, protectedTools: [] },
  manualMode: { enabled: true, automaticStrategies: false },
  turnProtection: { enabled: false, turns: 0 },
  experimental: { allowSubAgents: true, customPrompts: false },
  protectedFilePatterns: [],
  compress: {
    mode: "range",
    permission: "allow",
    showCompression: true,
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
    deduplication: { enabled: true, protectedTools: [] },
    purgeErrors: { enabled: true, turns: 0, protectedTools: [] },
  },
});

const makeState = (): SessionState => ({
  sessionId: "session-1",
  isSubAgent: false,
  manualMode: false,
  compressPermission: undefined,
  pendingManualTrigger: null,
  prune: {
    tools: new Map([
      ["call-1", 11],
      ["call-2", 22],
    ]),
    messages: {
      byMessageId: new Map<string, { tokenCount: number; allBlockIds: number[]; activeBlockIds: number[] }>(),
      blocksById: new Map(),
      activeBlockIds: new Set<number>(),
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
  stats: { pruneTokenCounter: 0, totalPruneTokens: 42 },
  compressionTiming: { pendingByCallId: new Map() },
  toolParameters: new Map([
    ["call-1", { tool: "bash", parameters: {}, turn: 1, tokenCount: 11 }],
    ["call-2", { tool: "bash", parameters: {}, turn: 2, tokenCount: 22 }],
  ]),
  subAgentResultCache: new Map(),
  toolIdList: ["call-1", "call-2"],
  messageIds: { byRawId: new Map(), byRef: new Map(), nextRef: 1 },
  lastCompaction: 0,
  currentTurn: 0,
  variant: undefined,
  modelContextLimit: undefined,
  systemPromptTokens: undefined,
});

const addMessage = (state: SessionState, id: string, compacted = false): void => {
  state.prune.messages.byMessageId.set(id, {
    tokenCount: 0,
    allBlockIds: compacted ? [1] : [],
    activeBlockIds: compacted ? [1] : [],
  });
};

const addBlock = (state: SessionState, blockId: number, active = true): void => {
  state.prune.messages.blocksById.set(blockId, {
    blockId,
    runId: blockId,
    active,
    deactivatedByUser: false,
    compressedTokens: 0,
    summaryTokens: 9,
    durationMs: 0,
    topic: "topic",
    startId: "m0001",
    endId: "m0002",
    anchorMessageId: "msg-1",
    compressMessageId: "msg-2",
    includedBlockIds: [],
    consumedBlockIds: [],
    parentBlockIds: [],
    directMessageIds: [],
    directToolIds: [],
    effectiveMessageIds: [],
    effectiveToolIds: [],
    createdAt: Date.now(),
    summary: "summary",
  });

  if (active) {
    state.prune.messages.activeBlockIds.add(blockId);
  }
};

describe("handleDcpCommand", () => {
  test("stats contains token info", () => {
    const state = makeState();
    addBlock(state, 1, true);

    const output = handleDcpCommand(["stats"], state, makeConfig(), makeLogger());

    expect(output).toContain("Total tokens pruned: 42");
    expect(output).toContain("Active blocks: 1");
    expect(output).toContain("Summary tokens: 9");
    expect(output).toContain("Tool IDs pruned: call-1, call-2");
  });

  test("context contains message and block counts", () => {
    const state = makeState();
    addMessage(state, "msg-1", true);
    addMessage(state, "msg-2", false);
    addBlock(state, 1, true);

    const output = handleDcpCommand(["context"], state, makeConfig(), makeLogger());

    expect(output).toContain("Total messages: 2");
    expect(output).toContain("Compacted messages: 1");
    expect(output).toContain("Active blocks: 1");
  });

  test("help contains subcommand list", () => {
    const output = handleDcpCommand(["help"], makeState(), makeConfig(), makeLogger());

    expect(output).toContain("stats");
    expect(output).toContain("context");
    expect(output).toContain("compress");
    expect(output).toContain("decompress");
    expect(output).toContain("sweep");
    expect(output).toContain("manual");
  });

  test("unknown falls back to help", () => {
    const output = handleDcpCommand(["unknown"], makeState(), makeConfig(), makeLogger());

    expect(output).toContain("DCP commands:");
    expect(output).toContain("stats");
  });

  test("decompress deactivates block by id", () => {
    const state = makeState();
    addBlock(state, 1, true);

    const output = handleDcpCommand(["decompress", "1"], state, makeConfig(), makeLogger());

    expect(output).toContain("Deactivated block 1");
    expect(state.prune.messages.blocksById.get(1)?.active).toBe(false);
    expect(state.prune.messages.activeBlockIds.has(1)).toBe(false);
  });

  test("compress sets pendingManualTrigger", () => {
    const state = makeState();

    const output = handleDcpCommand(["compress"], state, makeConfig(), makeLogger());

    expect(output).toContain("Manual compression requested");
    expect(state.pendingManualTrigger).toEqual({ sessionId: "session-1", prompt: "compress" });
  });

  test("no args shows help", () => {
    const output = handleDcpCommand([], makeState(), makeConfig(), makeLogger());

    expect(output).toContain("DCP commands:");
    expect(output).toContain("manual");
  });

  test("manual toggles manual mode", () => {
    const state = makeState();

    const enabled = handleDcpCommand(["manual"], state, makeConfig(), makeLogger());
    const disabled = handleDcpCommand(["manual"], state, makeConfig(), makeLogger());

    expect(enabled).toContain("enabled");
    expect(disabled).toContain("disabled");
    expect(state.manualMode).toBe(false);
  });

  test("sweep prunes known tools immediately", () => {
    const state = makeState();
    state.prune.tools.delete("call-2");

    const output = handleDcpCommand(["sweep"], state, makeConfig(), makeLogger());

    expect(output).toContain("Sweep complete: 1 tools pruned");
    expect(state.prune.tools.has("call-2")).toBe(true);
  });
});
