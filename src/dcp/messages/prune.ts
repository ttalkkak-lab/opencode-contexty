import { wrapCompressedSummary } from "../compress/state";
import { deduplicate } from "../strategies/deduplication";
import { purgeErrors } from "../strategies/purgeErrors";
import { isMessageCompacted } from "../state/utils";
import { replaceBlockIdsWithBlocked, getMessageParts } from "./utils";
import type { DCPConfig, SessionState, ToolParameterEntry, WithParts } from "../types";
import type { DCPLogger } from "../logger";

const PLACEHOLDER_QUESTION = "[Previous tool input cleared]";
const PLACEHOLDER_TOOL_OUTPUT = "[Old tool result content cleared]";
const PLACEHOLDER_ERROR_INPUT = "[Error tool input redacted]";
const PLACEHOLDER_COMPACTED = "[Message covered by compression block]";

function collectToolParameters(messages: WithParts[], state: SessionState): ToolParameterEntry[] {
  const toolParams: ToolParameterEntry[] = [];

  messages.forEach((message, messageIndex) => {
    const turn = messageIndex + 1;

    for (const part of getMessageParts(message)) {
      const toolPart = part as { type: string; callID?: unknown; tool?: unknown; state?: { input?: unknown; status?: unknown; error?: unknown } };
      if (toolPart?.type !== "tool" || typeof toolPart.callID !== "string" || toolPart.callID.length === 0) {
        continue;
      }

      const callID = toolPart.callID;
      const entry: ToolParameterEntry = {
        tool: typeof toolPart.tool === "string" ? toolPart.tool : "",
        parameters: toolPart.state?.input,
        status: toolPart.state?.status as ToolParameterEntry["status"],
        error: typeof toolPart.state?.error === "string" ? toolPart.state.error : undefined,
        turn,
      };

      toolParams.push(entry);
      state.toolParameters.set(callID, {
        tool: entry.tool,
        parameters: entry.parameters,
        status: entry.status,
        error: entry.error,
        turn: entry.turn,
        tokenCount: state.toolParameters.get(callID)?.tokenCount,
      });
    }
  });

  return toolParams;
}

function markToolPartCompacted(part: { state?: { time?: Record<string, unknown>; input?: unknown; output?: unknown } }): void {
  if (!part.state) {
    part.state = {};
  }

  if (!part.state.time) {
    part.state.time = {};
  }

  part.state.time.compacted = true;
  part.state.input = PLACEHOLDER_COMPACTED;
  part.state.output = PLACEHOLDER_COMPACTED;
}

function getCompactedBlock(message: WithParts, state: SessionState): { blockId: number; summary: string } | null {
  const rawId = message.info?.id;
  if (typeof rawId !== "string" || rawId.length === 0) {
    return null;
  }

  const pruneEntry = state.prune.messages.byMessageId.get(rawId);
  if (!pruneEntry || pruneEntry.activeBlockIds.length === 0) {
    return null;
  }

  const blockIds = pruneEntry.activeBlockIds.filter((blockId) => state.prune.messages.activeBlockIds.has(blockId));
  const blockId = blockIds[blockIds.length - 1];
  if (typeof blockId !== "number") {
    return null;
  }

  const block = state.prune.messages.blocksById.get(blockId);
  if (!block || typeof block.summary !== "string" || block.summary.length === 0) {
    return null;
  }

  return { blockId, summary: block.summary };
}

export function pruneToolOutputs(messages: WithParts[], state: SessionState): void {
  for (const message of messages) {
    if (isMessageCompacted(state, message)) {
      continue;
    }

    for (const part of getMessageParts(message)) {
      const toolPart = part as { type: string; callID?: unknown; state?: { time?: Record<string, unknown>; compacted?: unknown; output?: unknown } };
      if (toolPart?.type !== "tool" || typeof toolPart.callID !== "string") {
        continue;
      }

      if (!state.prune.tools.has(toolPart.callID)) {
        continue;
      }

      if (toolPart.state?.time?.compacted) {
        continue;
      }

      if (!toolPart.state) {
        toolPart.state = {};
      }

      if (!toolPart.state.time) {
        toolPart.state.time = {};
      }

      toolPart.state.output = PLACEHOLDER_TOOL_OUTPUT;
      toolPart.state.time.compacted = true;
    }
  }
}

export function pruneToolInputs(messages: WithParts[], state: SessionState): void {
  for (const message of messages) {
    if (isMessageCompacted(state, message)) {
      continue;
    }

    for (const part of getMessageParts(message)) {
      const toolPart = part as { type: string; callID?: unknown; state?: { status?: unknown; input?: unknown } };
      if (toolPart?.type !== "tool" || typeof toolPart.callID !== "string") {
        continue;
      }

      if (!state.prune.tools.has(toolPart.callID)) {
        continue;
      }

      if (toolPart.state?.status === "error") {
        continue;
      }

      if (!toolPart.state) {
        toolPart.state = {};
      }

      toolPart.state.input = PLACEHOLDER_QUESTION;
    }
  }
}

export function pruneToolErrors(messages: WithParts[], state: SessionState): void {
  for (const message of messages) {
    if (isMessageCompacted(state, message)) {
      continue;
    }

    for (const part of getMessageParts(message)) {
      const toolPart = part as { type: string; callID?: unknown; state?: { status?: unknown; input?: unknown; output?: unknown } };
      if (toolPart?.type !== "tool" || typeof toolPart.callID !== "string") {
        continue;
      }

      if (!state.prune.tools.has(toolPart.callID)) {
        continue;
      }

      if (toolPart.state?.status !== "error") {
        continue;
      }

      if (!toolPart.state) {
        toolPart.state = {};
      }

      toolPart.state.input = PLACEHOLDER_ERROR_INPUT;
      toolPart.state.output = PLACEHOLDER_ERROR_INPUT;
    }
  }
}

export function filterCompressedRanges(messages: WithParts[], state: SessionState, config: DCPConfig): void {
  for (const message of messages) {
    if (!isMessageCompacted(state, message)) {
      continue;
    }

    if (message.info?.role === "assistant") {
      continue;
    }

    const compacted = getCompactedBlock(message, state);
    if (!compacted) {
      continue;
    }

    const summary = config.compress.mode === "message"
      ? replaceBlockIdsWithBlocked(compacted.summary)
      : compacted.summary;

    const wrapped = wrapCompressedSummary(compacted.blockId, summary);
    const textPart = { type: "text", text: wrapped };
    const toolParts = getMessageParts(message)
      .filter((part) => part?.type === "tool")
      .map((part) => {
        markToolPartCompacted(part as Parameters<typeof markToolPartCompacted>[0]);
        return part;
      });

    message.parts = [textPart, ...toolParts];
  }
}

export function prune(config: DCPConfig, state: SessionState, messages: WithParts[], _logger: DCPLogger): void {
  const toolParams = collectToolParameters(messages, state);
  deduplicate(config, state, toolParams);
  purgeErrors(config, state, toolParams);
  filterCompressedRanges(messages, state, config);
  pruneToolOutputs(messages, state);
  pruneToolInputs(messages, state);
  pruneToolErrors(messages, state);
}

export { PLACEHOLDER_COMPACTED, PLACEHOLDER_ERROR_INPUT, PLACEHOLDER_QUESTION, PLACEHOLDER_TOOL_OUTPUT };
