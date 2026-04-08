export interface TextPart {
  type: 'text';
  text: string;
  [key: string]: unknown;
}

export interface ToolPartState {
  status: 'pending' | 'running' | 'completed' | 'error';
  input?: unknown;
  output?: unknown;
  error?: unknown;
  time?: { compacted?: boolean; [key: string]: unknown };
  [key: string]: unknown;
}

export interface ToolPart {
  type: 'tool';
  state?: ToolPartState;
  tool?: string;
  callID?: string;
  [key: string]: unknown;
}

export type MessagePart = TextPart | ToolPart | { type: string; [key: string]: unknown };

export interface WithParts {
  info: {
    id: string;
    role: string;
    sessionID?: string;
    time?: { created: number; [key: string]: unknown };
    [key: string]: unknown;
  };
  parts?: MessagePart[];
}

export interface ToolParameterEntry {
  tool: string;
  parameters: unknown;
  status?: 'pending' | 'running' | 'completed' | 'error';
  error?: string;
  turn: number;
  tokenCount?: number;
}

export interface PrunedMessageEntry {
  tokenCount: number;
  allBlockIds: number[];
  activeBlockIds: number[];
}

export type CompressionMode = 'range' | 'message';

export interface CompressionBlock {
  blockId: number;
  runId: number;
  active: boolean;
  deactivatedByUser: boolean;
  compressedTokens: number;
  summaryTokens: number;
  durationMs: number;
  mode?: CompressionMode;
  topic: string;
  batchTopic?: string;
  startId: string;
  endId: string;
  anchorMessageId: string;
  compressMessageId: string;
  compressCallId?: string;
  includedBlockIds: number[];
  consumedBlockIds: number[];
  parentBlockIds: number[];
  directMessageIds: string[];
  directToolIds: string[];
  effectiveMessageIds: string[];
  effectiveToolIds: string[];
  createdAt: number;
  deactivatedAt?: number;
  deactivatedByBlockId?: number;
  summary: string;
}

export interface PruneMessagesState {
  byMessageId: Map<string, PrunedMessageEntry>;
  blocksById: Map<number, CompressionBlock>;
  activeBlockIds: Set<number>;
  activeByAnchorMessageId: Map<string, number>;
  nextBlockId: number;
  nextRunId: number;
}

export interface Prune {
  tools: Map<string, number>;
  messages: PruneMessagesState;
}

export interface PendingManualTrigger {
  sessionId: string;
  prompt: string;
}

export interface MessageIdState {
  byRawId: Map<string, string>;
  byRef: Map<string, string>;
  nextRef: number;
}

export interface Nudges {
  contextLimitAnchors: Set<string>;
  turnNudgeAnchors: Set<string>;
  iterationNudgeAnchors: Set<string>;
}

export interface CompressionTimingState {
  pendingByCallId: Map<string, number>;
}

export interface SessionState {
  sessionId: string | null;
  isSubAgent: boolean;
  manualMode: false | 'active' | 'compress-pending';
  compressPermission: 'ask' | 'allow' | 'deny' | undefined;
  pendingManualTrigger: PendingManualTrigger | null;
  prune: Prune;
  nudges: Nudges;
  stats: {
    pruneTokenCounter: number;
    totalPruneTokens: number;
  };
  compressionTiming: CompressionTimingState;
  toolParameters: Map<string, ToolParameterEntry>;
  subAgentResultCache: Map<string, string>;
  toolIdList: string[];
  messageIds: MessageIdState;
  lastCompaction: number;
  currentTurn: number;
  variant: string | undefined;
  modelContextLimit: number | undefined;
  systemPromptTokens: number | undefined;
}

export interface Deduplication {
  enabled: boolean;
  protectedTools: string[];
}

export interface Commands {
  enabled: boolean;
  protectedTools: string[];
}

export interface ManualModeConfig {
  enabled: boolean;
  automaticStrategies: boolean;
}

export interface PurgeErrors {
  enabled: boolean;
  turns: number;
  protectedTools: string[];
}

export interface TurnProtection {
  enabled: boolean;
  turns: number;
}

export interface ExperimentalConfig {
  allowSubAgents: boolean;
  customPrompts: boolean;
}

export interface CompressConfig {
  mode: CompressionMode;
  permission: 'ask' | 'allow' | 'deny';
  showCompression: boolean;
  summaryBuffer: boolean;
  maxContextLimit: number | `${number}%`;
  minContextLimit: number | `${number}%`;
  modelMaxLimits?: Record<string, number | `${number}%`>;
  modelMinLimits?: Record<string, number | `${number}%`>;
  nudgeFrequency: number;
  iterationNudgeThreshold: number;
  nudgeForce: 'strong' | 'soft';
  protectedTools: string[];
  protectUserMessages: boolean;
}

export interface DCPConfig {
  enabled: boolean;
  debug: boolean;
  pruneNotification: 'off' | 'minimal' | 'detailed';
  pruneNotificationType: 'chat' | 'toast';
  commands: Commands;
  manualMode: ManualModeConfig;
  turnProtection: TurnProtection;
  experimental: ExperimentalConfig;
  protectedFilePatterns: string[];
  compress: CompressConfig;
  strategies: {
    deduplication: Deduplication;
    purgeErrors: PurgeErrors;
  };
}

export interface TokenBreakdown {
  system: number;
  user: number;
  assistant: number;
  tools: number;
  toolCount: number;
  toolsInContextCount: number;
  prunedTokens: number;
  prunedToolCount: number;
  prunedMessageCount: number;
  total: number;
}

export interface AggregatedStats {
  totalTokens: number;
  totalTools: number;
  totalMessages: number;
  sessionCount: number;
}
