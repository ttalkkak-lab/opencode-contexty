import { describe, expect, test } from "bun:test";
import { compressRange } from "./range";
import { DCPLogger } from "../logger";
import type { DCPConfig, SessionState, WithParts } from "../types";

const makeConfig = (): DCPConfig => ({
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
    mode: "range",
    permission: "allow",
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
});

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

const makeMessages = (count: number, toolAt = 3): WithParts[] =>
  Array.from({ length: count }, (_, index) => {
    const n = index + 1;
    return {
      info: {
        id: `raw-${n}`,
        role: n % 2 === 0 ? "assistant" : "user",
        sessionID: "session-1",
        time: { created: n },
      },
      parts: [
        { type: "text", text: `message ${n}` },
        n === toolAt
          ? { type: "tool", tool: "write", callID: "call-3", state: { status: "completed", input: {}, output: "ok" } }
          : { type: "text", text: "" },
      ],
    } as WithParts;
  });

const seedRefs = (state: SessionState, messages: WithParts[]): void => {
  messages.forEach((message, index) => {
    const ref = `m${String(index + 1).padStart(4, "0")}`;
    state.messageIds.byRawId.set(message.info.id, ref);
    state.messageIds.byRef.set(ref, message.info.id);
    state.prune.messages.byMessageId.set(message.info.id, {
      tokenCount: 10,
      allBlockIds: [],
      activeBlockIds: [],
    });
  });
};

const makeContext = (state: SessionState, messages: WithParts[]) => ({
  sessionId: "session-1",
  client: {},
  state,
  config: makeConfig(),
  logger: new DCPLogger(),
  messages,
});

describe("dcp compress range", () => {
  test("compresses a valid range and marks messages compacted", async () => {
    const state = makeState();
    const messages = makeMessages(10);
    seedRefs(state, messages);

    const result = await compressRange(makeContext(state, messages), {
      topic: "Range topic",
      content: [{ startId: "m0001", endId: "m0005", summary: "summary" }],
    }, "call-1");

    expect(result).toContain("Compressed 5 messages into 1 block");
    expect(state.prune.messages.blocksById.size).toBe(1);
    expect(state.prune.messages.activeBlockIds.size).toBe(1);
    expect(state.prune.messages.byMessageId.get("raw-1")?.activeBlockIds).toHaveLength(1);
    expect(state.prune.messages.byMessageId.get("raw-5")?.activeBlockIds).toHaveLength(1);
  });

  test("rejects empty content", async () => {
    const state = makeState();
    const messages = makeMessages(10);
    seedRefs(state, messages);

    await expect(compressRange(makeContext(state, messages), { topic: "Range topic", content: [] }, "call-1")).rejects.toThrow(
      /content/i,
    );
  });

  test("rejects overlapping ranges", async () => {
    const state = makeState();
    const messages = makeMessages(10);
    seedRefs(state, messages);

    await expect(
      compressRange(
        makeContext(state, messages),
        {
          topic: "Range topic",
          content: [
            { startId: "m0001", endId: "m0004", summary: "summary 1" },
            { startId: "m0004", endId: "m0006", summary: "summary 2" },
          ],
        },
        "call-1",
      ),
    ).rejects.toThrow(/overlap/i);
  });

  test("compresses multiple non-overlapping ranges", async () => {
    const state = makeState();
    const messages = makeMessages(10);
    seedRefs(state, messages);

    await compressRange(
      makeContext(state, messages),
      {
        topic: "Range topic",
        content: [
          { startId: "m0001", endId: "m0003", summary: "summary 1" },
          { startId: "m0005", endId: "m0007", summary: "summary 2" },
        ],
      },
      "call-1",
    );

    expect(state.prune.messages.blocksById.size).toBe(2);
    expect(state.prune.messages.activeBlockIds.size).toBe(2);
  });

  test("appends protected tool warning to the stored summary", async () => {
    const state = makeState();
    const messages = makeMessages(10, 2);
    seedRefs(state, messages);
    const config = makeConfig();
    config.compress.protectedTools = ["write"];

    await compressRange(
      {
        sessionId: "session-1",
        client: {},
        state,
        config,
        logger: new DCPLogger(),
        messages,
      },
      {
        topic: "Range topic",
        content: [{ startId: "m0001", endId: "m0005", summary: "summary" }],
      },
      "call-1",
    );

    expect(state.prune.messages.blocksById.get(1)?.summary).toContain("protected tools were used");
    expect(state.prune.messages.blocksById.get(1)?.summary).toContain("write");
  });
});
