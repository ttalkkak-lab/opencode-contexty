import fs from "fs/promises";
import path from "path";

export type ToolLogEntry = {
  id: string;
  sessionID: string;
  messageID: string;
  type: "tool";
  callID: string;
  tool: string;
  state: {
    status: "completed" | "error" | "pending" | "running";
    input: Record<string, unknown>;
    output?: string;
    title?: string;
    metadata?: Record<string, unknown>;
    time?: {
      start: number;
      end?: number;
    };
  };
  metadata?: Record<string, unknown>;
};

export type ToolLogSpec = {
  parts: ToolLogEntry[];
};

export type ToolLogBlacklist = {
  ids: string[];
};

const toolLogPath = (baseDir: string): string => {
  return path.join(baseDir, ".contexty", "tool-parts.json");
};

const toolLogBlacklistPath = (baseDir: string): string => {
  return path.join(baseDir, ".contexty", "tool-parts.blacklist.json");
};

const ensureDir = async (baseDir: string): Promise<void> => {
  await fs.mkdir(path.join(baseDir, ".contexty"), { recursive: true });
};

export const readToolLog = async (baseDir: string): Promise<ToolLogSpec> => {
  const filePath = toolLogPath(baseDir);
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

export const writeToolLog = async (baseDir: string, spec: ToolLogSpec): Promise<void> => {
  await ensureDir(baseDir);
  const filePath = toolLogPath(baseDir);
  await fs.writeFile(filePath, JSON.stringify(spec, null, 2), "utf8");
};

export const readToolLogBlacklist = async (baseDir: string): Promise<ToolLogBlacklist> => {
  const filePath = toolLogBlacklistPath(baseDir);
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
  spec: ToolLogBlacklist
): Promise<void> => {
  await ensureDir(baseDir);
  const filePath = toolLogBlacklistPath(baseDir);
  await fs.writeFile(filePath, JSON.stringify(spec, null, 2), "utf8");
};

export const appendToolLogEntry = async (baseDir: string, entry: ToolLogEntry): Promise<void> => {
  const spec = await readToolLog(baseDir);
  spec.parts.push(entry);
  await writeToolLog(baseDir, spec);
};
