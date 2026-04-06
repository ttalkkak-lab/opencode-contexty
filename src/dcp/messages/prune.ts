import { wrapCompressedSummary } from "../compress/state";
import { deduplicate } from "../strategies/deduplication";
import { purgeErrors } from "../strategies/purge-errors";
import { isMessageCompacted } from "../state/utils";
import { replaceBlockIdsWithBlocked } from "./utils";
import type { DCPConfig, SessionState, ToolParameterEntry, WithParts } from "../types";

export interface DCPLogger {
  info?(message: string, meta?: Record<string, unknown>): void;
  warn?(message: string, meta?: Record<string, unknown>): void;
  error?(message: string, meta?: Record<string, unknown>): void;
  debug?(message: string, meta?: Record<string, unknown>): void;
}

const PLACEHOLDER_QUESTION = "[Previous tool input cleared]";
const PLACEHOLDER_TOOL_OUTPUT = "[Old tool result content cleared]";
const PLACEHOLDER_ERROR_INPUT = "[Error tool input redacted]";
const PLACEHOLDER_COMPACTED = "[Message covered by compression block]";

function getToolParts(message: WithParts): any[] {
  return Array.isArray(message.parts) ? (message.parts as any[]) : [];
}

function collectToolParameters(messages: WithParts[], state: SessionState): ToolParameterEntry[] {
  const toolParams: ToolParameterEntry[] = [];

  messages.forEach((message, messageIndex) => {
    const turn = messageIndex + 1;

    for (const part of getToolParts(message)) {
      if (part?.type !== "tool" || typeof part.callID !== "string" || part.callID.length === 0) {
        continue;
      }

      const entry: ToolParameterEntry & { callID?: string } = {
        tool: typeof part.tool === "string" ? part.tool : "",
        parameters: part.state?.input,
        status: part.state?.status,
        error: typeof part.state?.error === "string" ? part.state.error : undefined,
        turn,
        callID: part.callID,
      };

      toolParams.push(entry);
      state.toolParameters.set(part.callID, {
        tool: entry.tool,
        parameters: entry.parameters,
        status: entry.status,
        error: entry.error,
        turn: entry.turn,
        tokenCount: state.toolParameters.get(part.callID)?.tokenCount,
      });
    }
  });

  return toolParams;
}

function markToolPartCompacted(part: any): void {
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

export function pruneToolOutputs(messages: WithParts[], state: SessionState, config: DCPConfig): void {
  void config;

  for (const message of messages) {
    if (isMessageCompacted(state, message)) {
      continue;
    }

    for (const part of getToolParts(message)) {
      if (part?.type !== "tool" || typeof part.callID !== "string") {
        continue;
      }

      if (!state.prune.tools.has(part.callID)) {
        continue;
      }

      if (part.state?.time?.compacted) {
        continue;
      }

      if (!part.state) {
        part.state = {};
      }

      if (!part.state.time) {
        part.state.time = {};
      }

      part.state.output = PLACEHOLDER_TOOL_OUTPUT;
      part.state.time.compacted = true;
    }
  }
}

export function pruneToolInputs(messages: WithParts[], state: SessionState): void {
  for (const message of messages) {
    if (isMessageCompacted(state, message)) {
      continue;
    }

    for (const part of getToolParts(message)) {
      if (part?.type !== "tool" || typeof part.callID !== "string") {
        continue;
      }

      if (!state.prune.tools.has(part.callID)) {
        continue;
      }

      if (part.state?.status === "error") {
        continue;
      }

      if (!part.state) {
        part.state = {};
      }

      part.state.input = PLACEHOLDER_QUESTION;
    }
  }
}

export function pruneToolErrors(messages: WithParts[], state: SessionState): void {
  for (const message of messages) {
    if (isMessageCompacted(state, message)) {
      continue;
    }

    for (const part of getToolParts(message)) {
      if (part?.type !== "tool" || typeof part.callID !== "string") {
        continue;
      }

      if (!state.prune.tools.has(part.callID)) {
        continue;
      }

      if (part.state?.status !== "error") {
        continue;
      }

      if (!part.state) {
        part.state = {};
      }

      part.state.input = PLACEHOLDER_ERROR_INPUT;
      part.state.output = PLACEHOLDER_ERROR_INPUT;
    }
  }
}

export function filterCompressedRanges(messages: WithParts[], state: SessionState, config: DCPConfig): void {
  void config;

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
    const parts = getToolParts(message);
    const textPart = { type: "text", text: wrapped };

    message.parts = [textPart, ...parts.filter((part) => part?.type === "tool").map((part) => {
      markToolPartCompacted(part);
      return part;
    })];

    for (const part of message.parts) {
      if (part.type === "tool") {
        markToolPartCompacted(part);
      }
    }
  }
}

export function prune(config: DCPConfig, state: SessionState, messages: WithParts[], logger: DCPLogger): void {
  void logger;

  const toolParams = collectToolParameters(messages, state);
  deduplicate(config, state, toolParams);
  purgeErrors(config, state, toolParams);
  filterCompressedRanges(messages, state, config);
  pruneToolOutputs(messages, state, config);
  pruneToolInputs(messages, state);
  pruneToolErrors(messages, state);
}

export { PLACEHOLDER_COMPACTED, PLACEHOLDER_ERROR_INPUT, PLACEHOLDER_QUESTION, PLACEHOLDER_TOOL_OUTPUT };
