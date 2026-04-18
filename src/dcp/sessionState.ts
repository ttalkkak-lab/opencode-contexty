import type { SessionState } from './types';

export function createEmptyDcpState(sessionId: string | null): SessionState {
  return {
    sessionId,
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
  };
}

export function getSessionIdFromUnknown(value: unknown): string | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const candidate =
    (value as { sessionID?: unknown; sessionId?: unknown }).sessionID ??
    (value as { sessionID?: unknown; sessionId?: unknown }).sessionId;

  return typeof candidate === 'string' && candidate.trim().length > 0 ? candidate : null;
}

export function getSessionIdFromEvent(eventValue: unknown): string | null {
  const event = eventValue as {
    properties?: { sessionID?: unknown; sessionId?: unknown; part?: unknown };
    sessionID?: unknown;
    sessionId?: unknown;
    part?: unknown;
  } | null;

  return (
    getSessionIdFromUnknown(event?.properties) ??
    getSessionIdFromUnknown(event) ??
    getSessionIdFromUnknown(event?.part) ??
    null
  );
}
