import type { SessionState, WithParts } from "../types";

export function getMessageRef(state: SessionState, message: WithParts): string | undefined {
  const rawId = message.info?.id;
  if (typeof rawId !== "string" || rawId.length === 0) {
    return undefined;
  }

  return state.messageIds.byRawId.get(rawId);
}

export function isMessageCompacted(state: SessionState, message: WithParts): boolean {
  const rawId = message.info?.id;
  if (typeof rawId !== "string" || rawId.length === 0) {
    return false;
  }

  const pruneEntry = state.prune.messages.byMessageId.get(rawId);
  if (!pruneEntry || pruneEntry.activeBlockIds.length === 0) {
    return false;
  }

  return pruneEntry.activeBlockIds.some((blockId) => state.prune.messages.activeBlockIds.has(blockId));
}

export function getActiveSummaryTokenUsage(state: SessionState): number {
  let total = 0;

  for (const blockId of state.prune.messages.activeBlockIds) {
    const block = state.prune.messages.blocksById.get(blockId);
    if (!block || !block.active) {
      continue;
    }

    total += block.summaryTokens;
  }

  return total;
}
