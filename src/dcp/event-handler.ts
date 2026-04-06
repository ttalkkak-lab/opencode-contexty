import { endCompressionTiming, startCompressionTiming } from "./compress/timing";
import type { SessionState } from "./types";

type CompressionEvent = {
  type: string;
  part?: any;
  message?: any;
};

function getCallId(part: any): string | undefined {
  return typeof part?.callID === "string" && part.callID.length > 0 ? part.callID : undefined;
}

function isCompressTool(part: any): boolean {
  return part?.type === "tool" && part.tool === "compress";
}

function isRunning(part: any): boolean {
  return part?.state?.status === "running";
}

function isCompleted(part: any): boolean {
  return part?.state?.status === "completed";
}

function getBlockId(output: unknown): number | undefined {
  if (typeof output === "number" && Number.isInteger(output)) {
    return output;
  }

  if (typeof output === "string") {
    const parsed = Number.parseInt(output, 10);
    return Number.isInteger(parsed) ? parsed : undefined;
  }

  if (!output || typeof output !== "object") {
    return undefined;
  }

  const candidate = (output as Record<string, unknown>).blockId
    ?? (output as Record<string, unknown>).blockID
    ?? (output as Record<string, unknown>).block_id;

  if (typeof candidate === "number" && Number.isInteger(candidate)) {
    return candidate;
  }

  if (typeof candidate === "string") {
    const parsed = Number.parseInt(candidate, 10);
    return Number.isInteger(parsed) ? parsed : undefined;
  }

  return undefined;
}

export function handleCompressionEvent(state: SessionState, event: CompressionEvent): void {
  if (event.type !== "message.part.updated") {
    return;
  }

  const part = event.part ?? event.message?.part;
  if (!isCompressTool(part)) {
    return;
  }

  const callId = getCallId(part);
  if (!callId) {
    return;
  }

  if (isRunning(part)) {
    startCompressionTiming(state, callId);
    return;
  }

  if (!isCompleted(part)) {
    return;
  }

  const output = part?.state?.output;
  const blockId = getBlockId(output);
  if (typeof blockId !== "number") {
    state.compressionTiming.pendingByCallId.delete(callId);
    return;
  }

  const durationMs = endCompressionTiming(state, callId, blockId);
  console.info("Compression completed", { callId, blockId, durationMs });
}
