import type { DCPLogger } from "../logger";
import type {
  CompressionMode,
  DCPConfig,
  SessionState,
  WithParts,
} from "../types";

export interface ToolContext {
  sessionId: string;
  client: any;
  state: SessionState;
  config: DCPConfig;
  logger: DCPLogger;
  messages?: WithParts[];
}

export interface SearchContext {
  state: SessionState;
  config: DCPConfig;
  messages: WithParts[];
  logger: DCPLogger;
}

export interface CompressRangeEntry {
  startId: string;
  endId: string;
  summary: string;
}

export interface CompressRangeToolArgs {
  topic: string;
  content: CompressRangeEntry[];
}

export interface CompressMessageEntry {
  messageId: string;
  topic: string;
  summary: string;
}

export interface CompressMessageToolArgs {
  topic: string;
  content: CompressMessageEntry[];
}

export interface RangeSelectionResolution {
  startId: string;
  endId: string;
  messageIds: string[];
  toolIds: string[];
  messageTokenById: Map<string, number>;
}

export interface MessageSelectionResolution {
  messageId: string;
  topic: string;
  summary: string;
  messageIds: string[];
  toolIds: string[];
  messageTokenById: Map<string, number>;
}

export type SelectionResolution = RangeSelectionResolution | MessageSelectionResolution;

export interface CompressionApplyInput {
  mode: CompressionMode;
  startId: string;
  endId: string;
  summary: string;
  topic: string;
  batchTopic?: string;
  anchorMessageId: string;
  compressMessageId: string;
  compressCallId?: string;
  consumedBlockIds: number[];
  toolIds?: string[];
  messageTokenById: Map<string, number>;
}
