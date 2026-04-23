import { describe, expect, test } from "bun:test";
import {
  appendToAllToolParts,
  appendToLastTextPart,
  appendToTextPart,
  appendToToolPart,
  createSyntheticTextPart,
  createSyntheticUserMessage,
  hasContent,
  replaceBlockIdsWithBlocked,
  stripHallucinations,
  stripHallucinationsFromString,
} from "./utils";
import { buildToolIdList } from "./sync";
import type { SessionState, WithParts } from "../types";

const baseMessage: WithParts = {
  info: {
    id: "raw-1",
    role: "assistant",
    sessionID: "session-1",
    agent: "agent-1",
    model: "model-1",
    time: { created: 1 },
  },
  parts: [],
};

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

describe("dcp message utils", () => {
  test("creates synthetic messages and text parts", () => {
    const synthetic = createSyntheticUserMessage(baseMessage, "hello", "variant-a", "seed-a");
    const syntheticAny: any = synthetic;
    expect(syntheticAny.info.role).toBe("user");
    expect(syntheticAny.info.id).toMatch(/^msg_dcp_summary_/);
    expect(syntheticAny.parts[0].text).toBe("hello");

    const textPart = createSyntheticTextPart(baseMessage, "world", "seed-b");
    expect(textPart.type).toBe("text");
    expect(textPart.text).toBe("world");
  });

  test("appends to text and tool parts", () => {
    const msg: WithParts = {
      ...baseMessage,
      parts: [{ type: "text", text: "base" }, { type: "tool", state: { status: "completed", output: "out" } }] as any[],
    };
    const msgAny: any = msg;

    expect(appendToLastTextPart(msg, "injection")).toBe(true);
    expect(msgAny.parts[0].text).toContain("injection");
    expect(appendToTextPart(msgAny.parts[0], "more")).toBe(true);
    expect(appendToToolPart(msgAny.parts[1], "<tag>")).toBe(true);
    expect(appendToAllToolParts(msg, "<all>")).toBe(true);
  });

  test("reports content and builds tool id list", () => {
    const msg: WithParts = {
      ...baseMessage,
      parts: [
        { type: "text", text: "hi" },
        { type: "tool", tool: "compress", callID: "call-1", state: { status: "completed", output: "ok" } },
      ] as any[],
    };
    const state = makeState();

    expect(hasContent(msg)).toBe(true);
    expect(buildToolIdList(state, [msg])).toEqual(["call-1"]);
    expect(state.toolIdList).toEqual(["call-1"]);
  });

  test("strips hallucinations and replaces blocked ids", () => {
    expect(stripHallucinationsFromString("<dcp>x</dcp><x>y</x>")).toBe("<x>y</x>");
    expect(replaceBlockIdsWithBlocked('<dcp-message-id>b3</dcp-message-id>')).toBe(
      '<dcp-message-id>BLOCKED</dcp-message-id>',
    );

    const messages: WithParts[] = [
      {
        info: { id: "raw-2", role: "assistant", sessionID: "session-1", time: { created: 2 } },
        parts: [
          { type: "text", text: "<dcp>noise</dcp>keep" },
          { type: "tool", state: { status: "completed", output: "<dcp>tag</dcp>ok" } },
        ],
      },
    ];

    stripHallucinations(messages);
    const messagesAny: any = messages;
    expect(messagesAny[0].parts[0].text).toBe("keep");
    expect(messagesAny[0].parts[1].state.output).toBe("ok");
  });
});
