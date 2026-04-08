import { describe, expect, test } from "bun:test";
import type { CompressionBlock, DCPConfig, SessionState } from "./types";
import type { ContextyConfig } from "../types";

const compressionBlock: CompressionBlock = {
  blockId: 1,
  runId: 2,
  active: true,
  deactivatedByUser: false,
  compressedTokens: 120,
  summaryTokens: 30,
  durationMs: 450,
  mode: "range",
  topic: "Session cleanup",
  batchTopic: "Batch pruning",
  startId: "msg-1",
  endId: "msg-10",
  anchorMessageId: "msg-1",
  compressMessageId: "msg-10",
  compressCallId: "call-1",
  includedBlockIds: [1, 2],
  consumedBlockIds: [2],
  parentBlockIds: [0],
  directMessageIds: ["msg-1"],
  directToolIds: ["tool-1"],
  effectiveMessageIds: ["msg-1", "msg-2"],
  effectiveToolIds: ["tool-1"],
  createdAt: 1000,
  deactivatedAt: 2000,
  deactivatedByBlockId: 3,
  summary: "Compressed summary",
};

const dcpConfig: DCPConfig = {
  enabled: true,
  debug: false,
  pruneNotification: "minimal",
  pruneNotificationType: "toast",
  commands: {
    enabled: true,
    protectedTools: ["task"],
  },
  manualMode: {
    enabled: true,
    automaticStrategies: false,
  },
  turnProtection: {
    enabled: true,
    turns: 3,
  },
  experimental: {
    allowSubAgents: true,
    customPrompts: false,
  },
  protectedFilePatterns: ["**/*.secret"],
  compress: {
    mode: "message",
    permission: "ask",
    showCompression: true,
    summaryBuffer: true,
    maxContextLimit: 90,
    minContextLimit: "30%",
    modelMaxLimits: { gpt4: 80 },
    modelMinLimits: { gpt4: "20%" },
    nudgeFrequency: 5,
    iterationNudgeThreshold: 2,
    nudgeForce: "soft",
    protectedTools: ["compress"],
    protectUserMessages: true,
  },
  strategies: {
    deduplication: {
      enabled: true,
      protectedTools: ["skill"],
    },
    purgeErrors: {
      enabled: true,
      turns: 4,
      protectedTools: ["write"],
    },
  },
};

const sessionState: SessionState = {
  sessionId: "session-1",
  isSubAgent: false,
  manualMode: "active",
  compressPermission: "allow",
  pendingManualTrigger: { sessionId: "session-1", prompt: "compress now" },
  prune: {
    tools: new Map([["compress", 1]]),
    messages: {
      byMessageId: new Map([[
        "msg-1",
        { tokenCount: 10, allBlockIds: [1, 2], activeBlockIds: [1] },
      ]]),
      blocksById: new Map([[1, compressionBlock]]),
      activeBlockIds: new Set([1]),
      activeByAnchorMessageId: new Map([["msg-1", 1]]),
      nextBlockId: 2,
      nextRunId: 3,
    },
  },
  nudges: {
    contextLimitAnchors: new Set(["msg-1"]),
    turnNudgeAnchors: new Set(["msg-2"]),
    iterationNudgeAnchors: new Set(["msg-3"]),
  },
  stats: {
    pruneTokenCounter: 10,
    totalPruneTokens: 20,
  },
  compressionTiming: {
    pendingByCallId: new Map([["call-1", 123]]),
  },
  toolParameters: new Map([["call-1", { tool: "compress", parameters: { a: 1 }, turn: 1, status: "completed" }]]),
  subAgentResultCache: new Map([["agent-1", "result"]]),
  toolIdList: ["tool-1"],
  messageIds: {
    byRawId: new Map([["raw-1", "ref-1"]]),
    byRef: new Map([["ref-1", "raw-1"]]),
    nextRef: 2,
  },
  lastCompaction: 111,
  currentTurn: 7,
  variant: "default",
  modelContextLimit: 100000,
  systemPromptTokens: 500,
};

describe("dcp types", () => {
  test("SessionState can be constructed with valid fixture data", () => {
    expect(sessionState.sessionId).toBe("session-1");
    expect(sessionState.prune.messages.blocksById.get(1)).toBe(compressionBlock);
    expect(sessionState.nudges.contextLimitAnchors.has("msg-1")).toBe(true);
  });

  test("ContextyConfig without dcp field is valid", () => {
    const config: ContextyConfig = {
      hscmm: {
        maxTokens: 1000,
        autoCleanupThreshold: 800,
        snapshotDir: ".contexty/snapshots",
      },
      tls: {
        enabled: true,
      },
      aasm: {
        mode: "active",
      },
    };

    expect(config.dcp).toBeUndefined();
  });

  test("DCPConfig with all fields is valid", () => {
    expect(dcpConfig.compress.mode).toBe("message");
    expect(dcpConfig.strategies.purgeErrors.turns).toBe(4);
  });

  test("CompressionBlock has all required fields", () => {
    expect(compressionBlock.blockId).toBe(1);
    expect(compressionBlock.summary).toContain("Compressed summary");
  });
});
