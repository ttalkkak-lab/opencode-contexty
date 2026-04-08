import {
  readToolLog,
  readToolLogBlacklist,
  writeToolLog,
  readPruningState,
  writePruningState,
  ToolPart,
} from './storage';
import { sessionTracker } from '../core/sessionTracker';
import { MetricsCollector } from '../metrics/collector';
import { writeMetrics } from '../metrics/storage';
import { acpmCounter, buildAcpmMetrics } from '../metrics/acpmCounter';
import type { ACPMModule } from '../acpm';
import * as fs from 'fs/promises';
import * as path from 'path';
import { Logger } from '../utils';
import { createLogger as createDCPLogger } from '../dcp/logger';
import { filterProcessableMessages, assignMessageRefs } from '../dcp/message-ids';
import { injectCompressNudges, injectMessageIds } from '../dcp/messages/inject';
import { prune } from '../dcp/messages/prune';
import { syncCompressionBlocks, buildToolIdList } from '../dcp/messages/sync';
import { stripHallucinations } from '../dcp/messages/utils';
import { applyPendingManualTrigger } from '../dcp/commands';
import { stripStaleMetadata } from '../dcp/messages/inject';
import { cacheSystemPromptTokens } from '../dcp/ui/utils';
import type { DCPConfig, SessionState, WithParts } from '../dcp/types';
import type { ContextyConfig } from '../types';

interface HookOutput {
  messages: WithParts[];
}

type TransformClient = {
  session?: {
    list?: () => Promise<{ data?: Array<{ id?: string }> } | Array<{ id?: string }>>;
  };
};

export interface StateAccess {
  get: (sessionId: string) => Promise<SessionState>;
  persist: (sessionId: string, state: SessionState) => Promise<void>;
}

function createEmptyDcpState(sessionId: string): SessionState {
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
    currentTurn: 1,
    variant: undefined,
    modelContextLimit: undefined,
    systemPromptTokens: 0,
  };
}

function getParts(message: WithParts): any[] {
  return Array.isArray(message.parts) ? message.parts : [];
}

export async function resolveSessionId(messages: WithParts[]): Promise<string | null> {
  const trackedSessionId = sessionTracker.getSessionId();
  if (trackedSessionId) {
    return trackedSessionId;
  }

  const messageSessionId = messages.find((message) => typeof message.info.sessionID === 'string' && message.info.sessionID.length > 0)?.info.sessionID;
  if (typeof messageSessionId === 'string' && messageSessionId.length > 0) {
    return messageSessionId;
  }

  return null;
}

async function loadDCPConfig(directory: string): Promise<DCPConfig | null> {
  try {
    const configPath = path.join(directory, 'contexty.config.json');
    const raw = await fs.readFile(configPath, 'utf8');
    const parsed = JSON.parse(raw) as ContextyConfig;
    return parsed.dcp ?? null;
  } catch {
    return null;
  }
}

function isValidToolPart(part: any): part is ToolPart {
  return (
    part &&
    typeof part === 'object' &&
    part.type === 'tool' &&
    typeof part.id === 'string' &&
    typeof part.messageID === 'string' &&
    typeof part.tool === 'string' &&
    part.state &&
    typeof part.state === 'object'
  );
}

async function filePartToToolPart(filePart: any, directory: string, sessionId: string): Promise<ToolPart | null> {
  const source = filePart.source;
  if (!source || source.type !== 'file' || typeof source.path !== 'string') {
    return null;
  }

  const absolutePath = path.resolve(directory, source.path);
  const timestamp = Date.now();
  const maxOutputLen = 50 * 1024;
  const maxPreviewLen = 1000;

  let content: string;
  try {
    content = await fs.readFile(absolutePath, 'utf8');
  } catch {
    return null;
  }

  const truncated = content.length > maxOutputLen;
  const outputContent = truncated ? content.slice(0, maxOutputLen) : content;
  const lines = outputContent.split('\n');
  const numberedOutput = lines.map((line: string, i: number) => `${i + 1}: ${line}`).join('\n');
  const preview = truncated ? content.slice(0, maxPreviewLen) : content;

  return {
    id: filePart.id,
    sessionID: filePart.sessionID ?? sessionId,
    messageID: filePart.messageID ?? '',
    type: 'tool',
    callID: `file-ref-${filePart.id}`,
    tool: 'read',
    state: {
      status: 'completed',
      input: { filePath: absolutePath },
      output: numberedOutput,
      title: source.path,
      metadata: { preview, truncated: !truncated },
      time: { start: timestamp, end: timestamp },
    },
    metadata: {
      contexty: { source: 'file-reference' },
    },
  };
}

export function createHSCMMTransformHook(directory: string, acpm?: ACPMModule, _client?: TransformClient, stateAccess?: StateAccess) {
  const dcpStateAccess: StateAccess = stateAccess ?? {
    get: async (sessionId: string) => {
      const state = await readPruningState(directory, sessionId);
      return state ?? createEmptyDcpState(sessionId);
    },
    persist: async (sessionId: string, state: SessionState) => writePruningState(directory, sessionId, state),
  };

  return async (_input: unknown, output: HookOutput) => {
    let resolvedSessionId: string | null = null;

    try {
      const metricsSessionId = sessionTracker.getSessionId();
      if (metricsSessionId && acpm) {
        const first = output.messages[0];
        if (first) {
          const firstParts = getParts(first);
          Logger.debug('metrics debug — first message info keys: ' + Object.keys(first.info).join(', '), { tokens: (first.info as any).tokens, partsCount: firstParts.length, firstPartType: firstParts[0]?.type, firstPartKeys: firstParts[0] ? Object.keys(firstParts[0]).join(',') : undefined });
        }
        const last = output.messages[output.messages.length - 1];
        if (last) {
          Logger.debug('metrics debug — last message role: ' + last.info.role + ', tokens: ' + JSON.stringify((last.info as any).tokens), { infoKeys: Object.keys(last.info).join(',') });
        }
        const collector = new MetricsCollector(directory);
        const snapshot = collector.collect(output.messages, metricsSessionId);
        const acpmMetrics = buildAcpmMetrics(acpm, acpmCounter);
        snapshot.acpm = acpmMetrics;
        await writeMetrics(directory, metricsSessionId, snapshot);
      }
    } catch {
    }

    const dcpConfig = await loadDCPConfig(directory);
    if (dcpConfig?.enabled) {
      const dcpLogger = createDCPLogger(dcpConfig.debug);
      const processableMessages = filterProcessableMessages(output.messages);

      if (processableMessages.length !== output.messages.length) {
        dcpLogger.warn('Skipping messages with unexpected shape during transform', {
          received: output.messages.length,
          usable: processableMessages.length,
        });
        output.messages = processableMessages;
      }

      resolvedSessionId = await resolveSessionId(output.messages);
      if (resolvedSessionId) {
        const state = await dcpStateAccess.get(resolvedSessionId);

        state.sessionId = resolvedSessionId;
        stripHallucinations(output.messages);
        assignMessageRefs(state, output.messages);
        syncCompressionBlocks(state, output.messages);
        buildToolIdList(state, output.messages);
        prune(dcpConfig, state, output.messages, dcpLogger);
        injectCompressNudges(dcpConfig, state, output.messages);
        injectMessageIds(state, output.messages);
        applyPendingManualTrigger(state, output.messages, dcpLogger);
        stripStaleMetadata(output.messages);
        cacheSystemPromptTokens(state, output.messages);

        try {
          await dcpStateAccess.persist(resolvedSessionId, state);
        } catch {
        }
      }
    }

    const sessionId = sessionTracker.getSessionId() ?? resolvedSessionId ?? output.messages[0]?.info.sessionID ?? null;
    const toolPartsFromMessages: ToolPart[] = [];

    for (const message of output.messages) {
      for (const part of getParts(message)) {
        if (
          part.type === 'tool' &&
          (part as any).metadata?.contexty?.source !== 'tool-log'
        ) {
          if (isValidToolPart(part)) {
            toolPartsFromMessages.push(part);
          } else {
            console.warn(`[Contexty] Invalid tool part encountered: ${part.id || 'unknown'}`);
          }
        } else if (
          part.type === 'file' &&
          (part as any).metadata?.contexty?.source !== 'tool-log'
        ) {
          const converted = await filePartToToolPart(part, directory, sessionId ?? '');
          if (converted) {
            toolPartsFromMessages.push(converted);
          }
        }
      }
    }

    for (const message of output.messages) {
      message.parts = getParts(message).filter(
        (part) => part.type !== 'tool' && (part as any).metadata?.contexty?.source !== 'tool-log'
      );
    }

    if (!sessionId) {
      return;
    }

    const [blacklistSpec, persistedSpec] = await Promise.all([
      readToolLogBlacklist(directory, sessionId),
      readToolLog(directory, sessionId),
    ]);

    const blacklistIds = new Set(blacklistSpec.ids);
    const existingIds = new Set(persistedSpec.parts.map((part) => part.id));

    const appendParts = toolPartsFromMessages.filter(
      (part) => !blacklistIds.has(part.id) && !existingIds.has(part.id)
    );

    const mergedParts = [...persistedSpec.parts, ...appendParts].filter(
      (part) => !blacklistIds.has(part.id)
    );

    if (appendParts.length > 0 || persistedSpec.parts.length !== mergedParts.length) {
      await writeToolLog(directory, sessionId, { parts: mergedParts });
    }

    if (mergedParts.length === 0) {
      return;
    }

    const messageIDs = new Set(output.messages.map((message) => message.info.id));

    const reversedMessages = [...output.messages].reverse();
    const lastAssistantMessage = reversedMessages.find((m) => m.info.role === 'assistant');
    const fallbackMessageID =
      lastAssistantMessage?.info.id ?? output.messages[output.messages.length - 1]?.info.id;

    const partsByMessageID = new Map<string, ToolPart[]>();

    for (const part of mergedParts) {
      const resolvedMessageID = messageIDs.has(part.messageID)
        ? part.messageID
        : fallbackMessageID;

      if (!resolvedMessageID) {
        continue;
      }

      const contextyMetadata = part.metadata?.contexty as Record<string, unknown> | undefined;

      const taggedPart: ToolPart = {
        ...part,
        messageID: resolvedMessageID,
        metadata: {
          ...part.metadata,
          contexty: {
            ...contextyMetadata,
            source: 'tool-log',
            ...(resolvedMessageID !== part.messageID
              ? { originalMessageID: part.messageID }
              : {}),
          },
        },
      };

      if (!partsByMessageID.has(resolvedMessageID)) {
        partsByMessageID.set(resolvedMessageID, []);
      }
      partsByMessageID.get(resolvedMessageID)!.push(taggedPart);
    }

    for (const message of output.messages) {
      const parts = partsByMessageID.get(message.info.id);
      if (parts && parts.length > 0) {
        message.parts = [...getParts(message), ...parts];
      }
    }
  };
}
