import { describe, expect, test } from "../testShim";
import { buildPriorityMap, classifyMessagePriority } from "./priority";
import type { SessionState, WithParts } from "../types";

function createState(): SessionState {
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
    currentTurn: 1,
    variant: undefined,
    modelContextLimit: 1000,
    systemPromptTokens: 0,
  };
}

function message(id: string, role: string, created: number, parts: any[] = []): WithParts {
  return { info: { id, role, sessionID: "session-1", time: { created } }, parts };
}

describe("dcp priority", () => {
  test("classifyMessagePriority returns high for old user messages with tools", () => {
    const state = createState();
    const msg = message(
      "raw-1",
      "user",
      Date.now() - 2 * 24 * 60 * 60 * 1000,
      [{ type: "tool", callID: "call-1", tool: "search" }, { type: "tool", callID: "call-2", tool: "read" }],
    );

    expect(classifyMessagePriority(msg, state)).toBe("high");
  });

  test("classifyMessagePriority returns low for recent messages", () => {
    const state = createState();
    const msg = message("raw-2", "assistant", Date.now() - 1000, [{ type: "text", text: "hello" }]);

    expect(classifyMessagePriority(msg, state)).toBe("low");
  });

  test("buildPriorityMap returns the expected priorities", () => {
    const state = createState();
    const messages = [
      message("raw-1", "user", Date.now() - 2 * 24 * 60 * 60 * 1000, [{ type: "tool", callID: "call-1", tool: "search" }, { type: "tool", callID: "call-2", tool: "read" }]),
      message("raw-2", "assistant", Date.now() - 1000, [{ type: "text", text: "hello" }]),
      message("raw-3", "assistant", Date.now() - 2 * 60 * 60 * 1000, [{ type: "text", text: "middle" }]),
    ];

    const priorities = buildPriorityMap(messages, state);

    expect(priorities.get("raw-1")).toBe("high");
    expect(priorities.get("raw-2")).toBe("low");
    expect(priorities.get("raw-3")).toBe("medium");
  });
});
