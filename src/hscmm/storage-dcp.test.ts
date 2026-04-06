import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import fs from "fs/promises";
import os from "os";
import path from "path";
import {
  deletePruningState,
  readCompressionBlocks,
  readPruningState,
  writeCompressionBlocks,
  writePruningState,
} from "./storage";
import type { CompressionBlock, SessionState } from "../dcp/types";

const makeCompressionBlock = (overrides: Partial<CompressionBlock> = {}): CompressionBlock => ({
  blockId: 1,
  runId: 2,
  active: true,
  deactivatedByUser: false,
  compressedTokens: 120,
  summaryTokens: 30,
  durationMs: 450,
  topic: "Session cleanup",
  startId: "msg-1",
  endId: "msg-10",
  anchorMessageId: "msg-1",
  compressMessageId: "msg-10",
  includedBlockIds: [1, 2],
  consumedBlockIds: [2],
  parentBlockIds: [0],
  directMessageIds: ["msg-1"],
  directToolIds: ["tool-1"],
  effectiveMessageIds: ["msg-1", "msg-2"],
  effectiveToolIds: ["tool-1"],
  createdAt: 1000,
  summary: "Compressed summary",
  ...overrides,
});

const makeFullSessionState = (): SessionState => ({
  sessionId: "session-1",
  isSubAgent: false,
  manualMode: "active",
  compressPermission: "allow",
  pendingManualTrigger: { sessionId: "session-1", prompt: "compress now" },
  prune: {
    tools: new Map([["compress", 1]]),
    messages: {
      byMessageId: new Map([["msg-1", { tokenCount: 10, allBlockIds: [1, 2], activeBlockIds: [1] }]]),
      blocksById: new Map([[1, makeCompressionBlock()]]),
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
});

const makeEmptySessionState = (): SessionState => ({
  sessionId: null,
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
  stats: {
    pruneTokenCounter: 0,
    totalPruneTokens: 0,
  },
  compressionTiming: {
    pendingByCallId: new Map(),
  },
  toolParameters: new Map(),
  subAgentResultCache: new Map(),
  toolIdList: [],
  messageIds: {
    byRawId: new Map(),
    byRef: new Map(),
    nextRef: 1,
  },
  lastCompaction: 0,
  currentTurn: 0,
  variant: undefined,
  modelContextLimit: undefined,
  systemPromptTokens: undefined,
});

describe("dcp storage persistence", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "contexty-dcp-storage-"));
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it("returns null when pruning state is missing", async () => {
    expect(readPruningState(tempDir, "ses_missing")).resolves.toBeNull();
  });

  it("roundtrips a full pruning state", async () => {
    const state = makeFullSessionState();

    await writePruningState(tempDir, "ses_test", state);

    expect(readPruningState(tempDir, "ses_test")).resolves.toEqual(state);
  });

  it("roundtrips an empty pruning state", async () => {
    const state = makeEmptySessionState();

    await writePruningState(tempDir, "ses_empty", state);

    expect(readPruningState(tempDir, "ses_empty")).resolves.toEqual(state);
  });

  it("writes pruning state to disk", async () => {
    const state = makeFullSessionState();

    await writePruningState(tempDir, "ses_disk", state);

    const content = JSON.parse(await fs.readFile(path.join(tempDir, ".contexty", "sessions", "ses_disk", "pruning-state.json"), "utf8"));
    expect(content.prune.tools).toEqual([["compress", 1]]);
    expect(content.nudges.contextLimitAnchors).toEqual(["msg-1"]);
  });

  it("deletes pruning state cleanup files", async () => {
    const state = makeFullSessionState();

    await writePruningState(tempDir, "ses_cleanup", state);
    await deletePruningState(tempDir, "ses_cleanup");

    expect(readPruningState(tempDir, "ses_cleanup")).resolves.toBeNull();
  });

  it("roundtrips compression blocks", async () => {
    const blocks = new Map<number, CompressionBlock>([
      [1, makeCompressionBlock()],
      [2, makeCompressionBlock({ blockId: 2, runId: 3, topic: "Follow-up", summary: "Second summary" })],
    ]);

    await writeCompressionBlocks(tempDir, "ses_blocks", blocks);

    expect(readCompressionBlocks(tempDir, "ses_blocks")).resolves.toEqual(blocks);
  });

  it("returns null when compression blocks are missing", async () => {
    expect(readCompressionBlocks(tempDir, "ses_missing")).resolves.toBeNull();
  });
});
