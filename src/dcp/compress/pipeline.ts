import { formatMessageIdTag, isIgnoredUserMessage } from "../message-ids";
import { countTokens, getCurrentParams } from "../token-utils";
import type { DCPLogger } from "../logger";
import type { DCPConfig, SessionState, ToolParameterEntry, ToolPart, WithParts } from "../types";
import { getMessageToolIds } from "./message-utils";
import { sendCompressNotification, type NotificationEntry } from '../ui/notification';
import type { ToolContext } from './types';

function getToolParameters(message: WithParts): ToolParameterEntry[] {
  const entries: ToolParameterEntry[] = [];
  const parts = Array.isArray(message.parts) ? message.parts : [];

  for (const part of parts) {
    const toolPart = part as ToolPart;
    if (toolPart.type !== "tool" || typeof toolPart.callID !== "string" || toolPart.callID.length === 0) {
      continue;
    }

    entries.push({
      tool: typeof toolPart.tool === "string" ? toolPart.tool : "tool",
      parameters: toolPart.state?.input ?? null,
      status: toolPart.state?.status,
      error: typeof toolPart.state?.error === "string" ? toolPart.state.error : undefined,
      turn: 0,
      tokenCount: countTokens(JSON.stringify(toolPart.state?.input ?? toolPart.state?.output ?? "")),
    });
  }

  return entries;
}

export function prepareSession(
  state: SessionState,
  messages: WithParts[],
  config: DCPConfig,
  logger: DCPLogger,
): ToolParameterEntry[] {
  void config;

  const toolParameters: ToolParameterEntry[] = [];
  state.toolParameters.clear();

  for (const message of messages) {
    const entries = getToolParameters(message);
    const toolIds = getMessageToolIds(message);

    for (let index = 0; index < entries.length; index++) {
      const entry = entries[index]!;
      const callId = toolIds[index];
      if (!callId) {
        continue;
      }

      state.toolParameters.set(callId, entry);
      toolParameters.push(entry);
    }
  }

  logger.debug("prepared compression session", {
    messages: messages.length,
    toolParameters: toolParameters.length,
  });

  return toolParameters;
}

export async function finalizeSession(
  ctx: ToolContext,
  messages: WithParts[],
  entries: NotificationEntry[],
  batchTopic: string | undefined,
): Promise<void> {

  for (const message of messages) {
    const ref = ctx.state.messageIds.byRawId.get(message.info.id);
    if (!ref) {
      continue;
    }

    const parts = Array.isArray(message.parts) ? message.parts : [];
    const lastText = [...parts].reverse().find(
      (part) => part.type === "text" && typeof (part as { text?: unknown }).text === "string",
    ) as { type: "text"; text: string } | undefined;
    if (lastText) {
      const tag = formatMessageIdTag(ref);
      if (!lastText.text.includes(tag.trim())) {
        lastText.text = `${lastText.text}\n${tag}`;
      }
    }
  }

  ctx.logger.debug("finalized compression session", { messages: messages.length });

  const sessionMessageIds = messages
    .filter((msg) => !isIgnoredUserMessage(msg))
    .map((msg) => msg.info.id);

  const params = getCurrentParams(ctx.state, messages, ctx.logger);

  await sendCompressNotification(
    ctx.client,
    ctx.logger,
    ctx.config,
    ctx.state,
    ctx.sessionId,
    entries,
    batchTopic,
    sessionMessageIds,
    params,
  );
}
