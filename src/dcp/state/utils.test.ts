import { describe, expect, test } from "bun:test";
import { applyCompressionState, deactivateBlock } from "../compress/state";
import { getActiveSummaryTokenUsage, getMessageRef, isMessageCompacted } from "./utils";
import type { SessionState, WithParts } from "../types";

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

const message = (id: string): WithParts => ({
  info: {
    id,
    role: "assistant",
    sessionID: "session-1",
    time: { created: 1 },
  },
  parts: [],
});

describe("dcp state utils", () => {
  test("isMessageCompacted returns true for active block coverage", () => {
    const state = makeState();
    state.messageIds.byRawId.set("raw-1", "m0001");
    state.prune.messages.byMessageId.set("raw-1", { tokenCount: 5, allBlockIds: [1], activeBlockIds: [1] });
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

    expect(isMessageCompacted(state, message("raw-1"))).toBe(true);
  });

  test("isMessageCompacted returns false with no blocks", () => {
    expect(isMessageCompacted(makeState(), message("raw-1"))).toBe(false);
  });

  test("isMessageCompacted returns false for deactivated block", () => {
    const state = makeState();
    state.messageIds.byRawId.set("raw-1", "m0001");
    state.prune.messages.byMessageId.set("raw-1", { tokenCount: 5, allBlockIds: [1], activeBlockIds: [1] });
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
    deactivateBlock(state, 1, "compression");

    expect(isMessageCompacted(state, message("raw-1"))).toBe(false);
  });

  test("getActiveSummaryTokenUsage sums active blocks", () => {
    const state = makeState();
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
      effectiveMessageIds: [],
      effectiveToolIds: [],
      createdAt: 1,
      summary: "summary",
    });
    state.prune.messages.blocksById.set(2, {
      blockId: 2,
      runId: 2,
      active: true,
      deactivatedByUser: false,
      compressedTokens: 0,
      summaryTokens: 15,
      durationMs: 0,
      topic: "topic",
      startId: "m0002",
      endId: "m0002",
      anchorMessageId: "raw-2",
      compressMessageId: "raw-2",
      includedBlockIds: [],
      consumedBlockIds: [],
      parentBlockIds: [],
      directMessageIds: [],
      directToolIds: [],
      effectiveMessageIds: [],
      effectiveToolIds: [],
      createdAt: 1,
      summary: "summary",
    });
    state.prune.messages.activeBlockIds = new Set([1, 2]);

    expect(getActiveSummaryTokenUsage(state)).toBe(25);
  });

  test("getMessageRef returns ref for known message", () => {
    const state = makeState();
    state.messageIds.byRawId.set("raw-1", "m0001");

    expect(getMessageRef(state, message("raw-1"))).toBe("m0001");
  });
});
