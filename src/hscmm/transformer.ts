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
import { loadContextyConfig } from '../config/contextyConfig';
import { createLogger as createDCPLogger } from '../dcp/logger';
import { filterProcessableMessages, assignMessageRefs } from '../dcp/messageIds';
import { injectCompressNudges, injectMessageIds } from '../dcp/messages/inject';
import { prune } from '../dcp/messages/prune';
import { syncCompressionBlocks, buildToolIdList } from '../dcp/messages/sync';
import { stripHallucinations } from '../dcp/messages/utils';
import { applyPendingManualTrigger } from '../dcp/commands';
import { stripStaleMetadata } from '../dcp/messages/inject';
import { isMessageCompacted } from '../dcp/state/utils';
import { cacheSystemPromptTokens } from '../dcp/ui/utils';
import type { DCPConfig, SessionState, WithParts } from '../dcp/types';
import { createEmptyDcpState } from '../dcp/sessionState';

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

function getParts(message: WithParts): NonNullable<WithParts['parts']> {
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
  const { config } = await loadContextyConfig(directory);
  return config.dcp ?? null;
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
      metadata: { preview, truncated },
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
    let dcpState: SessionState | null = null;

    try {
      const metricsSessionId = sessionTracker.getSessionId();
      if (metricsSessionId && acpm) {
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
      resolvedSessionId = await resolveSessionId(output.messages);
      if (resolvedSessionId) {
        const state = await dcpStateAccess.get(resolvedSessionId);
        dcpState = state;

        state.sessionId = resolvedSessionId;
        stripHallucinations(output.messages);
        assignMessageRefs(state, output.messages);
        const processableMessages = filterProcessableMessages(output.messages);

        if (processableMessages.length !== output.messages.length) {
          dcpLogger.warn('Skipping messages with unexpected shape during transform', {
            received: output.messages.length,
            usable: processableMessages.length,
          });
          output.messages = processableMessages;
        }

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
            Logger.warn('Invalid tool part encountered during transform', {
              partId: typeof part.id === 'string' ? part.id : 'unknown',
            });
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

    const messagesById = new Map(output.messages.map((message) => [message.info.id, message]));

    const blacklistIds = new Set(blacklistSpec.ids);
    const existingIds = new Set(persistedSpec.parts.map((part) => part.id));

    const refreshCompactedState = (part: ToolPart): ToolPart => {
      if (!dcpState) {
        return part;
      }

      const resolvedMessage = messagesById.get(part.messageID);
      if (!resolvedMessage) {
        return part;
      }

      const compacted = isMessageCompacted(dcpState, resolvedMessage);
      const state = part.state ?? {};
      const time = state.time ?? {};

      return {
        ...part,
        state: {
          ...state,
          time: {
            ...time,
            compacted: compacted ? true : false,
          },
        },
      };
    };

    const refreshedPersistedParts = persistedSpec.parts.map(refreshCompactedState);

    const appendParts = toolPartsFromMessages.filter(
      (part) => !blacklistIds.has(part.id) && !existingIds.has(part.id)
    ).map(refreshCompactedState);

    const mergedParts = [...refreshedPersistedParts, ...appendParts].filter(
      (part) => !blacklistIds.has(part.id) && messagesById.has(part.messageID)
    );

    if (appendParts.length > 0 || persistedSpec.parts.length !== mergedParts.length) {
      await writeToolLog(directory, sessionId, { parts: mergedParts });
    }

    if (mergedParts.length === 0) {
      return;
    }

    const partsByMessageID = new Map<string, ToolPart[]>();

    for (const part of mergedParts) {
      const resolvedMessage = messagesById.get(part.messageID);
      if (!resolvedMessage || (dcpState && isMessageCompacted(dcpState, resolvedMessage))) {
        continue;
      }

      const contextyMetadata = part.metadata?.contexty as Record<string, unknown> | undefined;

      const taggedPart: ToolPart = {
        ...part,
        metadata: {
          ...part.metadata,
          contexty: {
            ...contextyMetadata,
            source: 'tool-log',
          },
        },
      };

      if (!partsByMessageID.has(part.messageID)) {
        partsByMessageID.set(part.messageID, []);
      }
      partsByMessageID.get(part.messageID)!.push(taggedPart);
    }

    for (const message of output.messages) {
      const parts = partsByMessageID.get(message.info.id);
      if (parts && parts.length > 0) {
        message.parts = [...getParts(message), ...parts];
      }
    }
  };
}
