import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { sessionsBaseDir } from "../../hscmm/storage";
import type { AggregatedStats } from "../types";

type SerializedSessionStats = {
  stats?: {
    totalPruneTokens?: number;
  };
  prune?: {
    tools?: unknown;
    messages?: {
      byMessageId?: unknown;
    };
  };
};

const emptyAggregatedStats = (): AggregatedStats => ({
  totalTokens: 0,
  totalTools: 0,
  totalMessages: 0,
  sessionCount: 0,
});

const countMessageEntries = (entries: unknown): number => {
  if (!Array.isArray(entries)) {
    return 0;
  }

  let count = 0;
  for (const entry of entries) {
    if (!Array.isArray(entry) || entry.length < 2) {
      continue;
    }

    const value = entry[1];
    if (value && typeof value === "object") {
      count += 1;
    }
  }

  return count;
};

export function loadAllSessionStats(baseDir: string): AggregatedStats {
  const result = emptyAggregatedStats();
  const sessionsDir = sessionsBaseDir(baseDir);

  let sessionDirs: string[];
  try {
    sessionDirs = readdirSync(sessionsDir, { withFileTypes: true })
      .filter((dirent) => dirent.isDirectory())
      .map((dirent) => dirent.name);
  } catch {
    return result;
  }

  for (const sessionId of sessionDirs) {
    const statePath = join(sessionsDir, sessionId, "pruning-state.json");

    try {
      const raw = readFileSync(statePath, "utf-8");
      const data = JSON.parse(raw) as SerializedSessionStats;

      result.totalTokens += data.stats?.totalPruneTokens ?? 0;

      const tools = data.prune?.tools;
      result.totalTools += Array.isArray(tools) ? tools.length : 0;

      result.totalMessages += countMessageEntries(data.prune?.messages?.byMessageId);
      result.sessionCount += 1;
    } catch {
      continue;
    }
  }

  return result;
}
