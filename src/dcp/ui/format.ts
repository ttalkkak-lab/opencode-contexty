import type { CompressionBlock, PruneMessagesState } from '../types';
import { formatTokenCount } from './notification';

export interface CompressionTarget {
  displayId: number;
  runId: number;
  topic: string;
  compressedTokens: number;
  durationMs: number;
  grouped: boolean;
  blocks: CompressionBlock[];
}

function byBlockId(a: CompressionBlock, b: CompressionBlock): number {
  return a.blockId - b.blockId;
}

function buildTarget(blocks: CompressionBlock[]): CompressionTarget {
  const ordered = [...blocks].sort(byBlockId);
  const first = ordered[0];
  if (!first) {
    throw new Error('Cannot build compression target from empty block list.');
  }

  const grouped = first.mode === 'message';
  return {
    displayId: first.blockId,
    runId: first.runId,
    topic: grouped ? first.batchTopic || first.topic : first.topic,
    compressedTokens: ordered.reduce((total, block) => total + block.compressedTokens, 0),
    durationMs: ordered.reduce((total, block) => Math.max(total, block.durationMs), 0),
    grouped,
    blocks: ordered,
  };
}

function splitTargets(blocks: CompressionBlock[]): CompressionTarget[] {
  const messageBlocks: CompressionBlock[] = [];
  const singleBlocks: CompressionBlock[] = [];

  for (const block of blocks) {
    if (block.mode === 'message') {
      messageBlocks.push(block);
    } else {
      singleBlocks.push(block);
    }
  }

  const messageGroups = new Map<number, CompressionBlock[]>();
  for (const block of messageBlocks) {
    const existing = messageGroups.get(block.runId);
    if (existing) {
      existing.push(block);
    } else {
      messageGroups.set(block.runId, [block]);
    }
  }

  const targets = [
    ...singleBlocks.map((block) => buildTarget([block])),
    ...Array.from(messageGroups.values()).map(buildTarget),
  ];
  return targets.sort((a, b) => a.displayId - b.displayId);
}

export function getActiveCompressionTargets(messagesState: PruneMessagesState): CompressionTarget[] {
  const activeBlocks = Array.from(messagesState.activeBlockIds)
    .map((blockId) => messagesState.blocksById.get(blockId))
    .filter((block): block is CompressionBlock => !!block && block.active);

  return splitTargets(activeBlocks);
}

export function getRecompressibleCompressionTargets(
  messagesState: PruneMessagesState,
  availableMessageIds: Set<string>,
): CompressionTarget[] {
  const allBlocks = Array.from(messagesState.blocksById.values()).filter((block) => {
    return availableMessageIds.has(block.compressMessageId);
  });

  const messageGroups = new Map<number, CompressionBlock[]>();
  const singleTargets: CompressionTarget[] = [];

  for (const block of allBlocks) {
    if (block.mode === 'message') {
      const existing = messageGroups.get(block.runId);
      if (existing) {
        existing.push(block);
      } else {
        messageGroups.set(block.runId, [block]);
      }
      continue;
    }

    if (block.deactivatedByUser && !block.active) {
      singleTargets.push(buildTarget([block]));
    }
  }

  for (const blocks of messageGroups.values()) {
    if (blocks.some((block) => block.deactivatedByUser && !block.active)) {
      singleTargets.push(buildTarget(blocks));
    }
  }

  return singleTargets.sort((a, b) => a.displayId - b.displayId);
}

export function resolveCompressionTarget(
  messagesState: PruneMessagesState,
  blockId: number,
): CompressionTarget | null {
  const block = messagesState.blocksById.get(blockId);
  if (!block) {
    return null;
  }

  if (block.mode !== 'message') {
    return buildTarget([block]);
  }

  const blocks = Array.from(messagesState.blocksById.values()).filter(
    (candidate) => candidate.mode === 'message' && candidate.runId === block.runId,
  );
  if (blocks.length === 0) {
    return null;
  }

  return buildTarget(blocks);
}

export function formatAvailableBlocksMessage(
  availableTargets: CompressionTarget[],
  command: 'decompress' | 'recompress',
): string {
  const lines: string[] = [];

  lines.push(`Usage: /dcp ${command} <n>`);
  lines.push('');

  if (availableTargets.length === 0) {
    lines.push(command === 'decompress' 
      ? 'No compressions are available to restore.' 
      : 'No user-decompressed blocks are available to re-compress.');
    return lines.join('\n');
  }

  lines.push(command === 'decompress' 
    ? 'Available compressions:' 
    : 'Available user-decompressed compressions:');
  const entries = availableTargets.map((target) => {
    const topic = target.topic.replace(/\s+/g, ' ').trim() || '(no topic)';
    const label = `${target.displayId} (${formatTokenCount(target.compressedTokens)})`;
    const details = target.grouped
      ? `Compression #${target.runId} - ${target.blocks.length} messages`
      : `Compression #${target.runId}`;
    return { label, topic: `${details} - ${topic}` };
  });

  const labelWidth = Math.max(...entries.map((entry) => entry.label.length)) + 4;
  for (const entry of entries) {
    lines.push(`  ${entry.label.padEnd(labelWidth)}${entry.topic}`);
  }

  return lines.join('\n');
}
