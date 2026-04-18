import { parseBoundaryId } from "../messageIds";
import type { WithParts } from "../types";
import type {
  MessageSelectionResolution,
  RangeSelectionResolution,
  SearchContext,
} from "./types";
import { countAllMessageTokens } from "../tokenUtils";

type BoundaryKind = "start" | "end";

interface ResolvedBoundary {
  index: number;
  messageIds: string[];
  toolIds: string[];
}

function unique(values: string[]): string[] {
  return [...new Set(values.filter((value) => typeof value === "string" && value.length > 0))];
}

function getToolIds(message: WithParts): string[] {
  const toolIds: string[] = [];
  const parts = Array.isArray(message.parts) ? message.parts : [];

  for (const part of parts) {
    if (part.type !== "tool" || typeof part.callID !== "string" || part.callID.length === 0) {
      continue;
    }

    toolIds.push(part.callID);
  }

  return unique(toolIds);
}

function getMessageIndex(messages: WithParts[], rawId: string): number {
  return messages.findIndex((message) => message.info.id === rawId);
}

function getMessageByRawId(messages: WithParts[], rawId: string): WithParts | null {
  return messages.find((message) => message.info.id === rawId) ?? null;
}

function resolveMessageBoundary(searchCtx: SearchContext, ref: string): ResolvedBoundary {
  const rawId = searchCtx.state.messageIds.byRef.get(ref) ?? ref;
  const index = getMessageIndex(searchCtx.messages, rawId);

  if (index < 0) {
    throw new Error(`Boundary ${ref} is not available in the current conversation context.`);
  }

  const message = searchCtx.messages[index]!;
  return {
    index,
    messageIds: [message.info.id],
    toolIds: getToolIds(message),
  };
}

function resolveBlockBoundary(
  searchCtx: SearchContext,
  blockId: number,
  kind: BoundaryKind,
): ResolvedBoundary {
  const block = searchCtx.state.prune.messages.blocksById.get(blockId);
  if (!block) {
    throw new Error(`Boundary b${blockId} is not available in the current conversation context.`);
  }

  const messageIds = unique(block.effectiveMessageIds);
  const toolIds = unique(block.effectiveToolIds);
  const indices = messageIds
    .map((messageId) => getMessageIndex(searchCtx.messages, messageId))
    .filter((index): index is number => index >= 0);

  if (indices.length === 0) {
    throw new Error(`Boundary b${blockId} could not be resolved to an in-memory message range.`);
  }

  return {
    index: kind === "start" ? Math.min(...indices) : Math.max(...indices),
    messageIds,
    toolIds,
  };
}

function resolveBoundary(searchCtx: SearchContext, id: string, kind: BoundaryKind): ResolvedBoundary {
  const parsed = parseBoundaryId(id);
  if (!parsed) {
    throw new Error(`Invalid boundary ID: ${id}`);
  }

  if (parsed.kind === "message") {
    return resolveMessageBoundary(searchCtx, parsed.ref);
  }

  return resolveBlockBoundary(searchCtx, parsed.blockId, kind);
}

export function resolveRange(
  searchCtx: SearchContext,
  startId: string,
  endId: string,
): RangeSelectionResolution {
  const startBoundary = resolveBoundary(searchCtx, startId, "start");
  const endBoundary = resolveBoundary(searchCtx, endId, "end");

  if (startBoundary.index > endBoundary.index) {
    throw new Error(`startId ${startId} appears after endId ${endId}. Start must come before end.`);
  }

  const messageIds: string[] = [];
  const toolIds: string[] = [];
  const messageTokenById = new Map<string, number>();

  for (let index = startBoundary.index; index <= endBoundary.index; index++) {
    const message = searchCtx.messages[index];
    if (!message) {
      continue;
    }

    messageIds.push(message.info.id);
    toolIds.push(...getToolIds(message));
    if (!messageTokenById.has(message.info.id)) {
      messageTokenById.set(message.info.id, countAllMessageTokens(message));
    }
  }

  messageIds.push(...startBoundary.messageIds, ...endBoundary.messageIds);
  toolIds.push(...startBoundary.toolIds, ...endBoundary.toolIds);

  return {
    startId: parseBoundaryId(startId)?.ref ?? startId,
    endId: parseBoundaryId(endId)?.ref ?? endId,
    messageIds: unique(messageIds),
    toolIds: unique(toolIds),
    messageTokenById,
  };
}

export function resolveMessage(
  searchCtx: SearchContext,
  messageId: string,
): MessageSelectionResolution {
  const parsed = parseBoundaryId(messageId);
  if (!parsed) {
    const message = getMessageByRawId(searchCtx.messages, messageId);
    if (!message) {
      throw new Error(`Invalid message ID: ${messageId}`);
    }

    const messageTokenById = new Map<string, number>();
    messageTokenById.set(message.info.id, countAllMessageTokens(message));

    return {
      messageId,
      topic: "",
      summary: "",
      messageIds: [message.info.id],
      toolIds: getToolIds(message),
      messageTokenById,
    };
  }

  if (parsed.kind === "compressed-block") {
    throw new Error(`Message selection requires an mNNNN reference, received ${messageId}.`);
  }

  const rawId = searchCtx.state.messageIds.byRef.get(parsed.ref) ?? parsed.ref;
  const message = getMessageByRawId(searchCtx.messages, rawId);

  if (!message) {
    throw new Error(`Message ${parsed.ref} is not available in the current conversation context.`);
  }

  const messageTokenById = new Map<string, number>();
  messageTokenById.set(message.info.id, countAllMessageTokens(message));

  return {
    messageId: parsed.ref,
    topic: "",
    summary: "",
    messageIds: [message.info.id],
    toolIds: getToolIds(message),
    messageTokenById,
  };
}
