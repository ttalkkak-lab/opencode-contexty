import { describe, expect, test } from "bun:test";
import { handleCompressionEvent } from "./event-handler";
import type { SessionState } from "./types";

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
      blocksById: new Map([[1, {
        blockId: 1,
        runId: 1,
        active: true,
        deactivatedByUser: false,
        compressedTokens: 0,
        summaryTokens: 5,
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
        effectiveMessageIds: [],
        effectiveToolIds: [],
        createdAt: 1,
        summary: "summary",
      }]]),
      activeBlockIds: new Set([1]),
      activeByAnchorMessageId: new Map(),
      nextBlockId: 2,
      nextRunId: 2,
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

describe("dcp event handler", () => {
  test("records timing when compress tool starts", () => {
    const state = makeState();

    handleCompressionEvent(state, {
      type: "message.part.updated",
      part: { type: "tool", tool: "compress", callID: "call-1", state: { status: "running" } },
    });

    expect(state.compressionTiming.pendingByCallId.has("call-1")).toBe(true);
  });

  test("applies timing to block when compress tool completes", () => {
    const state = makeState();
    state.compressionTiming.pendingByCallId.set("call-1", Date.now() - 25);

    handleCompressionEvent(state, {
      type: "message.part.updated",
      part: {
        type: "tool",
        tool: "compress",
        callID: "call-1",
        state: { status: "completed", output: { blockId: 1 } },
      },
    });

    expect(state.compressionTiming.pendingByCallId.has("call-1")).toBe(false);
    expect(state.prune.messages.blocksById.get(1)?.durationMs).toBeGreaterThan(0);
  });

  test("ignores non-compress tool events", () => {
    const state = makeState();

    handleCompressionEvent(state, {
      type: "message.part.updated",
      part: { type: "tool", tool: "search", callID: "call-1", state: { status: "running" } },
    });

    expect(state.compressionTiming.pendingByCallId.size).toBe(0);
  });

  test("removes pending timing when completion has no block id", () => {
    const state = makeState();
    state.compressionTiming.pendingByCallId.set("call-1", Date.now() - 25);

    handleCompressionEvent(state, {
      type: "message.part.updated",
      part: { type: "tool", tool: "compress", callID: "call-1", state: { status: "completed", output: "done" } },
    });

    expect(state.compressionTiming.pendingByCallId.has("call-1")).toBe(false);
    expect(state.prune.messages.blocksById.get(1)?.durationMs).toBe(0);
  });

  test("ignores events without a part", () => {
    const state = makeState();

    expect(() => {
      handleCompressionEvent(state, { type: "message.part.updated" });
    }).not.toThrow();

    expect(state.compressionTiming.pendingByCallId.size).toBe(0);
  });
});
