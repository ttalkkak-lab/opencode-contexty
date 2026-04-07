import type { DCPConfig, SessionState } from '../types';
import { getActiveSummaryTokenUsage } from '../state/utils';
import { formatProgressBar } from './utils';
import type { DCPLogger } from '../logger';

export interface NotificationEntry {
  blockId: number;
  runId: number;
  summary: string;
  summaryTokens: number;
}

export async function sendIgnoredMessage(
  client: any,
  sessionID: string,
  text: string,
  params: {
    providerId?: string;
    modelId?: string;
    agent?: string;
    variant?: string;
  },
  logger: DCPLogger,
): Promise<void> {
  const agent = params.agent || undefined;
  const variant = params.variant || undefined;
  const model =
    params.providerId && params.modelId
      ? {
          providerID: params.providerId,
          modelID: params.modelId,
        }
      : undefined;

  try {
    await client.session.prompt({
      path: {
        id: sessionID,
      },
      body: {
        noReply: true,
        agent: agent,
        model: model,
        variant: variant,
        parts: [
          {
            type: 'text',
            text: text,
            ignored: true,
          },
        ],
      },
    });
  } catch (error: any) {
    logger.error('Failed to send notification', { error: error.message });
  }
}

export function formatTokenCount(count: number, abbreviate?: boolean): string {
  if (abbreviate && count >= 1000) {
    const value = count / 1000;
    return `${value % 1 === 0 ? value.toFixed(0) : value.toFixed(1)}k`;
  }
  return count.toLocaleString();
}

export function formatPrunedItemsList(
  toolIds: string[],
  toolMetadata: Map<string, { tool: string; parameters: unknown }>,
  workingDirectory?: string,
): string[] {
  const items: string[] = [];
  for (const id of toolIds) {
    const entry = toolMetadata.get(id);
    const toolName = entry?.tool ?? id;
    const relPath = workingDirectory ? shortenPath(workingDirectory, id) : id;
    items.push(`  • ${toolName} (${relPath})`);
  }
  return items;
}

function shortenPath(workingDirectory: string, fullPath: string): string {
  if (fullPath.startsWith(workingDirectory)) {
    return fullPath.slice(workingDirectory.length).replace(/^\/+/, '') || fullPath;
  }
  return fullPath;
}

function getCompressionLabel(entries: NotificationEntry[]): string {
  const runId = entries[0]?.runId;
  if (runId === undefined) {
    return 'Compression';
  }
  return `Compression #${runId}`;
}

function formatCompressionMetrics(removedTokens: number, summaryTokens: number): string {
  const metrics = [`-${formatTokenCount(removedTokens, true)} removed`];
  if (summaryTokens > 0) {
    metrics.push(`+${formatTokenCount(summaryTokens, true)} summary`);
  }
  return metrics.join(', ');
}

export async function sendCompressNotification(
  client: any,
  logger: DCPLogger,
  config: DCPConfig,
  state: SessionState,
  sessionId: string,
  entries: NotificationEntry[],
  batchTopic: string | undefined,
  sessionMessageIds: string[],
  params: {
    providerId?: string;
    modelId?: string;
    agent?: string;
    variant?: string;
  },
): Promise<void> {
  if (config.pruneNotification === 'off' || entries.length === 0) {
    return;
  }

  const compressionLabel = getCompressionLabel(entries);
  const summary = entries.length === 1
    ? (entries[0]?.summary ?? '')
    : entries
        .map((entry) => {
          const topic = state.prune.messages.blocksById.get(entry.blockId)?.topic ?? '(unknown topic)';
          return `### ${topic}\n${entry.summary}`;
        })
        .join('\n\n');

  const summaryTokens = entries.reduce((total, entry) => total + entry.summaryTokens, 0);
  const summaryTokensStr = formatTokenCount(summaryTokens);
  const compressedTokens = entries.reduce((total, entry) => {
    const compressionBlock = state.prune.messages.blocksById.get(entry.blockId);
    if (!compressionBlock) {
      logger.error('Compression block missing for notification', { compressionId: entry.blockId, sessionId });
      return total;
    }
    return total + compressionBlock.compressedTokens;
  }, 0);

  const newlyCompressedMessageIds: string[] = [];
  const newlyCompressedToolIds: string[] = [];
  const seenMessageIds = new Set<string>();
  const seenToolIds = new Set<string>();

  for (const entry of entries) {
    const compressionBlock = state.prune.messages.blocksById.get(entry.blockId);
    if (!compressionBlock) continue;
    for (const messageId of compressionBlock.directMessageIds) {
      if (seenMessageIds.has(messageId)) continue;
      seenMessageIds.add(messageId);
      newlyCompressedMessageIds.push(messageId);
    }
    for (const toolId of compressionBlock.directToolIds) {
      if (seenToolIds.has(toolId)) continue;
      seenToolIds.add(toolId);
      newlyCompressedToolIds.push(toolId);
    }
  }

  const topic = batchTopic ??
    (entries.length === 1
      ? (state.prune.messages.blocksById.get(entries[0]?.blockId ?? -1)?.topic ?? '(unknown topic)')
      : '(unknown topic)');

  const totalActiveSummaryTkns = getActiveSummaryTokenUsage(state);
  const totalGross = state.stats.totalPruneTokens + state.stats.pruneTokenCounter;
  const notificationHeader = `▣ DCP | ${formatCompressionMetrics(totalGross, totalActiveSummaryTkns)}`;

  let message: string;
  if (config.pruneNotification === 'minimal') {
    message = `${notificationHeader} — ${compressionLabel}`;
  } else {
    message = notificationHeader;

    const activePrunedMessages = new Map<string, number>();
    for (const [messageId, entry] of state.prune.messages.byMessageId) {
      if (entry.activeBlockIds.length > 0) {
        activePrunedMessages.set(messageId, entry.tokenCount);
      }
    }
    const progressBar = formatProgressBar(
      sessionMessageIds,
      activePrunedMessages,
      newlyCompressedMessageIds,
      50,
    );
    message += `\n\n${progressBar}`;
    message += `\n▣ ${compressionLabel} ${formatCompressionMetrics(compressedTokens, summaryTokens)}`;
    message += `\n→ Topic: ${topic}`;
    message += `\n→ Items: ${newlyCompressedMessageIds.length} messages`;
    if (newlyCompressedToolIds.length > 0) {
      message += ` and ${newlyCompressedToolIds.length} tools compressed`;
    } else {
      message += ` compressed`;
    }
    if (config.compress.showCompression) {
      message += `\n→ Compression (~${summaryTokensStr}): ${summary}`;
    }
  }

  await sendIgnoredMessage(client, sessionId, message, params, logger);
}
