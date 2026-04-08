import { afterEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { loadAllSessionStats } from "./persistence";

const makeTempBaseDir = (): string => mkdtempSync(join(tmpdir(), "dcp-persistence-"));

const writeSessionState = (
  baseDir: string,
  sessionId: string,
  state: Record<string, unknown>
): void => {
  const sessionDir = join(baseDir, ".contexty", "sessions", sessionId);
  mkdirSync(sessionDir, { recursive: true });
  writeFileSync(join(sessionDir, "pruning-state.json"), JSON.stringify(state));
};

describe("loadAllSessionStats", () => {
  let tempDir = "";

  afterEach(() => {
    if (tempDir) {
      rmSync(tempDir, { recursive: true, force: true });
      tempDir = "";
    }
  });

  test("returns zeros for empty sessions directory", () => {
    tempDir = makeTempBaseDir();
    mkdirSync(join(tempDir, ".contexty", "sessions"), { recursive: true });

    expect(loadAllSessionStats(tempDir)).toEqual({
      totalTokens: 0,
      totalTools: 0,
      totalMessages: 0,
      sessionCount: 0,
    });
  });

  test("returns zeros for missing directory", () => {
    tempDir = makeTempBaseDir();

    expect(loadAllSessionStats(tempDir)).toEqual({
      totalTokens: 0,
      totalTools: 0,
      totalMessages: 0,
      sessionCount: 0,
    });
  });

  test("aggregates stats across valid sessions", () => {
    tempDir = makeTempBaseDir();

    writeSessionState(tempDir, "session-a", {
      stats: { totalPruneTokens: 10 },
      prune: {
        tools: [["tool-a", 1], ["tool-b", 2]],
        messages: {
          byMessageId: [["msg-1", { tokenCount: 4 }], ["msg-2", { tokenCount: 7 }]],
        },
      },
    });

    writeSessionState(tempDir, "session-b", {
      stats: { totalPruneTokens: 15 },
      prune: {
        tools: [["tool-c", 3]],
        messages: {
          byMessageId: [["msg-3", { tokenCount: 9 }]],
        },
      },
    });

    writeSessionState(tempDir, "session-c", {
      stats: { totalPruneTokens: 5 },
      prune: {
        tools: [],
        messages: {
          byMessageId: [["msg-4", { tokenCount: 2 }], ["msg-5", { tokenCount: 1 }], ["msg-6", { tokenCount: 8 }]],
        },
      },
    });

    expect(loadAllSessionStats(tempDir)).toEqual({
      totalTokens: 30,
      totalTools: 3,
      totalMessages: 6,
      sessionCount: 3,
    });
  });

  test("skips corrupt json files", () => {
    tempDir = makeTempBaseDir();

    writeSessionState(tempDir, "session-good", {
      stats: { totalPruneTokens: 11 },
      prune: {
        tools: [["tool-a", 1]],
        messages: {
          byMessageId: [["msg-1", { tokenCount: 2 }]],
        },
      },
    });

    const corruptDir = join(tempDir, ".contexty", "sessions", "session-bad");
    mkdirSync(corruptDir, { recursive: true });
    writeFileSync(join(corruptDir, "pruning-state.json"), "{not-json");

    expect(loadAllSessionStats(tempDir)).toEqual({
      totalTokens: 11,
      totalTools: 1,
      totalMessages: 1,
      sessionCount: 1,
    });
  });

  test("counts sessions with empty stats as zero totals", () => {
    tempDir = makeTempBaseDir();

    writeSessionState(tempDir, "session-empty", {
      stats: {},
      prune: {
        tools: [],
        messages: {
          byMessageId: [],
        },
      },
    });

    expect(loadAllSessionStats(tempDir)).toEqual({
      totalTokens: 0,
      totalTools: 0,
      totalMessages: 0,
      sessionCount: 1,
    });
  });
});
