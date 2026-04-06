import fs from "fs/promises";
import path from "path";
import { FileSystem } from "../utils";

export type ToolStateCompleted = {
    status: "completed";
    input: {
      [key: string]: unknown;
    };
    output: string;
    title: string;
    metadata: {
      [key: string]: unknown;
    };
    time: {
      start: number;
      end: number;
      compacted?: number;
    };
};

export type ToolPart = {
  id: string;
  sessionID: string;
  messageID: string;
  type: "tool";
  callID: string;
  tool: string;
  state: ToolStateCompleted;
  metadata?: {
    [key: string]: unknown;
  };
};

export type ToolLogSpec = {
  parts: ToolPart[];
};

export type ToolLogBlacklist = {
  ids: string[];
};

export const readToolLog = async (baseDir: string, sessionId: string): Promise<ToolLogSpec> => {
  const filePath = sessionPath(baseDir, sessionId, "tool-parts.json");
  try {
    const raw = await fs.readFile(filePath, "utf8");
    const parsed = JSON.parse(raw);
    return {
      parts: Array.isArray(parsed.parts) ? parsed.parts : []
    };
  } catch {
    return { parts: [] };
  }
};

export const writeToolLog = async (baseDir: string, sessionId: string, spec: ToolLogSpec): Promise<void> => {
  await ensureSessionDir(baseDir, sessionId);
  const filePath = sessionPath(baseDir, sessionId, "tool-parts.json");
  await FileSystem.writeJSONAtomic(filePath, spec);
};

export const readToolLogBlacklist = async (baseDir: string, sessionId: string): Promise<ToolLogBlacklist> => {
  const filePath = sessionPath(baseDir, sessionId, "tool-parts.blacklist.json");
  try {
    const raw = await fs.readFile(filePath, "utf8");
    const parsed = JSON.parse(raw);
    return {
      ids: Array.isArray(parsed.ids) ? parsed.ids : []
    };
  } catch {
    return { ids: [] };
  }
};

export const writeToolLogBlacklist = async (
  baseDir: string,
  sessionId: string,
  spec: ToolLogBlacklist
): Promise<void> => {
  await ensureSessionDir(baseDir, sessionId);
  const filePath = sessionPath(baseDir, sessionId, "tool-parts.blacklist.json");
  await FileSystem.writeJSONAtomic(filePath, spec);
};

export const appendToolLogEntry = async (baseDir: string, sessionId: string, entry: ToolPart): Promise<void> => {
  const spec = await readToolLog(baseDir, sessionId);
  spec.parts.push(entry);
  await writeToolLog(baseDir, sessionId, spec);
};

export const sessionsBaseDir = (baseDir: string): string => {
  return path.join(baseDir, ".contexty", "sessions");
};

export const sessionPath = (baseDir: string, sessionId: string, filename: string): string => {
  if (!sessionId || !sessionId.trim()) {
    throw new Error("sessionId must be a non-empty string");
  }

  return path.join(sessionsBaseDir(baseDir), sessionId, filename);
};

export const ensureSessionDir = async (baseDir: string, sessionId: string): Promise<void> => {
  const dir = sessionPath(baseDir, sessionId, ".");
  await fs.mkdir(dir, { recursive: true });
};
