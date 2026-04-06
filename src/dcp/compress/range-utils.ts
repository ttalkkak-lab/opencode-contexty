import { parseBoundaryId } from "../message-ids";
import type { SessionState } from "../types";

export interface BlockPlaceholder {
  blockId: number;
  startOffset: number;
  endOffset: number;
}

interface NormalizedRange {
  start: number;
  end: number;
  startId: string;
  endId: string;
}

function toRangeBoundary(id: string): number {
  const parsed = parseBoundaryId(id);
  if (!parsed) {
    throw new Error(`Invalid range boundary ID: ${id}`);
  }

  return parsed.kind === "message" ? parsed.index : parsed.blockId;
}

export function validateNonOverlapping(ranges: Array<{ startId: string; endId: string }>): void {
  const normalized: NormalizedRange[] = ranges.map((range) => ({
    start: toRangeBoundary(range.startId),
    end: toRangeBoundary(range.endId),
    startId: range.startId,
    endId: range.endId,
  }));

  normalized.sort((left, right) => left.start - right.start || left.end - right.end);

  for (let index = 1; index < normalized.length; index++) {
    const previous = normalized[index - 1]!;
    const current = normalized[index]!;

    if (current.start <= previous.end) {
      throw new Error(
        `Range ${previous.startId}..${previous.endId} overlaps ${current.startId}..${current.endId}. Overlapping ranges cannot be compressed together.`,
      );
    }
  }
}

export function parseBlockPlaceholders(text: string): BlockPlaceholder[] {
  const placeholders: BlockPlaceholder[] = [];
  const regex = /\(b(\d+)\)/g;

  for (const match of text.matchAll(regex)) {
    const blockId = Number.parseInt(match[1] ?? "", 10);
    if (!Number.isInteger(blockId)) {
      continue;
    }

    placeholders.push({
      blockId,
      startOffset: match.index ?? 0,
      endOffset: (match.index ?? 0) + match[0].length,
    });
  }

  return placeholders.sort((left, right) => left.startOffset - right.startOffset);
}

export function validateSummaryPlaceholders(summary: string, blockIds: number[]): void {
  const placeholders = parseBlockPlaceholders(summary);
  const allowed = new Set(blockIds);

  for (const placeholder of placeholders) {
    if (!allowed.has(placeholder.blockId)) {
      throw new Error(`Summary references missing block b${placeholder.blockId}.`);
    }
  }
}

export function injectBlockPlaceholders(summary: string, blockLookup: Map<number, string>): string {
  return summary.replace(/\(b(\d+)\)/g, (match, blockIdText: string) => {
    const blockId = Number.parseInt(blockIdText, 10);
    return blockLookup.get(blockId) ?? match;
  });
}

export function appendMissingBlockSummaries(
  summary: string,
  consumedBlockIds: number[],
  state: SessionState,
): string {
  const referenced = new Set(parseBlockPlaceholders(summary).map((placeholder) => placeholder.blockId));
  const missingIds = consumedBlockIds.filter((blockId) => !referenced.has(blockId));

  if (missingIds.length === 0) {
    return summary;
  }

  const lines: string[] = [summary, "", "Previously compressed blocks:"];

  for (const blockId of missingIds) {
    const block = state.prune.messages.blocksById.get(blockId);
    if (!block) {
      continue;
    }

    lines.push(`### (b${blockId})`);
    lines.push(block.summary);
  }

  return lines.join("\n");
}
