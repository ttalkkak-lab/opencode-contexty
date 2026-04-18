import { formatBlockRef, formatMessageIdTag } from "../messageIds";
import { countTokens } from "../tokenUtils";
import type { CompressionBlock, SessionState } from "../types";
import { endCompressionTiming } from "./timing";
import type { CompressionApplyInput } from "./types";

export const COMPRESSED_BLOCK_HEADER = "[Compressed conversation section]";

const MESSAGE_REF_PATTERN = /^m(\d{4})$/i;

function parseMessageRef(ref: string): number | null {
  const match = ref.trim().match(MESSAGE_REF_PATTERN);
  if (!match) {
    return null;
  }

  const value = Number.parseInt(match[1], 10);
  return Number.isInteger(value) ? value : null;
}

function getCoveredRawMessageIds(state: SessionState, startId: string, endId: string): string[] {
  const startIndex = parseMessageRef(startId);
  const endIndex = parseMessageRef(endId);
  const rawIds = Array.from(state.messageIds.byRawId.entries())
    .map(([rawId, ref]) => ({ rawId, ref, index: parseMessageRef(ref) }))
    .sort((left, right) => {
      const leftIndex = left.index ?? Number.MAX_SAFE_INTEGER;
      const rightIndex = right.index ?? Number.MAX_SAFE_INTEGER;
      if (leftIndex !== rightIndex) {
        return leftIndex - rightIndex;
      }
      return left.rawId.localeCompare(right.rawId);
    });

  if (startIndex === null || endIndex === null) {
    return rawIds
      .filter(({ rawId, ref }) => rawId === startId || rawId === endId || ref === startId || ref === endId)
      .map(({ rawId }) => rawId);
  }

  const low = Math.min(startIndex, endIndex);
  const high = Math.max(startIndex, endIndex);
  return rawIds
    .filter(({ index, rawId, ref }) => {
      if (rawId === startId || rawId === endId || ref === startId || ref === endId) {
        return true;
      }
      return typeof index === "number" && index >= low && index <= high;
    })
    .map(({ rawId }) => rawId);
}

export function allocateBlockId(state: SessionState): number {
  const next = state.prune.messages.nextBlockId;
  if (!Number.isInteger(next) || next < 1) {
    state.prune.messages.nextBlockId = 2;
    return 1;
  }

  state.prune.messages.nextBlockId = next + 1;
  return next;
}

export function allocateRunId(state: SessionState): number {
  const next = state.prune.messages.nextRunId;
  if (!Number.isInteger(next) || next < 1) {
    state.prune.messages.nextRunId = 2;
    return 1;
  }

  state.prune.messages.nextRunId = next + 1;
  return next;
}

export function wrapCompressedSummary(blockId: number, summary: string): string {
  const body = summary.trim();
  const footer = formatMessageIdTag(formatBlockRef(blockId));
  if (body.length === 0) {
    return `${COMPRESSED_BLOCK_HEADER}\n${footer}`;
  }

  return `${COMPRESSED_BLOCK_HEADER}\n${body}\n\n${footer}`;
}

export function applyCompressionState(
  state: SessionState,
  params: CompressionApplyInput,
): number {
  const blockId = allocateBlockId(state);
  const runId = allocateRunId(state);
  const summaryTokens = countTokens(params.summary);
  const consumedBlockIds = [...new Set(params.consumedBlockIds.filter((id) => Number.isInteger(id) && id > 0))];
  const coveredRawMessageIds = getCoveredRawMessageIds(state, params.startId, params.endId);
  const coveredMessageIds = new Set<string>(coveredRawMessageIds);
  const initiallyActive = new Set<string>();

  for (const [rawId, entry] of state.prune.messages.byMessageId) {
    if (entry.activeBlockIds.length > 0) {
      initiallyActive.add(rawId);
    }
  }

  const directToolIds = [...new Set(params.toolIds ?? [])];
  const effectiveToolIdsSet = new Set<string>(directToolIds);

  for (const consumedBlockId of consumedBlockIds) {
    const consumedBlock = state.prune.messages.blocksById.get(consumedBlockId);
    if (!consumedBlock) {
      continue;
    }

    for (const tid of consumedBlock.effectiveToolIds) {
      effectiveToolIdsSet.add(tid);
    }
  }

  const block: CompressionBlock = {
    blockId,
    runId,
    active: true,
    deactivatedByUser: false,
    compressedTokens: 0,
    summaryTokens,
    durationMs: 0,
    mode: params.mode,
    topic: params.topic,
    batchTopic: params.batchTopic,
    startId: params.startId,
    endId: params.endId,
    anchorMessageId: params.anchorMessageId,
    compressMessageId: params.compressMessageId,
    compressCallId: params.compressCallId,
    includedBlockIds: [...consumedBlockIds],
    consumedBlockIds: [...consumedBlockIds],
    parentBlockIds: [],
    directMessageIds: [],
    directToolIds,
    effectiveMessageIds: [...coveredMessageIds],
    effectiveToolIds: Array.from(effectiveToolIdsSet),
    createdAt: Date.now(),
    summary: params.summary,
  };

  state.prune.messages.blocksById.set(blockId, block);
  state.prune.messages.activeBlockIds.add(blockId);
  state.prune.messages.activeByAnchorMessageId.set(params.anchorMessageId, blockId);

  for (const consumedBlockId of consumedBlockIds) {
    const consumedBlock = state.prune.messages.blocksById.get(consumedBlockId);
    if (!consumedBlock) {
      continue;
    }

    consumedBlock.active = false;
    consumedBlock.deactivatedAt = block.createdAt;
    consumedBlock.deactivatedByBlockId = blockId;
    if (!consumedBlock.parentBlockIds.includes(blockId)) {
      consumedBlock.parentBlockIds.push(blockId);
    }
    state.prune.messages.activeBlockIds.delete(consumedBlockId);
    if (state.prune.messages.activeByAnchorMessageId.get(consumedBlock.anchorMessageId) === consumedBlockId) {
      state.prune.messages.activeByAnchorMessageId.delete(consumedBlock.anchorMessageId);
    }
  }

  for (const rawId of coveredRawMessageIds) {
    const existing = state.prune.messages.byMessageId.get(rawId);
    const tokenCount = params.messageTokenById.get(rawId) ?? 0;
    if (existing) {
      existing.tokenCount = Math.max(existing.tokenCount, tokenCount);
      if (!existing.allBlockIds.includes(blockId)) {
        existing.allBlockIds.push(blockId);
      }
      if (!existing.activeBlockIds.includes(blockId)) {
        existing.activeBlockIds.push(blockId);
      }
      continue;
    }

    state.prune.messages.byMessageId.set(rawId, {
      tokenCount,
      allBlockIds: [blockId],
      activeBlockIds: [blockId],
    });
  }

  for (const consumedBlockId of consumedBlockIds) {
    const consumedBlock = state.prune.messages.blocksById.get(consumedBlockId);
    if (!consumedBlock) {
      continue;
    }

    for (const msgId of consumedBlock.effectiveMessageIds) {
      const entry = state.prune.messages.byMessageId.get(msgId);
      if (entry) {
        entry.activeBlockIds = entry.activeBlockIds.filter((id) => id !== consumedBlockId);
      }
    }
  }

  let compressedTokens = 0;
  const directMessageIds: string[] = [];
  for (const rawId of coveredRawMessageIds) {
    const wasActive = initiallyActive.has(rawId);
    const entry = state.prune.messages.byMessageId.get(rawId);
    const isNowActive = (entry?.activeBlockIds.length ?? 0) > 0;
    if (isNowActive && !wasActive) {
      compressedTokens += entry?.tokenCount ?? 0;
      directMessageIds.push(rawId);
    }
  }

  block.directMessageIds = directMessageIds;
  block.compressedTokens = compressedTokens;
  state.stats.pruneTokenCounter += compressedTokens;
  state.stats.totalPruneTokens += state.stats.pruneTokenCounter;
  state.stats.pruneTokenCounter = 0;

  if (params.compressCallId) {
    endCompressionTiming(state, params.compressCallId, blockId);
  }

  return blockId;
}

export function deactivateBlock(
  state: SessionState,
  blockId: number,
  reason: "user" | "compression",
): void {
  const block = state.prune.messages.blocksById.get(blockId);
  if (!block) {
    return;
  }

  block.active = false;
  block.deactivatedAt = Date.now();
  block.deactivatedByUser = reason === "user";
  state.prune.messages.activeBlockIds.delete(blockId);
  if (state.prune.messages.activeByAnchorMessageId.get(block.anchorMessageId) === blockId) {
    state.prune.messages.activeByAnchorMessageId.delete(block.anchorMessageId);
  }

  for (const entry of state.prune.messages.byMessageId.values()) {
    entry.activeBlockIds = entry.activeBlockIds.filter((id) => id !== blockId);
  }

  for (const otherBlock of state.prune.messages.blocksById.values()) {
    if (otherBlock.blockId === blockId) {
      continue;
    }

    otherBlock.parentBlockIds = otherBlock.parentBlockIds.filter((id) => id !== blockId);
  }
}
