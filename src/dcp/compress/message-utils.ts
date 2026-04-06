import { parseMessageRef } from "../message-ids";
import type { WithParts } from "../types";

function unique(values: string[]): string[] {
  return [...new Set(values.filter((value) => typeof value === "string" && value.length > 0))];
}

export function getMessageToolIds(message: WithParts): string[] {
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

export function getRangeMessageToolIds(
  messages: WithParts[],
  startIdx: number,
  endIdx: number,
): { messageIds: string[]; toolIds: string[] } {
  const messageIds: string[] = [];
  const toolIds: string[] = [];

  for (let index = Math.max(0, startIdx); index <= Math.min(messages.length - 1, endIdx); index++) {
    const message = messages[index];
    if (!message) {
      continue;
    }

    messageIds.push(message.info.id);
    toolIds.push(...getMessageToolIds(message));
  }

  return {
    messageIds: unique(messageIds),
    toolIds: unique(toolIds),
  };
}

export function getMessageById(messages: WithParts[], id: string): WithParts | null {
  const rawMatch = messages.find((message) => message.info.id === id);
  if (rawMatch) {
    return rawMatch;
  }

  const parsed = parseMessageRef(id);
  if (parsed === null) {
    return null;
  }

  return messages[parsed - 1] ?? null;
}
