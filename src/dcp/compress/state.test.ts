import { describe, expect, test } from "bun:test";
import {
  allocateBlockId,
  allocateRunId,
  applyCompressionState,
  deactivateBlock,
  wrapCompressedSummary,
} from "./state";
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

const addMessage = (state: SessionState, rawId: string, ref: string, tokenCount: number): void => {
  state.messageIds.byRawId.set(rawId, ref);
  state.messageIds.byRef.set(ref, rawId);
  state.prune.messages.byMessageId.set(rawId, {
    tokenCount,
    allBlockIds: [],
    activeBlockIds: [],
  });
};

describe("dcp compress state", () => {
  test("allocates sequential block ids", () => {
    const state = makeState();

    expect(allocateBlockId(state)).toBe(1);
    expect(allocateBlockId(state)).toBe(2);
    expect(allocateBlockId(state)).toBe(3);
  });

  test("allocates sequential run ids", () => {
    const state = makeState();

    expect(allocateRunId(state)).toBe(1);
    expect(allocateRunId(state)).toBe(2);
  });

  test("applies compression state and marks covered messages", () => {
    const state = makeState();
    addMessage(state, "raw-1", "m0001", 10);
    addMessage(state, "raw-2", "m0002", 20);
    addMessage(state, "raw-3", "m0003", 30);

    const blockId = applyCompressionState(state, {
      mode: "range",
      startId: "m0001",
      endId: "m0002",
      summary: "Compressed summary",
      topic: "topic",
      anchorMessageId: "raw-1",
      compressMessageId: "raw-3",
      consumedBlockIds: [],
    });

    const block = state.prune.messages.blocksById.get(blockId);
    expect(block?.active).toBe(true);
    expect(block?.topic).toBe("topic");
    expect(block?.summary).toBe("Compressed summary");
    expect(block?.summaryTokens).toBeGreaterThan(0);
    expect(block?.effectiveMessageIds).toEqual(["raw-1", "raw-2"]);
    expect(state.prune.messages.activeBlockIds.has(blockId)).toBe(true);
    expect(state.prune.messages.activeByAnchorMessageId.get("raw-1")).toBe(blockId);
    expect(state.prune.messages.byMessageId.get("raw-1")?.activeBlockIds).toContain(blockId);
    expect(state.prune.messages.byMessageId.get("raw-2")?.activeBlockIds).toContain(blockId);
  });

  test("deactivates block and removes active references", () => {
    const state = makeState();
    addMessage(state, "raw-1", "m0001", 10);

    const blockId = applyCompressionState(state, {
      mode: "range",
      startId: "m0001",
      endId: "m0001",
      summary: "summary",
      topic: "topic",
      anchorMessageId: "raw-1",
      compressMessageId: "raw-1",
      consumedBlockIds: [],
    });

    deactivateBlock(state, blockId, "user");

    expect(state.prune.messages.blocksById.get(blockId)?.active).toBe(false);
    expect(state.prune.messages.activeBlockIds.has(blockId)).toBe(false);
    expect(state.prune.messages.activeByAnchorMessageId.has("raw-1")).toBe(false);
    expect(state.prune.messages.byMessageId.get("raw-1")?.activeBlockIds).not.toContain(blockId);
  });

  test("wraps compressed summary with block header", () => {
    expect(wrapCompressedSummary(3, " hello ")).toContain("[Compressed conversation section]");
    expect(wrapCompressedSummary(3, " hello ")).toContain("hello");
    expect(wrapCompressedSummary(3, " hello ")).toContain("<dcp-message-id>b3</dcp-message-id>");
  });
});
