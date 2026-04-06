import type { SearchContext, ToolContext, CompressMessageToolArgs } from "./types";
import { resolveMessage } from "./search";
import { appendProtectedContent } from "./protected-content";
import { startCompressionTiming } from "./timing";
import { applyCompressionState } from "./state";
import { finalizeSession } from "./pipeline";
import type { WithParts } from "../types";

function getMessages(ctx: ToolContext): WithParts[] {
  const client = ctx.client as {
    messages?: unknown;
    getMessages?: () => unknown;
  } | null;

  const fromGetter = client?.getMessages?.();
  if (Array.isArray(fromGetter)) {
    return fromGetter as WithParts[];
  }

  if (Array.isArray(client?.messages)) {
    return client.messages as WithParts[];
  }

  return [];
}

function validateArgs(args: CompressMessageToolArgs): void {
  if (typeof args.topic !== "string" || args.topic.trim().length === 0) {
    throw new Error("Compression topic must be a non-empty string.");
  }

  if (!Array.isArray(args.content) || args.content.length === 0) {
    throw new Error("Compression content must be a non-empty array.");
  }
}

export async function compressMessage(
  ctx: ToolContext,
  args: CompressMessageToolArgs,
  callId: string,
): Promise<string> {
  validateArgs(args);

  const messages = getMessages(ctx);
  const searchCtx: SearchContext = {
    state: ctx.state,
    config: ctx.config,
    messages,
    logger: ctx.logger,
  };

  let totalCompressedTokens = 0;

  for (const entry of args.content) {
    if (typeof entry.messageId !== "string" || entry.messageId.trim().length === 0) {
      throw new Error("Compression messageId must be a non-empty string.");
    }

    if (typeof entry.topic !== "string" || entry.topic.trim().length === 0) {
      throw new Error("Compression entry topic must be a non-empty string.");
    }

    if (typeof entry.summary !== "string" || entry.summary.trim().length === 0) {
      throw new Error("Compression summary must be a non-empty string.");
    }

    const resolution = resolveMessage(searchCtx, entry.messageId);
    const enrichedSummary = appendProtectedContent(entry.summary, ctx.config, resolution.toolIds);

    startCompressionTiming(ctx.state, callId);

    applyCompressionState(ctx.state, {
      mode: "message",
      startId: entry.messageId,
      endId: entry.messageId,
      summary: enrichedSummary,
      topic: entry.topic,
      anchorMessageId: resolution.messageIds[0],
      compressMessageId: resolution.messageIds[resolution.messageIds.length - 1],
      compressCallId: callId,
      consumedBlockIds: [],
    });

    const lastBlock = Array.from(ctx.state.prune.messages.blocksById.values()).at(-1);
    if (lastBlock) {
      totalCompressedTokens += lastBlock.compressedTokens;
    }
  }

  finalizeSession(ctx.state, messages, ctx.config, ctx.logger);

  return `Compressed ${args.content.length} message(s) into ${args.content.length} block(s). ${totalCompressedTokens} token(s) compressed.`;
}
