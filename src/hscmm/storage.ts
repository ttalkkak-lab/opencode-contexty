import fs from "fs/promises";
import path from "path";
import { FileSystem } from "../utils";
import type {
  CompressionBlock,
  PrunedMessageEntry,
  SessionState,
  ToolParameterEntry,
} from "../dcp/types";

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

type SerializedEntry<K, V> = [K, V];

type SerializedPruneMessagesState = {
  byMessageId: SerializedEntry<string, PrunedMessageEntry>[];
  blocksById: SerializedEntry<number, CompressionBlock>[];
  activeBlockIds: number[];
  activeByAnchorMessageId: SerializedEntry<string, number>[];
  nextBlockId: number;
  nextRunId: number;
};

type SerializedSessionState = {
  sessionId: string | null;
  isSubAgent: boolean;
  manualMode: false | "active" | "compress-pending";
  compressPermission: "ask" | "allow" | "deny" | undefined;
  pendingManualTrigger: SessionState["pendingManualTrigger"];
  prune: {
    tools: SerializedEntry<string, number>[];
    messages: SerializedPruneMessagesState;
  };
  nudges: {
    contextLimitAnchors: string[];
    turnNudgeAnchors: string[];
    iterationNudgeAnchors: string[];
  };
  stats: {
    pruneTokenCounter: number;
    totalPruneTokens: number;
  };
  compressionTiming: {
    pendingByCallId: SerializedEntry<string, number>[];
  };
  toolParameters: SerializedEntry<string, ToolParameterEntry>[];
  subAgentResultCache: SerializedEntry<string, string>[];
  toolIdList: string[];
  messageIds: {
    byRawId: SerializedEntry<string, string>[];
    byRef: SerializedEntry<string, string>[];
    nextRef: number;
  };
  lastCompaction: number;
  currentTurn: number;
  variant: string | undefined;
  modelContextLimit: number | undefined;
  systemPromptTokens: number | undefined;
};

const emptySessionState = (): SessionState => ({
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

const mapToEntries = <K, V>(map: Map<K, V>): SerializedEntry<K, V>[] => Array.from(map.entries());

const setToArray = <T>(set: Set<T>): T[] => Array.from(set.values());

const entriesToMap = <K, V>(entries: unknown, isKey: (value: unknown) => value is K): Map<K, V> => {
  const result = new Map<K, V>();

  if (!Array.isArray(entries)) {
    return result;
  }

  for (const entry of entries) {
    if (!Array.isArray(entry) || entry.length < 2 || !isKey(entry[0])) {
      continue;
    }

    result.set(entry[0], entry[1] as V);
  }

  return result;
};

const numberEntriesToMap = <V>(entries: unknown): Map<number, V> => {
  const result = new Map<number, V>();

  if (!Array.isArray(entries)) {
    return result;
  }

  for (const entry of entries) {
    if (!Array.isArray(entry) || entry.length < 2 || typeof entry[0] !== "number" || !Number.isFinite(entry[0])) {
      continue;
    }

    result.set(entry[0], entry[1] as V);
  }

  return result;
};

const numbersToSet = (values: unknown): Set<number> => {
  const result = new Set<number>();

  if (!Array.isArray(values)) {
    return result;
  }

  for (const value of values) {
    if (typeof value === "number" && Number.isFinite(value)) {
      result.add(value);
    }
  }

  return result;
};

const stringsToSet = (values: unknown): Set<string> => {
  const result = new Set<string>();

  if (!Array.isArray(values)) {
    return result;
  }

  for (const value of values) {
    if (typeof value === "string") {
      result.add(value);
    }
  }

  return result;
};

const serializePruneMessagesState = (messages: SessionState["prune"]["messages"]): SerializedPruneMessagesState => ({
  byMessageId: mapToEntries(messages.byMessageId),
  blocksById: mapToEntries(messages.blocksById),
  activeBlockIds: setToArray(messages.activeBlockIds),
  activeByAnchorMessageId: mapToEntries(messages.activeByAnchorMessageId),
  nextBlockId: messages.nextBlockId,
  nextRunId: messages.nextRunId,
});

const deserializePruneMessagesState = (raw: Partial<SerializedPruneMessagesState> | undefined): SessionState["prune"]["messages"] => ({
  byMessageId: entriesToMap<string, PrunedMessageEntry>(raw?.byMessageId, (value): value is string => typeof value === "string"),
  blocksById: numberEntriesToMap<CompressionBlock>(raw?.blocksById),
  activeBlockIds: numbersToSet(raw?.activeBlockIds),
  activeByAnchorMessageId: entriesToMap<string, number>(raw?.activeByAnchorMessageId, (value): value is string => typeof value === "string"),
  nextBlockId: typeof raw?.nextBlockId === "number" ? raw.nextBlockId : 1,
  nextRunId: typeof raw?.nextRunId === "number" ? raw.nextRunId : 1,
});

const serializeSessionState = (state: SessionState): SerializedSessionState => ({
  sessionId: state.sessionId,
  isSubAgent: state.isSubAgent,
  manualMode: state.manualMode,
  compressPermission: state.compressPermission,
  pendingManualTrigger: state.pendingManualTrigger,
  prune: {
    tools: mapToEntries(state.prune.tools),
    messages: serializePruneMessagesState(state.prune.messages),
  },
  nudges: {
    contextLimitAnchors: setToArray(state.nudges.contextLimitAnchors),
    turnNudgeAnchors: setToArray(state.nudges.turnNudgeAnchors),
    iterationNudgeAnchors: setToArray(state.nudges.iterationNudgeAnchors),
  },
  stats: state.stats,
  compressionTiming: {
    pendingByCallId: mapToEntries(state.compressionTiming.pendingByCallId),
  },
  toolParameters: mapToEntries(state.toolParameters),
  subAgentResultCache: mapToEntries(state.subAgentResultCache),
  toolIdList: state.toolIdList,
  messageIds: {
    byRawId: mapToEntries(state.messageIds.byRawId),
    byRef: mapToEntries(state.messageIds.byRef),
    nextRef: state.messageIds.nextRef,
  },
  lastCompaction: state.lastCompaction,
  currentTurn: state.currentTurn,
  variant: state.variant,
  modelContextLimit: state.modelContextLimit,
  systemPromptTokens: state.systemPromptTokens,
});

const deserializeSessionState = (raw: Partial<SerializedSessionState> | undefined): SessionState => {
  const state = emptySessionState();

  if (!raw) {
    return state;
  }

  state.sessionId = typeof raw.sessionId === "string" || raw.sessionId === null ? raw.sessionId : state.sessionId;
  state.isSubAgent = typeof raw.isSubAgent === "boolean" ? raw.isSubAgent : state.isSubAgent;
  state.manualMode = raw.manualMode === "active" || raw.manualMode === "compress-pending" ? raw.manualMode : state.manualMode;
  state.compressPermission = raw.compressPermission === "ask" || raw.compressPermission === "allow" || raw.compressPermission === "deny"
    ? raw.compressPermission
    : state.compressPermission;
  state.pendingManualTrigger =
    raw.pendingManualTrigger &&
    typeof raw.pendingManualTrigger === "object" &&
    typeof (raw.pendingManualTrigger as { sessionId?: unknown }).sessionId === "string" &&
    typeof (raw.pendingManualTrigger as { prompt?: unknown }).prompt === "string"
      ? (raw.pendingManualTrigger as SessionState["pendingManualTrigger"])
      : state.pendingManualTrigger;

  state.prune.tools = entriesToMap<string, number>(raw.prune?.tools, (value): value is string => typeof value === "string");
  state.prune.messages = deserializePruneMessagesState(raw.prune?.messages);

  state.nudges.contextLimitAnchors = stringsToSet(raw.nudges?.contextLimitAnchors);
  state.nudges.turnNudgeAnchors = stringsToSet(raw.nudges?.turnNudgeAnchors);
  state.nudges.iterationNudgeAnchors = stringsToSet(raw.nudges?.iterationNudgeAnchors);

  state.stats = {
    pruneTokenCounter: typeof raw.stats?.pruneTokenCounter === "number" ? raw.stats.pruneTokenCounter : state.stats.pruneTokenCounter,
    totalPruneTokens: typeof raw.stats?.totalPruneTokens === "number" ? raw.stats.totalPruneTokens : state.stats.totalPruneTokens,
  };

  state.compressionTiming.pendingByCallId = entriesToMap<string, number>(
    raw.compressionTiming?.pendingByCallId,
    (value): value is string => typeof value === "string"
  );

  state.toolParameters = entriesToMap<string, ToolParameterEntry>(raw.toolParameters, (value): value is string => typeof value === "string");
  state.subAgentResultCache = entriesToMap<string, string>(raw.subAgentResultCache, (value): value is string => typeof value === "string");
  state.toolIdList = Array.isArray(raw.toolIdList) ? raw.toolIdList.filter((value): value is string => typeof value === "string") : state.toolIdList;

  state.messageIds = {
    byRawId: entriesToMap<string, string>(raw.messageIds?.byRawId, (value): value is string => typeof value === "string"),
    byRef: entriesToMap<string, string>(raw.messageIds?.byRef, (value): value is string => typeof value === "string"),
    nextRef: typeof raw.messageIds?.nextRef === "number" ? raw.messageIds.nextRef : state.messageIds.nextRef,
  };

  state.lastCompaction = typeof raw.lastCompaction === "number" ? raw.lastCompaction : state.lastCompaction;
  state.currentTurn = typeof raw.currentTurn === "number" ? raw.currentTurn : state.currentTurn;
  state.variant = typeof raw.variant === "string" ? raw.variant : state.variant;
  state.modelContextLimit = typeof raw.modelContextLimit === "number" ? raw.modelContextLimit : state.modelContextLimit;
  state.systemPromptTokens = typeof raw.systemPromptTokens === "number" ? raw.systemPromptTokens : state.systemPromptTokens;

  return state;
};

const readJSON = async <T>(filePath: string): Promise<T | null> => {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
};

export const readPruningState = async (baseDir: string, sessionId: string): Promise<SessionState | null> => {
  const filePath = sessionPath(baseDir, sessionId, "pruning-state.json");
  const parsed = await readJSON<Partial<SerializedSessionState>>(filePath);

  if (!parsed) {
    return null;
  }

  return deserializeSessionState(parsed);
};

export const writePruningState = async (baseDir: string, sessionId: string, state: SessionState): Promise<void> => {
  await ensureSessionDir(baseDir, sessionId);
  const filePath = sessionPath(baseDir, sessionId, "pruning-state.json");
  await FileSystem.writeJSONAtomic(filePath, serializeSessionState(state));
};

export const deletePruningState = async (baseDir: string, sessionId: string): Promise<void> => {
  const filePath = sessionPath(baseDir, sessionId, "pruning-state.json");

  try {
    await fs.unlink(filePath);
  } catch {}
};

export const readCompressionBlocks = async (
  baseDir: string,
  sessionId: string
): Promise<Map<number, CompressionBlock> | null> => {
  const filePath = sessionPath(baseDir, sessionId, "compression-blocks.json");
  const parsed = await readJSON<SerializedEntry<number, CompressionBlock>[] | { blocks?: SerializedEntry<number, CompressionBlock>[] }>(filePath);

  if (!parsed) {
    return null;
  }

  const entries = Array.isArray(parsed) ? parsed : parsed.blocks;
  return entriesToMap<number, CompressionBlock>(entries, (value): value is number => typeof value === "number");
};

export const writeCompressionBlocks = async (
  baseDir: string,
  sessionId: string,
  blocks: Map<number, CompressionBlock>
): Promise<void> => {
  await ensureSessionDir(baseDir, sessionId);
  const filePath = sessionPath(baseDir, sessionId, "compression-blocks.json");
  await FileSystem.writeJSONAtomic(filePath, mapToEntries(blocks));
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
