import type { SessionState } from "../types";

export function startCompressionTiming(state: SessionState, callId: string): void {
  state.compressionTiming.pendingByCallId.set(callId, Date.now());
}

export function endCompressionTiming(
  state: SessionState,
  callId: string,
  blockId: number,
): number {
  const startedAt = state.compressionTiming.pendingByCallId.get(callId);
  state.compressionTiming.pendingByCallId.delete(callId);

  if (typeof startedAt !== "number" || !Number.isFinite(startedAt)) {
    return 0;
  }

  const durationMs = Math.max(0, Date.now() - startedAt);
  const block = state.prune.messages.blocksById.get(blockId);
  if (block) {
    block.durationMs = durationMs;
  }

  return durationMs;
}
