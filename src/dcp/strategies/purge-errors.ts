import { DEFAULT_PROTECTED_TOOLS, isToolNameProtected } from '../protected-patterns';
import type { DCPConfig, SessionState, ToolParameterEntry } from '../types';

type ToolParameterEntryWithCallId = ToolParameterEntry & { callID?: string };

export function purgeErrors(config: DCPConfig, state: SessionState, toolParams: ToolParameterEntry[]): void {
  if (!config.strategies.purgeErrors.enabled) {
    return;
  }

  const protectedTools = [...DEFAULT_PROTECTED_TOOLS, ...(config.strategies.purgeErrors.protectedTools ?? [])];

  for (const entry of toolParams as ToolParameterEntryWithCallId[]) {
    if (entry.status !== 'error') {
      continue;
    }

    if (isToolNameProtected(entry.tool, protectedTools)) {
      continue;
    }

    if (state.currentTurn - entry.turn > config.strategies.purgeErrors.turns) {
      if (!entry.callID) {
        continue;
      }

      state.prune.tools.set(entry.callID, entry.turn);
    }
  }
}
