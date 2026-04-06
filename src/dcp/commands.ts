import { deactivateBlock } from "./compress/state";
import { getActiveSummaryTokenUsage } from "./state/utils";
import type { DCPConfig, SessionState } from "./types";
import type { DCPLogger } from "./logger";

function formatHelp(): string {
  return [
    "DCP commands:",
    "  stats      Show pruning token usage",
    "  context    Show current message and block counts",
    "  compress   Mark the current session for manual compression",
    "  decompress <id>  Deactivate a compression block",
    "  sweep      Prune currently known tools immediately",
    "  manual     Toggle manual mode",
  ].join("\n");
}

function handleStatsCommand(state: SessionState): string {
  const totalPrunedTokens = state.stats.totalPruneTokens;
  const activeBlocks = state.prune.messages.activeBlockIds.size;
  const summaryTokens = getActiveSummaryTokenUsage(state);
  const prunedToolIds = Array.from(state.prune.tools.keys());

  return [
    `Total tokens pruned: ${totalPrunedTokens}`,
    `Active blocks: ${activeBlocks}`,
    `Summary tokens: ${summaryTokens}`,
    `Tool IDs pruned: ${prunedToolIds.length > 0 ? prunedToolIds.join(", ") : "none"}`,
  ].join("\n");
}

function handleContextCommand(state: SessionState): string {
  const totalMessages = state.prune.messages.byMessageId.size;
  const compactedCount = Array.from(state.prune.messages.byMessageId.values()).filter(
    (entry) => entry.activeBlockIds.length > 0,
  ).length;
  const activeBlocks = state.prune.messages.activeBlockIds.size;

  return [
    `Total messages: ${totalMessages}`,
    `Compacted messages: ${compactedCount}`,
    `Active blocks: ${activeBlocks}`,
  ].join("\n");
}

function handleCompressCommand(state: SessionState): string {
  state.pendingManualTrigger = {
    sessionId: state.sessionId ?? "",
    prompt: "compress",
  };

  return "Manual compression requested.";
}

function handleDecompressCommand(args: string[], state: SessionState): string {
  const rawId = args[1]?.trim();
  const blockId = rawId ? Number.parseInt(rawId, 10) : Number.NaN;

  if (!Number.isInteger(blockId) || blockId < 1) {
    return "Usage: /dcp decompress <block-id>";
  }

  deactivateBlock(state, blockId, "user");
  return `Deactivated block ${blockId}.`;
}

function handleSweepCommand(state: SessionState): string {
  const knownToolIds = state.toolIdList.length > 0 ? state.toolIdList : Array.from(state.toolParameters.keys());
  let pruned = 0;

  for (const toolId of knownToolIds) {
    if (state.prune.tools.has(toolId)) {
      continue;
    }

    state.prune.tools.set(toolId, state.toolParameters.get(toolId)?.tokenCount ?? 0);
    pruned += 1;
  }

  state.stats.totalPruneTokens += state.stats.pruneTokenCounter;
  state.stats.pruneTokenCounter = 0;

  return `Sweep complete: ${pruned} tools pruned`;
}

function handleManualCommand(state: SessionState, args: string[]): string {
  const mode = args[1]?.trim().toLowerCase();

  if (mode === "enabled" || mode === "on") {
    state.manualMode = "active";
    return "Manual mode enabled.";
  }

  if (mode === "disabled" || mode === "off") {
    state.manualMode = false;
    return "Manual mode disabled.";
  }

  state.manualMode = state.manualMode ? false : "active";
  return state.manualMode ? "Manual mode enabled." : "Manual mode disabled.";
}

export function handleDcpCommand(
  args: string[],
  state: SessionState,
  config: DCPConfig,
  logger: DCPLogger,
): string {
  void config;
  void logger;

  const subcommand = args[0]?.trim().toLowerCase();

  if (!subcommand || subcommand === "help") {
    return formatHelp();
  }

  switch (subcommand) {
    case "stats":
      return handleStatsCommand(state);
    case "context":
      return handleContextCommand(state);
    case "compress":
      return handleCompressCommand(state);
    case "decompress":
      return handleDecompressCommand(args, state);
    case "sweep":
      return handleSweepCommand(state);
    case "manual":
      return handleManualCommand(state, args);
    default:
      return formatHelp();
  }
}
