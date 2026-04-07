import { deactivateBlock } from './compress/state';
import { getActiveSummaryTokenUsage } from './state/utils';
import { getCurrentParams, getTotalToolTokens } from './token-utils';
import { getLastUserMessage, isIgnoredUserMessage, parseBlockRef } from './message-ids';
import { isMessageCompacted } from './state/utils';
import {
  isToolNameProtected,
  isFilePathProtected,
  getFilePathsFromParameters,
} from './protected-patterns';
import { sendIgnoredMessage, formatTokenCount } from './ui/notification';
import {
  getActiveCompressionTargets,
  getRecompressibleCompressionTargets,
  resolveCompressionTarget,
  formatAvailableBlocksMessage,
} from './ui/format';
import type { DCPConfig, SessionState, WithParts } from './types';
import type { DCPLogger } from './logger';

// ---------------------------------------------------------------------------
// Command context shared by all handlers
// ---------------------------------------------------------------------------

export interface CommandContext {
  client: any;
  state: SessionState;
  config: DCPConfig;
  logger: DCPLogger;
  sessionId: string;
  messages: WithParts[];
}

export interface SweepContext extends CommandContext {
  args: string[];
  workingDirectory: string;
}

export interface BlockCommandContext extends CommandContext {
  args: string[];
}

// ---------------------------------------------------------------------------
// Help
// ---------------------------------------------------------------------------

const BASE_COMMANDS: [string, string][] = [
  ['/dcp context', 'Show token usage breakdown for current session'],
  ['/dcp stats', 'Show DCP pruning statistics'],
  ['/dcp sweep [n]', 'Prune tools since last user message, or last n tools'],
  ['/dcp manual [on|off]', 'Toggle manual mode or set explicit state'],
];

const TOOL_COMMANDS: Record<string, [string, string]> = {
  compress: ['/dcp compress [focus]', 'Trigger manual compress tool execution'],
  decompress: ['/dcp decompress <n>', 'Restore selected compression'],
  recompress: ['/dcp recompress <n>', 'Re-apply a user-decompressed compression'],
};

function getVisibleCommands(state: SessionState, config: DCPConfig): [string, string][] {
  const commands = [...BASE_COMMANDS];
  if (config.compress.permission !== 'deny') {
    commands.push(TOOL_COMMANDS.compress);
    commands.push(TOOL_COMMANDS.decompress);
    commands.push(TOOL_COMMANDS.recompress);
  }
  return commands;
}

function formatHelpMessage(state: SessionState, config: DCPConfig): string {
  const commands = getVisibleCommands(state, config);
  const colWidth = Math.max(...commands.map(([cmd]) => cmd.length)) + 4;
  const lines: string[] = [];

  lines.push('╭─────────────────────────────────────────────────────────────────────────╮');
  lines.push('│                              DCP Commands                               │');
  lines.push('╰─────────────────────────────────────────────────────────────────────────╯');
  lines.push('');
  lines.push(`  ${'Manual mode:'.padEnd(colWidth)}${state.manualMode ? 'ON' : 'OFF'}`);
  lines.push('');
  for (const [cmd, desc] of commands) {
    lines.push(`  ${cmd.padEnd(colWidth)}${desc}`);
  }
  lines.push('');

  return lines.join('\n');
}

export async function handleHelpCommand(ctx: CommandContext): Promise<void> {
  const { client, state, config, logger, sessionId, messages } = ctx;
  const message = formatHelpMessage(state, config);
  const params = getCurrentParams(state, messages, logger);
  await sendIgnoredMessage(client, sessionId, message, params, logger);
  logger.info('Help command executed');
}

// ---------------------------------------------------------------------------
// Stats
// ---------------------------------------------------------------------------

function formatStatsMessage(
  totalPruneTokens: number,
  activeBlocks: number,
  summaryTokens: number,
  prunedToolCount: number
): string {
  const lines: string[] = [];
  lines.push('╭───────────────────────────────────────────────────────────╮');
  lines.push('│                    DCP Statistics                         │');
  lines.push('╰───────────────────────────────────────────────────────────╯');
  lines.push('');
  lines.push(`  Total tokens pruned:  ~${formatTokenCount(totalPruneTokens)}`);
  lines.push(`  Active blocks:        ${activeBlocks}`);
  lines.push(`  Summary tokens:       ~${formatTokenCount(summaryTokens)}`);
  lines.push(`  Tools pruned:         ${prunedToolCount}`);
  lines.push('');
  return lines.join('\n');
}

export async function handleStatsCommand(ctx: CommandContext): Promise<void> {
  const { client, state, logger, sessionId, messages } = ctx;
  const totalPruneTokens = state.stats.totalPruneTokens;
  const activeBlocks = state.prune.messages.activeBlockIds.size;
  const summaryTokens = getActiveSummaryTokenUsage(state);
  const prunedToolCount = state.prune.tools.size;

  const message = formatStatsMessage(
    totalPruneTokens,
    activeBlocks,
    summaryTokens,
    prunedToolCount
  );
  const params = getCurrentParams(state, messages, logger);
  await sendIgnoredMessage(client, sessionId, message, params, logger);
  logger.info('Stats command executed', { totalPruneTokens, activeBlocks, summaryTokens });
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

function formatContextMessage(
  totalMessages: number,
  compactedCount: number,
  activeBlocks: number
): string {
  const lines: string[] = [];
  lines.push('╭───────────────────────────────────────────────────────────╮');
  lines.push('│                  DCP Context Analysis                     │');
  lines.push('╰───────────────────────────────────────────────────────────╯');
  lines.push('');
  lines.push(`  Total messages:       ${totalMessages}`);
  lines.push(`  Compacted messages:   ${compactedCount}`);
  lines.push(`  Active blocks:        ${activeBlocks}`);
  lines.push('');
  return lines.join('\n');
}

export async function handleContextCommand(ctx: CommandContext): Promise<void> {
  const { client, state, logger, sessionId, messages } = ctx;
  const totalMessages = state.prune.messages.byMessageId.size;
  const compactedCount = Array.from(state.prune.messages.byMessageId.values()).filter(
    (entry) => entry.activeBlockIds.length > 0
  ).length;
  const activeBlocks = state.prune.messages.activeBlockIds.size;

  const message = formatContextMessage(totalMessages, compactedCount, activeBlocks);
  const params = getCurrentParams(state, messages, logger);
  await sendIgnoredMessage(client, sessionId, message, params, logger);
  logger.info('Context command executed', { totalMessages, compactedCount, activeBlocks });
}

// ---------------------------------------------------------------------------
// Compress (manual trigger)
// ---------------------------------------------------------------------------

const COMPRESS_TRIGGER_PROMPT = [
  '<compress triggered manually>',
  'Manual mode trigger received. You must now use the compress tool.',
  'Find the most significant completed conversation content that can be compressed into a high-fidelity technical summary.',
  'Follow the active compress mode, preserve all critical implementation details, and choose safe targets.',
  'Return after compress with a brief explanation of what content was compressed.',
].join('\n\n');

export async function handleCompressCommand(
  ctx: CommandContext,
  userFocus?: string
): Promise<string | null> {
  const { state } = ctx;
  const sections = [COMPRESS_TRIGGER_PROMPT];
  if (userFocus && userFocus.trim().length > 0) {
    sections.push(`Additional user focus:\n${userFocus.trim()}`);
  }
  const prompt = sections.join('\n\n');

  state.manualMode = 'compress-pending';
  state.pendingManualTrigger = {
    sessionId: state.sessionId ?? '',
    prompt,
  };

  return prompt;
}

// ---------------------------------------------------------------------------
// Decompress
// ---------------------------------------------------------------------------

function parseBlockIdArg(arg: string): number | null {
  const normalized = arg.trim().toLowerCase();
  if (/^[1-9]\d*$/.test(normalized)) {
    const parsed = Number.parseInt(normalized, 10);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
  }
  return parseBlockRef(normalized);
}

export async function handleDecompressCommand(ctx: BlockCommandContext): Promise<void> {
  const { client, state, logger, sessionId, messages, args } = ctx;
  const params = getCurrentParams(state, messages, logger);
  const targetArg = args[0];

  if (args.length > 1) {
    await sendIgnoredMessage(
      client,
      sessionId,
      'Invalid arguments. Usage: /dcp decompress <n>',
      params,
      logger
    );
    return;
  }

  if (!targetArg) {
    const availableTargets = getActiveCompressionTargets(state.prune.messages);
    const message = formatAvailableBlocksMessage(availableTargets, 'decompress');
    await sendIgnoredMessage(client, sessionId, message, params, logger);
    return;
  }

  const targetBlockId = parseBlockIdArg(targetArg);
  if (targetBlockId === null) {
    await sendIgnoredMessage(
      client,
      sessionId,
      'Please enter a compression number. Example: /dcp decompress 2',
      params,
      logger
    );
    return;
  }

  logger.info('decompress called', {
    sessionId,
    targetBlockId,
    blocksByIdSize: state.prune.messages.blocksById.size,
    blocksByIdKeys: Array.from(state.prune.messages.blocksById.keys()),
    activeBlockIds: Array.from(state.prune.messages.activeBlockIds),
  });
  const block = state.prune.messages.blocksById.get(targetBlockId);
  logger.info('resolveCompressionTarget lookup', {
    found: !!block,
    mode: block?.mode,
    active: block?.active,
    runId: block?.runId,
  });
  const target = resolveCompressionTarget(state.prune.messages, targetBlockId);
  if (!target) {
    await sendIgnoredMessage(
      client,
      sessionId,
      `Compression ${targetBlockId} does not exist. ${{ sessionId, targetBlockId, blocksByIdSize: state.prune.messages.blocksById.size, blocksByIdKeys: Array.from(state.prune.messages.blocksById.keys()), activeBlockIds: Array.from(state.prune.messages.activeBlockIds) }}`,
      params,
      logger
    );
    return;
  }

  for (const block of target.blocks) {
    deactivateBlock(state, block.blockId, 'user');
  }

  const tokensSaved = target.compressedTokens;
  await sendIgnoredMessage(
    client,
    sessionId,
    `Restored compression ${target.displayId} (${target.topic}). ~${formatTokenCount(tokensSaved)} tokens restored.`,
    params,
    logger
  );
  logger.info('Decompress command completed', { targetBlockId: target.displayId });
}

// ---------------------------------------------------------------------------
// Recompress
// ---------------------------------------------------------------------------

export async function handleRecompressCommand(ctx: BlockCommandContext): Promise<void> {
  const { client, state, logger, sessionId, messages, args } = ctx;
  const params = getCurrentParams(state, messages, logger);
  const targetArg = args[0];

  if (args.length > 1) {
    await sendIgnoredMessage(
      client,
      sessionId,
      'Invalid arguments. Usage: /dcp recompress <n>',
      params,
      logger
    );
    return;
  }

  const availableMessageIds = new Set(messages.map((msg) => msg.info.id));

  if (!targetArg) {
    const availableTargets = getRecompressibleCompressionTargets(
      state.prune.messages,
      availableMessageIds
    );
    const message = formatAvailableBlocksMessage(availableTargets, 'recompress');
    await sendIgnoredMessage(client, sessionId, message, params, logger);
    return;
  }

  const targetBlockId = parseBlockIdArg(targetArg);
  if (targetBlockId === null) {
    await sendIgnoredMessage(
      client,
      sessionId,
      'Please enter a compression number. Example: /dcp recompress 2',
      params,
      logger
    );
    return;
  }

  const target = resolveCompressionTarget(state.prune.messages, targetBlockId);
  if (!target) {
    logger.info('resolveCompressionTarget failed to find target for recompress', {
      targetBlockId,
      blocksByIdSize: state.prune.messages.blocksById.size,
      blocksByIdKeys: Array.from(state.prune.messages.blocksById.keys()),
      activeBlockIds: Array.from(state.prune.messages.activeBlockIds),
    });
    console.error('resolveCompressionTarget failed to find target for recompress', {
      targetBlockId,
      blocksByIdSize: state.prune.messages.blocksById.size,
      blocksByIdKeys: Array.from(state.prune.messages.blocksById.keys()),
      activeBlockIds: Array.from(state.prune.messages.activeBlockIds),
    });
    await sendIgnoredMessage(
      client,
      sessionId,
      `Compression ${targetBlockId} does not exist. ${{ sessionId, targetBlockId, blocksByIdSize: state.prune.messages.blocksById.size, blocksByIdKeys: Array.from(state.prune.messages.blocksById.keys()), activeBlockIds: Array.from(state.prune.messages.activeBlockIds) }}`,
      params,
      logger
    );
    return;
  }

  if (!target.blocks.some((block) => block.deactivatedByUser)) {
    const msg = target.blocks.some((block) => block.active)
      ? `Compression ${target.displayId} is already active.`
      : `Compression ${target.displayId} is not user-decompressed.`;
    await sendIgnoredMessage(client, sessionId, msg, params, logger);
    return;
  }

  for (const block of target.blocks) {
    block.active = true;
    block.deactivatedByUser = false;
    block.deactivatedAt = undefined;
    block.deactivatedByBlockId = undefined;

    state.prune.messages.activeBlockIds.add(block.blockId);
    if (block.anchorMessageId) {
      state.prune.messages.activeByAnchorMessageId.set(block.anchorMessageId, block.blockId);
    }

    for (const rawId of block.effectiveMessageIds) {
      const entry = state.prune.messages.byMessageId.get(rawId);
      if (entry) {
        if (!entry.allBlockIds.includes(block.blockId)) {
          entry.allBlockIds.push(block.blockId);
        }
        if (!entry.activeBlockIds.includes(block.blockId)) {
          entry.activeBlockIds.push(block.blockId);
        }
      }
    }
  }

  const tokensRepruned = target.compressedTokens;
  await sendIgnoredMessage(
    client,
    sessionId,
    `Re-applied compression ${target.displayId} (${target.topic}). ~${formatTokenCount(tokensRepruned)} tokens re-pruned.`,
    params,
    logger
  );
  logger.info('Recompress command completed', { targetBlockId: target.displayId });
}

// ---------------------------------------------------------------------------
// Sweep
// ---------------------------------------------------------------------------

function findLastUserMessageIndex(messages: WithParts[]): number {
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    if (msg.info.role === 'user' && !isIgnoredUserMessage(msg)) {
      return i;
    }
  }
  return -1;
}

function collectToolIdsAfterIndex(
  state: SessionState,
  messages: WithParts[],
  afterIndex: number
): string[] {
  const toolIds: string[] = [];
  for (let i = afterIndex + 1; i < messages.length; i++) {
    const msg = messages[i];
    if (isMessageCompacted(state, msg)) {
      continue;
    }
    const parts = Array.isArray(msg.parts) ? msg.parts : [];
    for (const part of parts) {
      if (part.type === 'tool' && (part as any).callID && (part as any).tool) {
        toolIds.push((part as any).callID);
      }
    }
  }
  return toolIds;
}

function formatSweepMessage(
  toolCount: number,
  tokensSaved: number,
  mode: 'since-user' | 'last-n',
  toolIds: string[],
  toolMetadata: Map<string, { tool: string }>,
  workingDirectory?: string,
  skippedProtected?: number
): string {
  const lines: string[] = [];
  lines.push('╭───────────────────────────────────────────────────────────╮');
  lines.push('│                      DCP Sweep                            │');
  lines.push('╰───────────────────────────────────────────────────────────╯');
  lines.push('');

  if (toolCount === 0) {
    lines.push(
      mode === 'since-user'
        ? 'No tools found since the previous user message.'
        : 'No tools found to sweep.'
    );
    if (skippedProtected && skippedProtected > 0) {
      lines.push(`(${skippedProtected} protected tool(s) skipped)`);
    }
  } else {
    lines.push(
      mode === 'since-user'
        ? `Swept ${toolCount} tool(s) since the previous user message.`
        : `Swept the last ${toolCount} tool(s).`
    );
    lines.push(`Tokens saved: ~${tokensSaved.toLocaleString()}`);
    if (skippedProtected && skippedProtected > 0) {
      lines.push(`(${skippedProtected} protected tool(s) skipped)`);
    }
    lines.push('');
    for (const id of toolIds) {
      const entry = toolMetadata.get(id);
      const toolName = entry?.tool ?? id;
      lines.push(`  • ${toolName} (${id})`);
    }
  }

  return lines.join('\n');
}

export async function handleSweepCommand(ctx: SweepContext): Promise<void> {
  const { client, state, config, logger, sessionId, messages, args, workingDirectory } = ctx;
  const params = getCurrentParams(state, messages, logger);
  const protectedTools = config.commands.protectedTools;

  const numArg = args[0] ? parseInt(args[0], 10) : null;
  const isLastNMode = numArg !== null && !isNaN(numArg) && numArg > 0;

  let toolIdsToSweep: string[];
  let mode: 'since-user' | 'last-n';

  if (isLastNMode) {
    mode = 'last-n';
    const startIndex = Math.max(0, state.toolIdList.length - numArg!);
    toolIdsToSweep = state.toolIdList.slice(startIndex);
  } else {
    mode = 'since-user';
    const lastUserMsgIndex = findLastUserMessageIndex(messages);
    if (lastUserMsgIndex === -1) {
      const message = [
        '╭───────────────────────────────────────────────────────────╮',
        '│                      DCP Sweep                            │',
        '╰───────────────────────────────────────────────────────────╯',
        '',
        'Nothing swept: no user message found.',
      ].join('\n');
      await sendIgnoredMessage(client, sessionId, message, params, logger);
      return;
    }
    toolIdsToSweep = collectToolIdsAfterIndex(state, messages, lastUserMsgIndex);
  }

  const newToolIds = toolIdsToSweep.filter((id) => {
    if (state.prune.tools.has(id)) return false;
    const entry = state.toolParameters.get(id);
    if (!entry) return true;
    if (isToolNameProtected(entry.tool, protectedTools)) return false;
    const filePaths = getFilePathsFromParameters(entry.tool, entry.parameters);
    if (isFilePathProtected(filePaths, config.protectedFilePatterns)) return false;
    return true;
  });

  const skippedProtected = toolIdsToSweep.filter((id) => {
    const entry = state.toolParameters.get(id);
    if (!entry) return false;
    if (isToolNameProtected(entry.tool, protectedTools)) return true;
    const filePaths = getFilePathsFromParameters(entry.tool, entry.parameters);
    if (isFilePathProtected(filePaths, config.protectedFilePatterns)) return true;
    return false;
  }).length;

  const tokensSaved = getTotalToolTokens(state, newToolIds);

  for (const id of newToolIds) {
    const entry = state.toolParameters.get(id);
    state.prune.tools.set(id, entry?.tokenCount ?? 0);
  }
  state.stats.pruneTokenCounter += tokensSaved;
  state.stats.totalPruneTokens += state.stats.pruneTokenCounter;
  state.stats.pruneTokenCounter = 0;

  const toolMetadata: Map<string, { tool: string }> = new Map();
  for (const id of newToolIds) {
    const entry = state.toolParameters.get(id);
    if (entry) toolMetadata.set(id, entry);
  }

  const message = formatSweepMessage(
    newToolIds.length,
    tokensSaved,
    mode,
    newToolIds,
    toolMetadata,
    workingDirectory,
    skippedProtected
  );
  await sendIgnoredMessage(client, sessionId, message, params, logger);
  logger.info('Sweep command completed', { toolsSwept: newToolIds.length, tokensSaved });
}

// ---------------------------------------------------------------------------
// Manual toggle
// ---------------------------------------------------------------------------

const MANUAL_MODE_ON =
  'Manual mode is now ON. Use /dcp compress to trigger context tools manually.';
const MANUAL_MODE_OFF = 'Manual mode is now OFF.';

export async function handleManualToggleCommand(
  ctx: CommandContext,
  modeArg?: string
): Promise<void> {
  const { client, state, logger, sessionId, messages } = ctx;

  if (modeArg === 'on') {
    state.manualMode = 'active';
  } else if (modeArg === 'off') {
    state.manualMode = false;
  } else {
    state.manualMode = state.manualMode ? false : 'active';
  }

  const params = getCurrentParams(state, messages, logger);
  await sendIgnoredMessage(
    client,
    sessionId,
    state.manualMode ? MANUAL_MODE_ON : MANUAL_MODE_OFF,
    params,
    logger
  );
  logger.info('Manual mode toggled', { manualMode: state.manualMode });
}

// ---------------------------------------------------------------------------
// Pending manual trigger application (used in messages-transform)
// ---------------------------------------------------------------------------

export function applyPendingManualTrigger(
  state: SessionState,
  messages: WithParts[],
  logger: DCPLogger
): void {
  const pending = state.pendingManualTrigger;
  if (!pending) return;

  if (!state.sessionId || pending.sessionId !== state.sessionId) {
    state.pendingManualTrigger = null;
    return;
  }

  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    if (msg.info.role !== 'user' || isIgnoredUserMessage(msg)) continue;

    for (const part of msg.parts ?? []) {
      if (part.type !== 'text' || (part as any).ignored || (part as any).synthetic) continue;

      (part as any).text = pending.prompt;
      state.pendingManualTrigger = null;
      logger.debug('Applied manual prompt', { sessionId: pending.sessionId });
      return;
    }
  }

  state.pendingManualTrigger = null;
}
