import { describe, expect, test } from "bun:test";
import {
  assignMessageRefs,
  filterProcessableMessages,
  formatBlockRef,
  formatMessageIdTag,
  formatMessageRef,
  getLastUserMessage,
  isIgnoredUserMessage,
  isMessageWithInfo,
  parseBlockRef,
  parseBoundaryId,
  parseMessageRef,
} from "./message-ids";
import type { SessionState, WithParts } from "./types";

const makeMessage = (overrides: Partial<WithParts> & { info?: Partial<WithParts["info"]> } = {}): WithParts => ({
  info: {
    id: "raw-1",
    role: "user",
    sessionID: "session-1",
    time: { created: 1 },
    ...overrides.info,
  },
  parts: overrides.parts ?? [],
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

describe("dcp message ids", () => {
  test("formats and parses refs", () => {
    expect(formatMessageRef(1)).toBe("m0001");
    expect(formatMessageRef(9999)).toBe("m9999");
    expect(() => formatMessageRef(0)).toThrow();

    expect(formatBlockRef(1)).toBe("b1");
    expect(parseMessageRef("m0001")).toBe(1);
    expect(parseMessageRef("m9999")).toBe(9999);
    expect(parseMessageRef("invalid")).toBeNull();
    expect(parseBlockRef("b1")).toBe(1);
    expect(parseBlockRef("b999")).toBe(999);
  });

  test("parses boundary ids and formats tags", () => {
    expect(parseBoundaryId("m0001")).toEqual({ kind: "message", ref: "m0001", index: 1 });
    expect(parseBoundaryId("b3")).toEqual({ kind: "compressed-block", ref: "b3", blockId: 3 });
    expect(parseBoundaryId("invalid")).toBeNull();

    expect(formatMessageIdTag("m0001", { b: "2", a: "x" })).toBe(
      '\n<dcp-message-id a="x" b="2">m0001</dcp-message-id>',
    );
  });

  test("detects message shapes and filters processable messages", () => {
    const valid = makeMessage();
    const invalid = { info: { id: "x" }, parts: [] };

    expect(isMessageWithInfo(valid)).toBe(true);
    expect(isMessageWithInfo(invalid)).toBe(false);
    expect(filterProcessableMessages([valid, invalid, null])).toEqual([valid]);
  });

  test("detects ignored user messages and last user message", () => {
    const ignored = makeMessage({ parts: [{ ignored: true }] as any[] });
    const active = makeMessage({ info: { id: "raw-2", role: "user" }, parts: [{ type: "text", text: "hi" }] as any[] });
    const assistant = makeMessage({ info: { id: "raw-3", role: "assistant" } });

    expect(isIgnoredUserMessage(ignored)).toBe(true);
    expect(isIgnoredUserMessage(active)).toBe(false);
    expect(getLastUserMessage([ignored, assistant, active])).toBe(active);
  });

  test("assigns sequential refs", () => {
    const state = makeState();
    const messages = Array.from({ length: 5 }, (_, index) =>
      makeMessage({
        info: { id: `raw-${index + 1}`, role: "user" },
        parts: [{ type: "text", text: `message ${index + 1}` }] as any[],
      }),
    );

    expect(assignMessageRefs(state, messages)).toBe(5);
    const messageIds: any = state.messageIds;
    expect(messageIds.byRawId.get("raw-1")).toBe("m0001");
    expect(messageIds.byRawId.get("raw-5")).toBe("m0005");
    expect(messageIds.byRef.get("m0003")).toBe("raw-3");
  });

  test("generates ids for messages missing raw ids", () => {
    const state = makeState();
    const messages = [
      makeMessage({ info: { id: "", role: "user" }, parts: [{ type: "text", text: "first" }] as any[] }),
      makeMessage({ info: { id: "", role: "assistant" } as any, parts: [{ type: "text", text: "second" }] as any[] }),
    ];

    expect(assignMessageRefs(state, messages)).toBe(2);
    expect(messages[0].info.id).toBe("msg_0");
    expect(messages[1].info.id).toBe("msg_1");
    const messageIds: any = state.messageIds;
    expect(messageIds.byRawId.get("msg_0")).toBe("m0001");
    expect(messageIds.byRawId.get("msg_1")).toBe("m0002");
  });
});
