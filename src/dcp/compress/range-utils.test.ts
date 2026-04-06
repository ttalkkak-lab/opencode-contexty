/// <reference types="bun-types" />
import { describe, expect, test } from "bun:test";
import {
  appendMissingBlockSummaries,
  injectBlockPlaceholders,
  parseBlockPlaceholders,
  validateNonOverlapping,
  validateSummaryPlaceholders,
} from "./range-utils";
import type { SessionState } from "../types";

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
      blocksById: new Map([
        [1, {
          blockId: 1,
          runId: 1,
          active: true,
          deactivatedByUser: false,
          compressedTokens: 0,
          summaryTokens: 0,
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
          summary: "summary 1",
        }],
      ]),
      activeBlockIds: new Set(),
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

describe("dcp compress range utils", () => {
  test("validateNonOverlapping with non-overlapping ranges does not throw", () => {
    expect(() => validateNonOverlapping([
      { startId: "m0001", endId: "m0002" },
      { startId: "m0003", endId: "m0004" },
    ])).not.toThrow();
  });

  test("validateNonOverlapping with overlapping ranges throws", () => {
    expect(() => validateNonOverlapping([
      { startId: "m0001", endId: "m0004" },
      { startId: "m0003", endId: "m0005" },
    ])).toThrow();
  });

  test("parseBlockPlaceholders finds block refs in order", () => {
    expect(parseBlockPlaceholders("(b1) and (b3)").map((placeholder) => placeholder.blockId)).toEqual([1, 3]);
  });

  test("validateSummaryPlaceholders accepts valid block refs", () => {
    expect(() => validateSummaryPlaceholders("(b1) and (b3)", [1, 3])).not.toThrow();
  });

  test("validateSummaryPlaceholders rejects invalid block refs", () => {
    expect(() => validateSummaryPlaceholders("(b1) and (b3)", [1])).toThrow();
  });

  test("injectBlockPlaceholders replaces placeholders", () => {
    expect(injectBlockPlaceholders("(b1)", new Map([[1, "hello"]]))).toBe("hello");
  });

  test("appendMissingBlockSummaries appends missing summaries", () => {
    const state = makeState();
    expect(appendMissingBlockSummaries("summary", [1], state)).toContain("### (b1)");
  });
});
