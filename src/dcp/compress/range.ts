import { appendProtectedContent } from "./protected-content";
import { finalizeSession } from "./pipeline";
import { resolveRange } from "./search";
import { validateNonOverlapping, validateSummaryPlaceholders } from "./range-utils";
import { applyCompressionState } from "./state";
import { startCompressionTiming } from "./timing";
import type { SearchContext, ToolContext, CompressRangeToolArgs } from "./types";
import type { WithParts } from "../types";

function validateArgs(args: CompressRangeToolArgs): void {
  if (typeof args.topic !== "string" || args.topic.trim().length === 0) {
    throw new Error("Compression topic must be a non-empty string.");
  }

  if (!Array.isArray(args.content) || args.content.length === 0) {
    throw new Error("Compression content must contain at least one range.");
  }
}

async function getMessages(ctx: ToolContext): Promise<WithParts[]> {
  if (Array.isArray(ctx.messages)) {
    return ctx.messages;
  }

  const list = ctx.client?.messages?.list;
  if (typeof list !== "function") {
    return [];
  }

  const result = await list.call(ctx.client.messages);
  if (Array.isArray(result)) {
    return result;
  }

  if (Array.isArray(result?.messages)) {
    return result.messages;
  }

  if (Array.isArray(result?.data)) {
    return result.data;
  }

  return [];
}

function getToolNames(messages: WithParts[], messageIds: string[]): string[] {
  const selected = new Set(messageIds);
  const toolNames: string[] = [];

  for (const message of messages) {
    if (!selected.has(message.info.id)) {
      continue;
    }

    for (const part of Array.isArray(message.parts) ? message.parts : []) {
      if (part.type !== "tool" || typeof part.tool !== "string" || part.tool.length === 0) {
        continue;
      }

      toolNames.push(part.tool);
    }
  }

  return [...new Set(toolNames)];
}

export async function compressRange(
  ctx: ToolContext,
  args: CompressRangeToolArgs,
  callId: string,
): Promise<string> {
  validateArgs(args);
  validateNonOverlapping(args.content);

  const messages = await getMessages(ctx);
  const searchCtx: SearchContext = {
    state: ctx.state,
    config: ctx.config,
    messages,
    logger: ctx.logger,
  };

  let totalCompressedMessages = 0;
  let totalBlocksCreated = 0;

  for (const entry of args.content) {
    validateSummaryPlaceholders(entry.summary, []);

    const resolution = resolveRange(searchCtx, entry.startId, entry.endId);
    const enrichedSummary = appendProtectedContent(
      entry.summary,
      ctx.config,
      [...resolution.toolIds, ...getToolNames(messages, resolution.messageIds)],
    );

    startCompressionTiming(ctx.state, callId);

    const blockId = applyCompressionState(ctx.state, {
      mode: "range",
      startId: entry.startId,
      endId: entry.endId,
      summary: enrichedSummary,
      topic: args.topic,
      anchorMessageId: resolution.messageIds[0] ?? entry.startId,
      compressMessageId: resolution.messageIds[resolution.messageIds.length - 1] ?? entry.endId,
      compressCallId: callId,
      consumedBlockIds: [],
    });

    totalBlocksCreated += 1;
    totalCompressedMessages += resolution.messageIds.length;

    ctx.logger.debug?.("compressed range block", {
      blockId,
      topic: args.topic,
      startId: entry.startId,
      endId: entry.endId,
    });
  }

  finalizeSession(ctx.state, messages, ctx.config, ctx.logger);

  return `Compressed ${totalCompressedMessages} messages into ${totalBlocksCreated} block${totalBlocksCreated === 1 ? "" : "s"}.`;
}
