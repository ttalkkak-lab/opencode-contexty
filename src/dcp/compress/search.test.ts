/// <reference types="bun-types" />
import { describe, expect, test } from "bun:test";
import { DCPLogger } from "../logger";
import type { DCPConfig, SessionState, WithParts } from "../types";
import { resolveMessage, resolveRange } from "./search";

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
      mode: "range",
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

const makeMessages = (count: number): WithParts[] =>
  Array.from({ length: count }, (_, index) => {
    const n = index + 1;
    return {
      info: { id: `raw-${n}`, role: n % 2 === 0 ? "assistant" : "user", sessionID: "session-1", time: { created: n } },
      parts: [
        { type: "text", text: `message ${n}` },
        n === 3 ? { type: "tool", tool: "write", callID: "call-3", state: { status: "completed", input: {}, output: "ok" } } : { type: "text", text: "" },
      ],
    } as WithParts;
  });

describe("dcp compress search", () => {
  test("resolveRange with m0001-m0005 covers exactly messages 1-5", () => {
    const state = makeState();
    const messages = makeMessages(10);
    messages.forEach((message, index) => {
      state.messageIds.byRawId.set(message.info.id, `m${String(index + 1).padStart(4, "0")}`);
      state.messageIds.byRef.set(`m${String(index + 1).padStart(4, "0")}`, message.info.id);
    });

    const resolved = resolveRange({ state, config: makeConfig(), messages, logger: new DCPLogger() }, "m0001", "m0005");

    expect(resolved.messageIds).toEqual(["raw-1", "raw-2", "raw-3", "raw-4", "raw-5"]);
    expect(resolved.toolIds).toContain("call-3");
  });

  test("resolveRange with m0001-m0010 on 10 messages covers all", () => {
    const state = makeState();
    const messages = makeMessages(10);
    messages.forEach((message, index) => {
      state.messageIds.byRawId.set(message.info.id, `m${String(index + 1).padStart(4, "0")}`);
      state.messageIds.byRef.set(`m${String(index + 1).padStart(4, "0")}`, message.info.id);
    });

    const resolved = resolveRange({ state, config: makeConfig(), messages, logger: new DCPLogger() }, "m0001", "m0010");

    expect(resolved.messageIds).toHaveLength(10);
    expect(resolved.messageIds[0]).toBe("raw-1");
    expect(resolved.messageIds[9]).toBe("raw-10");
  });

  test("resolveRange with invalid refs throws error", () => {
    const state = makeState();
    const messages = makeMessages(2);

    expect(() => resolveRange({ state, config: makeConfig(), messages, logger: new DCPLogger() }, "bad", "m0002")).toThrow();
  });

  test("resolveMessage with valid mNNNN ref returns correct message", () => {
    const state = makeState();
    const messages = makeMessages(3);
    messages.forEach((message, index) => {
      state.messageIds.byRawId.set(message.info.id, `m${String(index + 1).padStart(4, "0")}`);
      state.messageIds.byRef.set(`m${String(index + 1).padStart(4, "0")}`, message.info.id);
    });

    const resolved = resolveMessage({ state, config: makeConfig(), messages, logger: new DCPLogger() }, "m0002");

    expect(resolved.messageIds).toEqual(["raw-2"]);
  });

  test("resolveMessage with raw ID returns correct message", () => {
    const state = makeState();
    const messages = makeMessages(3);
    messages.forEach((message, index) => {
      state.messageIds.byRawId.set(message.info.id, `m${String(index + 1).padStart(4, "0")}`);
      state.messageIds.byRef.set(`m${String(index + 1).padStart(4, "0")}`, message.info.id);
    });

    const resolved = resolveMessage({ state, config: makeConfig(), messages, logger: new DCPLogger() }, "raw-2");

    expect(resolved.messageIds).toEqual(["raw-2"]);
  });
});
