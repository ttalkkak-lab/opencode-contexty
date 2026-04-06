import { readToolLog, readToolLogBlacklist, writeToolLog, ToolPart } from './storage';
import { sessionTracker } from '../core/sessionTracker';
import { MetricsCollector } from '../metrics/collector';
import { writeMetrics } from '../metrics/storage';
import { acpmCounter, buildAcpmMetrics } from '../metrics/acpmCounter';
import type { ACPMModule } from '../acpm';
import * as fs from 'fs/promises';
import * as path from 'path';

interface MessageInfo {
  id: string;
  role: string;
}

interface MessagePart {
  type: string;
  metadata?: Record<string, any>;
  [key: string]: any;
}

interface Message {
  info: MessageInfo;
  parts: MessagePart[];
}

interface HookOutput {
  messages: Message[];
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

export function createHSCMMTransformHook(directory: string, acpm?: ACPMModule) {
  return async (_input: unknown, output: HookOutput) => {
    try {
      const metricsSessionId = sessionTracker.getSessionId();
      if (metricsSessionId && acpm) {
        // DEBUG: dump first message info shape
        const first = output.messages[0];
        if (first) {
          console.log('[transform] first message info keys:', Object.keys(first.info));
          console.log('[transform] first message info.tokens:', (first.info as any).tokens);
          console.log('[transform] first message parts count:', first.parts.length);
          if (first.parts[0]) {
            console.log('[transform] first part type:', first.parts[0].type, 'keys:', Object.keys(first.parts[0]).join(','));
          }
        }
        const last = output.messages[output.messages.length - 1];
        if (last) {
          console.log('[transform] last message info keys:', Object.keys(last.info));
          console.log('[transform] last message info.role:', last.info.role);
          console.log('[transform] last message info.tokens:', (last.info as any).tokens);
        }
        const collector = new MetricsCollector(directory);
        const snapshot = collector.collect(output.messages, metricsSessionId);
        const acpmMetrics = buildAcpmMetrics(acpm, acpmCounter);
        snapshot.acpm = acpmMetrics;
        await writeMetrics(directory, metricsSessionId, snapshot);
      }
    } catch {
    }

    const sessionId = sessionTracker.getSessionId();
    const toolPartsFromMessages: ToolPart[] = [];

    for (const message of output.messages) {
      for (const part of message.parts) {
        if (
          part.type === 'tool' &&
          part.metadata?.contexty?.source !== 'tool-log'
        ) {
          if (isValidToolPart(part)) {
            toolPartsFromMessages.push(part);
          } else {
            console.warn(`[Contexty] Invalid tool part encountered: ${part.id || 'unknown'}`);
          }
        } else if (
          part.type === 'file' &&
          part.metadata?.contexty?.source !== 'tool-log'
        ) {
          const converted = await filePartToToolPart(part, directory, sessionId ?? '');
          if (converted) {
            toolPartsFromMessages.push(converted);
          }
        }
      }
    }

    for (const message of output.messages) {
      message.parts = message.parts.filter(
        (part) => part.type !== 'tool' && part.metadata?.contexty?.source !== 'tool-log'
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
        message.parts = [...message.parts, ...parts];
      }
    }
  };
}
