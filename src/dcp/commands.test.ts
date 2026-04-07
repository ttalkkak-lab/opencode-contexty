import { describe, expect, test } from "bun:test";

import {
  handleHelpCommand,
  handleStatsCommand,
  handleContextCommand,
  handleCompressCommand,
  handleDecompressCommand,
  handleRecompressCommand,
  handleSweepCommand,
  handleManualToggleCommand,
  type CommandContext,
  type BlockCommandContext,
  type SweepContext,
} from "./commands";
import { applyCompressionState } from "./compress/state";
import { syncCompressionBlocks } from "./messages/sync";
import type { DCPConfig, SessionState } from "./types";
import type { DCPLogger } from "./logger";

const makeLogger = (): DCPLogger =>
  ({
    info() {},
    debug() {},
    warn() {},
    error() {},
  }) as unknown as DCPLogger;

const noopClient: any = {
  session: {
    prompt: async (_opts?: any) => {},
    messages: async () => ({ data: [] }),
  },
};

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

const makeCtx = (state: SessionState): CommandContext => ({
  client: noopClient,
  state,
  config: makeConfig(),
  logger: makeLogger(),
  sessionId: "session-1",
  messages: [],
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

describe("DCP Commands", () => {
  test("stats sends notification with token info", async () => {
    const state = makeState();
    addBlock(state, 1, true);
    const ctx = makeCtx(state);
    let captured: string | undefined;
    const origPrompt = noopClient.session.prompt;
    noopClient.session.prompt = async (opts: any) => {
      captured = opts.body.parts[0].text;
    };

    await handleStatsCommand(ctx);

    expect(captured).toContain("42");
    expect(captured).toContain("1");
    expect(captured).toContain("9");
    expect(captured).toContain("2");

    noopClient.session.prompt = origPrompt;
  });

  test("context sends notification with message and block counts", async () => {
    const state = makeState();
    addMessage(state, "msg-1", true);
    addMessage(state, "msg-2", false);
    addBlock(state, 1, true);
    const ctx = makeCtx(state);
    let captured: string | undefined;
    const origPrompt = noopClient.session.prompt;
    noopClient.session.prompt = async (opts: any) => {
      captured = opts.body.parts[0].text;
    };

    await handleContextCommand(ctx);

    expect(captured).toContain("2");
    expect(captured).toContain("1");

    noopClient.session.prompt = origPrompt;
  });

  test("help sends notification with subcommand list", async () => {
    const ctx = makeCtx(makeState());
    let captured: string | undefined;
    const origPrompt = noopClient.session.prompt;
    noopClient.session.prompt = async (opts: any) => {
      captured = opts.body.parts[0].text;
    };

    await handleHelpCommand(ctx);

    expect(captured).toContain("stats");
    expect(captured).toContain("context");
    expect(captured).toContain("compress");
    expect(captured).toContain("decompress");
    expect(captured).toContain("sweep");
    expect(captured).toContain("manual");

    noopClient.session.prompt = origPrompt;
  });

  test("decompress deactivates block by id", async () => {
    const state = makeState();
    addBlock(state, 1, true);
    const ctx: BlockCommandContext = { ...makeCtx(state), args: ["1"] };
    let captured: string | undefined;
    const origPrompt = noopClient.session.prompt;
    noopClient.session.prompt = async (opts: any) => {
      captured = opts.body.parts[0].text;
    };

    await handleDecompressCommand(ctx);

    expect(captured).toContain("1");
    expect(captured).toContain("topic");
    expect(state.prune.messages.blocksById.has(1)).toBe(true);
    expect(state.prune.messages.blocksById.get(1)?.active).toBe(false);
    expect(state.prune.messages.blocksById.get(1)?.deactivatedByUser).toBe(true);
    expect(state.prune.messages.activeBlockIds.has(1)).toBe(false);

    noopClient.session.prompt = origPrompt;
  });

  test("decompress accepts bN block refs", async () => {
    const state = makeState();
    addBlock(state, 2, true);
    const ctx: BlockCommandContext = { ...makeCtx(state), args: ["b2"] };

    await handleDecompressCommand(ctx);

    expect(state.prune.messages.blocksById.get(2)?.active).toBe(false);
    expect(state.prune.messages.blocksById.get(2)?.deactivatedByUser).toBe(true);
    expect(state.prune.messages.activeBlockIds.has(2)).toBe(false);
  });

  test("recompress restores active state", async () => {
    const state = makeState();
    addBlock(state, 1, true);
    state.prune.messages.blocksById.get(1)!.effectiveMessageIds = ["msg-1"];
    state.prune.messages.byMessageId.set("msg-1", {
      tokenCount: 0,
      allBlockIds: [1],
      activeBlockIds: [1],
    });
    const ctx: BlockCommandContext = { ...makeCtx(state), args: ["1"] };

    await handleDecompressCommand(ctx);
    state.prune.messages.byMessageId.set("msg-1", {
      tokenCount: 0,
      allBlockIds: [],
      activeBlockIds: [],
    });

    await handleRecompressCommand(ctx);

    expect(state.prune.messages.blocksById.get(1)?.active).toBe(true);
    expect(state.prune.messages.activeBlockIds.has(1)).toBe(true);
    expect(state.prune.messages.activeByAnchorMessageId.get("msg-1")).toBe(1);
    expect(state.prune.messages.byMessageId.get("msg-1")?.activeBlockIds).toContain(1);
  });

  test("decompress → recompress round-trip", async () => {
    const state = makeState();
    state.messageIds.byRawId.set("raw-1", "m0001");
    state.messageIds.byRawId.set("raw-2", "m0002");
    state.prune.messages.byMessageId.set("raw-1", {
      tokenCount: 0,
      allBlockIds: [],
      activeBlockIds: [],
    });
    state.prune.messages.byMessageId.set("raw-2", {
      tokenCount: 0,
      allBlockIds: [],
      activeBlockIds: [],
    });

    const blockId = applyCompressionState(state, {
      mode: "range",
      startId: "m0001",
      endId: "m0002",
      summary: "summary",
      topic: "topic",
      anchorMessageId: "msg-1",
      compressMessageId: "msg-2",
      consumedBlockIds: [],
    });
    const ctx: BlockCommandContext = { ...makeCtx(state), args: [String(blockId)] };

    expect(state.prune.messages.blocksById.get(blockId)?.active).toBe(true);
    expect(state.prune.messages.activeBlockIds.has(blockId)).toBe(true);

    await handleDecompressCommand(ctx);

    expect(state.prune.messages.blocksById.get(blockId)?.active).toBe(false);
    expect(state.prune.messages.blocksById.get(blockId)?.deactivatedByUser).toBe(true);
    expect(state.prune.messages.activeBlockIds.has(blockId)).toBe(false);

    await handleRecompressCommand(ctx);

    expect(state.prune.messages.blocksById.get(blockId)?.active).toBe(true);
    expect(state.prune.messages.activeBlockIds.has(blockId)).toBe(true);
    expect(state.prune.messages.activeByAnchorMessageId.get("msg-1")).toBe(blockId);
    expect(state.prune.messages.byMessageId.get("raw-1")?.activeBlockIds).toContain(blockId);
    expect(state.prune.messages.byMessageId.get("raw-2")?.activeBlockIds).toContain(blockId);
  });

  test("recompress refuses non-user-decompressed block", async () => {
    const state = makeState();
    addBlock(state, 1, false);
    const block = state.prune.messages.blocksById.get(1)!;
    block.deactivatedByUser = false;
    block.deactivatedByBlockId = 2;
    const ctx: BlockCommandContext = { ...makeCtx(state), args: ["1"] };
    let captured: string | undefined;
    const origPrompt = noopClient.session.prompt;
    noopClient.session.prompt = async (opts: any) => {
      captured = opts.body.parts[0].text;
    };

    await handleRecompressCommand(ctx);

    expect(captured).toContain("not user-decompressed");

    noopClient.session.prompt = origPrompt;
  });

  test("block survives sync with empty messages", async () => {
    const state = makeState();
    addBlock(state, 1, true);

    syncCompressionBlocks(state, []);

    expect(state.prune.messages.blocksById.has(1)).toBe(true);
    expect(state.prune.messages.blocksById.get(1)?.active).toBe(false);
    expect(state.prune.messages.activeBlockIds.has(1)).toBe(false);
  });

  test("compress sets pendingManualTrigger", async () => {
    const state = makeState();
    const ctx = makeCtx(state);

    const prompt = await handleCompressCommand(ctx);

    expect(prompt).toContain("compress tool");
    expect(state.pendingManualTrigger).not.toBeNull();
    expect(state.pendingManualTrigger?.sessionId).toBe("session-1");
  });

  test("manual toggles manual mode", async () => {
    const state = makeState();
    const ctx = makeCtx(state);
    const origPrompt = noopClient.session.prompt;
    noopClient.session.prompt = async (opts: any) => {
      void opts.body.parts[0].text;
    };

    await handleManualToggleCommand(ctx);
    expect(state.manualMode).toBe("active");

    await handleManualToggleCommand(ctx);
    expect(state.manualMode).toBe(false);

    noopClient.session.prompt = origPrompt;
  });

  test("sweep prunes known tools", async () => {
    const state = makeState();
    state.prune.tools.delete("call-2");
    const ctx: SweepContext = {
      ...makeCtx(state),
      args: [],
      workingDirectory: "/tmp",
      messages: [
        { info: { id: "u1", role: "user" }, parts: [{ type: "text", text: "hello" }] },
        {
          info: { id: "a1", role: "assistant" },
          parts: [{ type: "tool", callID: "call-2", tool: "bash", state: { status: "completed", output: "done" } }],
        },
      ],
    };
    let captured: string | undefined;
    const origPrompt = noopClient.session.prompt;
    noopClient.session.prompt = async (opts: any) => {
      captured = opts.body.parts[0].text;
    };

    await handleSweepCommand(ctx);

    expect(captured).toContain("1");
    expect(state.prune.tools.has("call-2")).toBe(true);

    noopClient.session.prompt = origPrompt;
  });
});
