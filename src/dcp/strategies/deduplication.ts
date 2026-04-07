import { DEFAULT_PROTECTED_TOOLS, isToolNameProtected } from '../protected-patterns';
import type { DCPConfig, SessionState, ToolParameterEntry } from '../types';

type ToolParameterEntryWithCallId = ToolParameterEntry & { callID?: string };

export function deduplicate(config: DCPConfig, state: SessionState, toolParams: ToolParameterEntry[]): void {
  if (!config.strategies.deduplication.enabled) {
    return;
  }

  const protectedTools = [...DEFAULT_PROTECTED_TOOLS, ...(config.strategies.deduplication.protectedTools ?? [])];
  const grouped = new Map<string, ToolParameterEntryWithCallId[]>();

  for (const entry of toolParams as ToolParameterEntryWithCallId[]) {
    if (isToolNameProtected(entry.tool, protectedTools)) {
      continue;
    }

    const signature = `${entry.tool}:${JSON.stringify(sortParameters(normalizeParameters(entry.parameters)))}`;
    const existing = grouped.get(signature);

    if (existing) {
      existing.push(entry);
    } else {
      grouped.set(signature, [entry]);
    }
  }

  for (const entries of grouped.values()) {
    if (entries.length < 2) {
      continue;
    }

    const newestTurn = Math.max(...entries.map((entry) => entry.turn));

    for (const entry of entries) {
      if (entry.turn === newestTurn) {
        continue;
      }

      if (!entry.callID) {
        continue;
      }

      state.prune.tools.set(entry.callID, entry.turn);
    }
  }
}

function normalizeParameters(parameters: unknown): unknown {
  if (parameters === null || parameters === undefined) {
    return parameters;
  }

  if (Array.isArray(parameters)) {
    return parameters.map((item) => normalizeParameters(item));
  }

  if (typeof parameters !== 'object') {
    return parameters;
  }

  const normalized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(parameters as Record<string, unknown>)) {
    if (value !== null && value !== undefined) {
      normalized[key] = normalizeParameters(value);
    }
  }

  return normalized;
}

function sortParameters(parameters: unknown): unknown {
  if (parameters === null || parameters === undefined) {
    return parameters;
  }

  if (Array.isArray(parameters)) {
    return parameters.map((item) => sortParameters(item));
  }

  if (typeof parameters !== 'object') {
    return parameters;
  }

  const sorted: Record<string, unknown> = {};

  for (const key of Object.keys(parameters as Record<string, unknown>).sort()) {
    sorted[key] = sortParameters((parameters as Record<string, unknown>)[key]);
  }

  return sorted;
}
