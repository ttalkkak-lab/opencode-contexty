import { DEFAULT_PROTECTED_TOOLS, isToolNameProtected } from "../protected-patterns";
import type { DCPConfig } from "../types";

export function appendProtectedContent(
  summary: string,
  config: DCPConfig,
  toolIds: string[],
): string {
  const protectedTools = [
    ...DEFAULT_PROTECTED_TOOLS,
    ...(config.compress.protectedTools ?? []),
    ...(config.strategies.deduplication.protectedTools ?? []),
  ];

  const found = toolIds.filter((toolId) => isToolNameProtected(toolId, protectedTools));
  if (found.length === 0) {
    return summary;
  }

  return `${summary}\n\nThe following protected tools were used in this conversation as well: ${[...new Set(found)].join(", ")}`;
}
