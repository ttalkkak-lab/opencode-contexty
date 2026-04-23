import type { SessionState, WithParts } from "../types";
import { getMessageParts } from "./utils";

function hasMessageReference(block: { anchorMessageId?: string; compressMessageId?: string }, ids: Set<string>): boolean {
  return ids.has(block.anchorMessageId ?? "") || ids.has(block.compressMessageId ?? "");
}

export function syncCompressionBlocks(state: SessionState, messages: WithParts[]): void {
  const messagesState = state.prune.messages;
  const messageIds = new Set(messages.map((message) => message.info.id));

  for (const [blockId, block] of Array.from(messagesState.blocksById.entries())) {
    if (!hasMessageReference(block, messageIds)) {
      block.active = false;
      messagesState.activeBlockIds.delete(blockId);
      if (messagesState.activeByAnchorMessageId.get(block.anchorMessageId) === blockId) {
        messagesState.activeByAnchorMessageId.delete(block.anchorMessageId);
      }
      continue;
    }

    block.active = messagesState.activeBlockIds.has(blockId);
  }

  for (const [rawId, entry] of Array.from(messagesState.byMessageId.entries())) {
    if (!messageIds.has(rawId)) {
      messagesState.byMessageId.delete(rawId);
      continue;
    }

    const allBlockIds = Array.isArray(entry.allBlockIds)
      ? [...new Set(entry.allBlockIds.filter((blockId) => messagesState.blocksById.has(blockId)))]
      : [];

    entry.allBlockIds = allBlockIds;
    entry.activeBlockIds = allBlockIds.filter((blockId) => messagesState.activeBlockIds.has(blockId));
  }

  const nextActiveBlockIds = new Set<number>();
  for (const [blockId, block] of messagesState.blocksById.entries()) {
    if (!block.active) {
      continue;
    }

    nextActiveBlockIds.add(blockId);
    if (block.anchorMessageId) {
      messagesState.activeByAnchorMessageId.set(block.anchorMessageId, blockId);
    }
  }

  messagesState.activeBlockIds = nextActiveBlockIds;
}

export function buildToolIdList(state: SessionState, messages: WithParts[]): string[] {
  const toolIds: string[] = [];

  for (const message of messages) {
    for (const part of getMessageParts(message)) {
      if (part?.type !== "tool" || typeof part.callID !== "string" || part.callID.length === 0) {
        continue;
      }

      toolIds.push(part.callID);
    }
  }

  state.toolIdList = toolIds;
  return toolIds;
}
