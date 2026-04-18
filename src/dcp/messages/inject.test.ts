import { describe, expect, test } from "../testShim";
import { injectCompressNudges, injectMessageIds } from "./inject";
import type { DCPConfig, SessionState, WithParts } from "../types";

function createMessage(id: string, role: string, text: string, created = Date.now()): WithParts {
  return {
    info: { id, role, sessionID: "session-1", time: { created } },
    parts: [{ type: "text", text }] as any[],
  };
}

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

function createConfig(maxContextLimit: DCPConfig["compress"]["maxContextLimit"]): DCPConfig {
  return {
    enabled: true,
    debug: false,
    pruneNotification: "off",
    pruneNotificationType: "chat",
    commands: { enabled: true, protectedTools: [] },
    manualMode: { enabled: true, automaticStrategies: true },
    turnProtection: { enabled: false, turns: 0 },
    experimental: { allowSubAgents: true, customPrompts: true },
    protectedFilePatterns: [],
    compress: {
      mode: "message",
      permission: "allow",
      showCompression: false,
      summaryBuffer: false,
      maxContextLimit,
      minContextLimit: 0,
      nudgeFrequency: 2,
      iterationNudgeThreshold: 1,
      nudgeForce: "soft",
      protectedTools: [],
      protectUserMessages: false,
    },
    strategies: {
      deduplication: { enabled: true, protectedTools: [] },
      purgeErrors: { enabled: true, turns: 3, protectedTools: [] },
    },
  };
}

describe("dcp inject", () => {
  test("injectCompressNudges injects a nudge over the threshold", () => {
    const state = createState();
    const config = createConfig("80%");
    const messages = [
      createMessage("raw-1", "user", Array.from({ length: 900 }, () => "word").join(" "), Date.now() - 10_000),
    ];

    injectCompressNudges(config, state, messages);

    expect(messages.length).toBe(2);
    expect(messages[1].info.role).toBe("user");
    expect(JSON.stringify(messages[1].parts)).toContain("DCP context-limit nudge");
    expect(state.nudges.contextLimitAnchors.has("raw-1")).toBe(true);
  });

  test("injectCompressNudges does nothing under the threshold", () => {
    const state = createState();
    const config = createConfig("80%");
    const messages = [createMessage("raw-1", "user", "hello", Date.now() - 10_000)];

    injectCompressNudges(config, state, messages);

    expect(messages.length).toBe(1);
    expect(state.nudges.contextLimitAnchors.size).toBe(0);
  });

  test("injectCompressNudges does not duplicate an existing nudge anchor", () => {
    const state = createState();
    state.nudges.contextLimitAnchors.add("raw-1");
    const config = createConfig("80%");
    const messages = [
      createMessage("raw-1", "user", Array.from({ length: 900 }, () => "word").join(" "), Date.now() - 10_000),
    ];

    injectCompressNudges(config, state, messages);

    expect(messages.length).toBe(1);
  });

  test("injectMessageIds assigns refs and injects tags", () => {
    const state = createState();
    const messages = [
      createMessage("raw-1", "user", "one"),
      createMessage("raw-2", "assistant", "two"),
      createMessage("raw-3", "user", "three"),
      createMessage("raw-4", "assistant", "four"),
      createMessage("raw-5", "user", "five"),
    ];

    const assigned = injectMessageIds(state, messages);

    expect(assigned).toBe(5);
    expect(messages.every((message) => JSON.stringify(message.parts).includes("<dcp-message-id>m"))).toBe(true);
  });

  test("injectMessageIds returns 0 for already assigned messages", () => {
    const state = createState();
    const messages = [createMessage("raw-1", "user", "one")];

    expect(injectMessageIds(state, messages)).toBe(1);
    expect(injectMessageIds(state, messages)).toBe(0);
  });
});
