import { describe, expect, test } from "bun:test";
import { DCPLogger } from "../logger";
import type { CompressMessageToolArgs, ToolContext } from "./types";
import { compressMessage } from "./message";
import type { SessionState, WithParts, DCPConfig } from "../types";

const makeConfig = (): DCPConfig =>
  ({
    enabled: true,
    debug: false,
    pruneNotification: "off",
    pruneNotificationType: "chat",
    commands: { enabled: false, protectedTools: [] },
    manualMode: { enabled: false, automaticStrategies: false },
    turnProtection: { enabled: false, turns: 0 },
    experimental: { allowSubAgents: false, customPrompts: false },
    protectedFilePatterns: [],
    compress: {
      mode: "message",
      permission: "ask",
      showCompression: false,
      summaryBuffer: false,
      maxContextLimit: 0,
      minContextLimit: 0,
      nudgeFrequency: 0,
      iterationNudgeThreshold: 0,
      nudgeForce: "soft",
      protectedTools: [],
      protectUserMessages: false,
    },
    strategies: {
      deduplication: { enabled: false, protectedTools: [] },
      purgeErrors: { enabled: false, turns: 0, protectedTools: [] },
    },
  }) as DCPConfig;

const makeState = (): SessionState => ({
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
  nudges: {
    contextLimitAnchors: new Set(),
    turnNudgeAnchors: new Set(),
    iterationNudgeAnchors: new Set(),
  },
  stats: { pruneTokenCounter: 0, totalPruneTokens: 0 },
  compressionTiming: { pendingByCallId: new Map() },
  toolParameters: new Map(),
  subAgentResultCache: new Map(),
  toolIdList: [],
  messageIds: { byRawId: new Map(), byRef: new Map(), nextRef: 1 },
  lastCompaction: 0,
  currentTurn: 0,
  variant: undefined,
  modelContextLimit: undefined,
  systemPromptTokens: undefined,
});

const createMessage = (rawId: string, ref: string, role: string, text: string, toolId?: string): WithParts => ({
  info: { id: rawId, role, sessionID: "session-1", time: { created: Date.now() } },
  parts: [
    { type: "text", text },
    ...(toolId
      ? [{ type: "tool", tool: toolId, callID: toolId, state: { status: "completed", input: {}, output: "done" } }]
      : []),
  ],
});

const makeContext = (messages: WithParts[], config = makeConfig(), state = makeState()): ToolContext => {
  messages.forEach((message, index) => {
    const ref = `m${String(index + 1).padStart(4, "0")}`;
    state.messageIds.byRawId.set(message.info.id, ref);
    state.messageIds.byRef.set(ref, message.info.id);
    state.prune.messages.byMessageId.set(message.info.id, { tokenCount: 10, allBlockIds: [], activeBlockIds: [] });
  });

  return {
    sessionId: "session-1",
    client: { messages },
    state,
    config,
    logger: new DCPLogger(),
  };
};

describe("dcp compress message", () => {
  test("compresses a single message into a compression block", async () => {
    const messages = [createMessage("raw-1", "m0001", "user", "hello")];
    const ctx = makeContext(messages);
    const args: CompressMessageToolArgs = {
      topic: "topic",
      content: [{ messageId: "m0001", topic: "entry-topic", summary: "summary" }],
    };

    const result = await compressMessage(ctx, args, "call-1");

    expect(result).toContain("1 message(s)");
    expect(ctx.state.prune.messages.blocksById.size).toBe(1);
    const block = Array.from(ctx.state.prune.messages.blocksById.values())[0];
    expect(block?.mode).toBe("message");
    expect(block?.topic).toBe("entry-topic");
    expect(block?.startId).toBe("m0001");
    expect(block?.endId).toBe("m0001");
    expect(ctx.state.compressionTiming.pendingByCallId.has("call-1")).toBe(false);
  });

  test("rejects empty content arrays", async () => {
    const ctx = makeContext([createMessage("raw-1", "m0001", "user", "hello")]);

    await expect(
      compressMessage(ctx, { topic: "topic", content: [] }, "call-1"),
    ).rejects.toThrow("Compression content must be a non-empty array.");
  });

  test("compresses multiple messages into separate blocks", async () => {
    const messages = [
      createMessage("raw-1", "m0001", "user", "one"),
      createMessage("raw-2", "m0002", "assistant", "two"),
    ];
    const ctx = makeContext(messages);

    const result = await compressMessage(
      ctx,
      {
        topic: "topic",
        content: [
          { messageId: "m0001", topic: "first", summary: "summary 1" },
          { messageId: "m0002", topic: "second", summary: "summary 2" },
        ],
      },
      "call-1",
    );

    expect(result).toContain("2 block(s)");
    expect(ctx.state.prune.messages.blocksById.size).toBe(2);
    expect(Array.from(ctx.state.prune.messages.blocksById.values()).map((block) => block.topic)).toEqual([
      "first",
      "second",
    ]);
  });

  test("appends protected tool warnings to summaries", async () => {
    const messages = [createMessage("raw-1", "m0001", "assistant", "hello", "secret-tool")];
    const ctx = makeContext(messages, {
      ...makeConfig(),
      compress: { ...makeConfig().compress, mode: "message", protectedTools: ["secret-tool"] },
    });

    await compressMessage(
      ctx,
      { topic: "topic", content: [{ messageId: "m0001", topic: "entry", summary: "summary" }] },
      "call-1",
    );

    const block = Array.from(ctx.state.prune.messages.blocksById.values())[0];
    expect(block?.summary).toContain("protected tools were used");
    expect(block?.summary).toContain("secret-tool");
  });
});
