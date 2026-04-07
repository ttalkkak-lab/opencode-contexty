import { tool, type Plugin, type PluginInput } from '@opencode-ai/plugin';
import * as path from 'path';
import * as fs from 'fs/promises';
import { Logger } from './utils';
import { AASMModule } from './aasm';
import {
  createAASMChatHook,
  createHSCMMTransformHook,
  createCommandHook,
  createPermissionAskHook,
  createAASMReviewCommandHook,
  createSystemTransformHook as createACPMSystemTransformHook,
  createToolExecuteBeforeHook,
  createToolExecuteAfterHook,
} from './hooks';
import { createAgentTool, createAcpmTool } from './tools';
import { ACPMModule } from './acpm';
import { ContextyConfig } from './types';
import { TLSModule } from './tls';
import { createLogger as createDCPLogger } from './dcp/logger';
import { compressMessage } from './dcp/compress/message';
import { compressRange } from './dcp/compress/range';
import type { CompressMessageToolArgs, CompressRangeToolArgs } from './dcp/compress/types';
import type { ToolContext as DCPToolContext } from './dcp/compress/types';
import type { WithParts } from './dcp/types';
import {
  handleHelpCommand,
  handleStatsCommand,
  handleContextCommand,
  handleCompressCommand,
  handleDecompressCommand,
  handleRecompressCommand,
  handleSweepCommand,
  handleManualToggleCommand,
} from './dcp/commands';
import { handleCompressionEvent } from './dcp/event-handler';
import { renderSystemPrompt } from './dcp/prompts';
import { stripHallucinationsFromString } from './dcp/messages/utils';
import type { SessionState } from './dcp/types';
import { readPruningState, writePruningState } from './hscmm/storage';
import { sessionTracker } from './core/sessionTracker';

function createEmptyDcpState(sessionId: string | null): SessionState {
  return {
    sessionId,
    isSubAgent: false,
    manualMode: false,
    compressPermission: undefined,
    pendingManualTrigger: null,
    prune: {
      tools: new Map(),
      messages: {
        byMessageId: new Map(),
        blocksById: new Map(),
        activeBlockIds: new Set(),
        activeByAnchorMessageId: new Map(),
        nextBlockId: 1,
        nextRunId: 1,
      },
    },
    nudges: {
      contextLimitAnchors: new Set(),
      turnNudgeAnchors: new Set(),
      iterationNudgeAnchors: new Set(),
    },
    stats: {
      pruneTokenCounter: 0,
      totalPruneTokens: 0,
    },
    compressionTiming: {
      pendingByCallId: new Map(),
    },
    toolParameters: new Map(),
    subAgentResultCache: new Map(),
    toolIdList: [],
    messageIds: {
      byRawId: new Map(),
      byRef: new Map(),
      nextRef: 1,
    },
    lastCompaction: 0,
    currentTurn: 0,
    variant: undefined,
    modelContextLimit: undefined,
    systemPromptTokens: undefined,
  };
}

function getSessionIdFromValue(value: unknown): string | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const candidate =
    (value as { sessionID?: unknown; sessionId?: unknown }).sessionID ??
    (value as { sessionID?: unknown; sessionId?: unknown }).sessionId;

  return typeof candidate === 'string' && candidate.trim().length > 0 ? candidate : null;
}

function getDcpSessionIdFromEvent(input: { event: unknown }): string | null {
  const event = input.event as {
    properties?: { sessionID?: unknown; sessionId?: unknown; part?: unknown };
    sessionID?: unknown;
    sessionId?: unknown;
    part?: unknown;
  } | null;

  return (
    getSessionIdFromValue(event?.properties) ??
    getSessionIdFromValue(event) ??
    getSessionIdFromValue(event?.part) ??
    null
  );
}

export const ContextyPlugin: Plugin = async (pluginInput: PluginInput) => {
  const { client, directory } = pluginInput;

  Logger.setClient(client);

  const defaultConfig: ContextyConfig = {
    aasm: {
      mode: 'passive',
    },
    tls: {
      enabled: true,
    },
  };

  let config = defaultConfig;
  const configPath = path.join(directory, 'contexty.config.json');

  try {
    try {
      await fs.access(configPath);
      const userConfig = JSON.parse(await fs.readFile(configPath, 'utf-8'));
      config = {
        ...defaultConfig,
        aasm: { ...defaultConfig.aasm, ...userConfig.aasm },
        hscmm: userConfig.hscmm,
        acpm: userConfig.acpm,
        tls: userConfig.tls,
        dcp: userConfig.dcp,
      };
    } catch {
      // Config file doesn't exist or is not accessible, ignore
    }
  } catch (error) {
    Logger.warn(
      `Failed to load config from ${configPath}: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }

  const aasm = new AASMModule(config, client, configPath);
  const tls = new TLSModule(pluginInput, config, configPath);
  const acpm = new ACPMModule(
    directory,
    (config as { acpm?: { defaultPreset?: string } }).acpm?.defaultPreset
  );
  const dcpConfig = config.dcp;
  const dcpEnabled = Boolean(dcpConfig?.enabled);
  const dcpStateCache = dcpEnabled ? new Map<string, SessionState>() : null;
  const dcpLogger = dcpEnabled && dcpConfig ? createDCPLogger(dcpConfig.debug) : null;

  async function getDcpState(sessionId: string): Promise<SessionState> {
    if (!dcpEnabled || !dcpStateCache || !dcpConfig) {
      return createEmptyDcpState(sessionId);
    }

    let state = dcpStateCache.get(sessionId);
    if (!state) {
      state = (await readPruningState(directory, sessionId)) ?? createEmptyDcpState(sessionId);
      dcpStateCache.set(sessionId, state);
    }

    state.sessionId = sessionId;
    // dcpLogger?.debug('getDcpState', {
    //   sessionId,
    //   cacheHit: dcpStateCache.has(sessionId),
    //   blocksInState: state.prune.messages.blocksById.size,
    // });
    return state;
  }

  async function persistDcpState(sessionId: string, state: SessionState): Promise<void> {
    if (!dcpEnabled || !dcpConfig) {
      return;
    }

    try {
      await writePruningState(directory, sessionId, state);
    } catch (error) {
      dcpLogger?.warn('Failed to persist DCP state', {
        sessionId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  function createCompressTool() {
    if (!dcpConfig) {
      return null;
    }

    const rangeArgs = {
      topic: tool.schema.string().describe('Short label (3-5 words) for display'),
      content: tool.schema
        .array(
          tool.schema.object({
            startId: tool.schema.string().describe('Message or block ID at beginning of range'),
            endId: tool.schema.string().describe('Message or block ID at end of range'),
            summary: tool.schema
              .string()
              .describe('Complete technical summary replacing content in range'),
          })
        )
        .describe('One or more ranges to compress'),
    };

    const messageArgs = {
      topic: tool.schema.string().describe('Short label (3-5 words) for display'),
      content: tool.schema
        .array(
          tool.schema.object({
            messageId: tool.schema.string().describe('Raw message ID of the form mNNNN'),
            topic: tool.schema.string().describe('Short topic for this message'),
            summary: tool.schema
              .string()
              .describe('Complete technical summary replacing message content'),
          })
        )
        .describe('One or more messages to compress'),
    };

    return tool({
      description: 'DCP compress conversation context into reusable blocks.',
      args: dcpConfig.compress.mode === 'message' ? messageArgs : rangeArgs,
      async execute(args, context) {
        const sessionId = sessionTracker.getSessionId() ?? getSessionIdFromValue(context);

        if (!sessionId) {
          throw new Error('DCP compress requires an active session.');
        }

        const state = await getDcpState(sessionId);
        const ctx = context as Record<string, unknown>;
        const toolContext: DCPToolContext = {
          sessionId,
          client,
          state,
          config: dcpConfig,
          logger: createDCPLogger(dcpConfig.debug),
          messages: Array.isArray(ctx.messages) ? (ctx.messages as WithParts[]) : undefined,
        };

        const callId =
          typeof ctx.callID === 'string'
            ? (ctx.callID as string)
            : typeof ctx.callId === 'string'
              ? (ctx.callId as string)
              : `dcp-${Date.now()}`;

        const result =
          dcpConfig.compress.mode === 'message'
            ? await compressMessage(toolContext, args as unknown as CompressMessageToolArgs, callId)
            : await compressRange(toolContext, args as unknown as CompressRangeToolArgs, callId);

        await persistDcpState(sessionId, state);
        return result;
      },
    });
  }

  const tlsCommandHook = createCommandHook(tls, pluginInput);
  const aasmReviewCommandHook = createAASMReviewCommandHook(aasm);
  const acpmSystemTransformHook = createACPMSystemTransformHook(acpm);
  const compressTool = dcpEnabled ? createCompressTool() : null;

  return {
    tool: {
      aasm: createAgentTool(aasm),
      acpm: createAcpmTool(acpm),
      ...(compressTool ? { compress: compressTool } : {}),
    },
    'chat.message': createAASMChatHook(aasm, client, directory),
    'command.execute.before': async (input, output) => {
      await tlsCommandHook?.(input, output);
      await aasmReviewCommandHook?.(input, output);

      if (!dcpEnabled || !dcpConfig) {
        return;
      }

      const commandName = input.command.replace(/^\//, '').trim().toLowerCase();
      if (commandName !== 'dcp') {
        return;
      }

      sessionTracker.setSessionId(input.sessionID);

      let messages: any[] = [];
      try {
        const messagesResponse = await client.session.messages({
          path: { id: input.sessionID },
        });
        messages = Array.isArray(messagesResponse) ? messagesResponse : messagesResponse.data || [];
      } catch {}

      const args = (input.arguments || '').trim().split(/\s+/).filter(Boolean);
      const subcommand = args[0]?.toLowerCase() || '';
      const subArgs = args.slice(1);

      const commandCtx = {
        client,
        state: await getDcpState(input.sessionID),
        config: dcpConfig,
        logger: dcpLogger ?? createDCPLogger(dcpConfig.debug),
        sessionId: input.sessionID,
        messages,
      };

      if (subcommand === 'context') {
        await handleContextCommand(commandCtx);
        throw new Error('__DCP_CONTEXT_HANDLED__');
      }

      if (subcommand === 'stats') {
        await handleStatsCommand(commandCtx);
        throw new Error('__DCP_STATS_HANDLED__');
      }

      if (subcommand === 'sweep') {
        await handleSweepCommand({ ...commandCtx, args: subArgs, workingDirectory: directory });
        throw new Error('__DCP_SWEEP_HANDLED__');
      }

      if (subcommand === 'manual') {
        await handleManualToggleCommand(commandCtx, subArgs[0]?.toLowerCase());
        throw new Error('__DCP_MANUAL_HANDLED__');
      }

      if (subcommand === 'compress') {
        const userFocus = subArgs.join(' ').trim();
        const prompt = await handleCompressCommand(commandCtx, userFocus);
        if (!prompt) {
          throw new Error('__DCP_MANUAL_TRIGGER_BLOCKED__');
        }
        const rawArgs = (input.arguments || '').trim();
        output.parts.length = 0;
        output.parts.push({
          type: 'text',
          text: rawArgs ? `/dcp ${rawArgs}` : `/dcp ${subcommand}`,
          synthetic: true,
          sessionID: input.sessionID,
          messageID: 'dcp-message',
          id: 'dcp-part',
        });
        await persistDcpState(input.sessionID, commandCtx.state);
        return;
      }

      if (subcommand === 'decompress') {
        await handleDecompressCommand({ ...commandCtx, args: subArgs });
        await persistDcpState(input.sessionID, commandCtx.state);
        throw new Error('__DCP_DECOMPRESS_HANDLED__');
      }

      if (subcommand === 'recompress') {
        await handleRecompressCommand({ ...commandCtx, args: subArgs });
        await persistDcpState(input.sessionID, commandCtx.state);
        throw new Error('__DCP_RECOMPRESS_HANDLED__');
      }

      await handleHelpCommand(commandCtx);
      throw new Error('__DCP_HELP_HANDLED__');
    },
    'experimental.chat.messages.transform': createHSCMMTransformHook(
      directory,
      acpm,
      undefined,
      dcpEnabled ? { get: getDcpState, persist: persistDcpState } : undefined
    ),
    ...(dcpEnabled
      ? {
          'chat.text.complete': async (_input: any, output: { text: string }) => {
            output.text = stripHallucinationsFromString(output.text);
          },
        }
      : {}),
    'tool.execute.before': createToolExecuteBeforeHook(acpm, client),
    'tool.execute.after': createToolExecuteAfterHook(acpm),
    'permission.ask': createPermissionAskHook(acpm),
    'experimental.chat.system.transform': async (input: any, output) => {
      await acpmSystemTransformHook(input, output);

      if (!dcpEnabled || !dcpConfig) {
        return;
      }

      const prompt = renderSystemPrompt(dcpConfig);
      if (prompt.length > 0) {
        output.system.push(prompt);
      }
    },
    ...(dcpEnabled && dcpConfig
      ? {
          config: async (opencodeConfig: any) => {
            if (
              dcpConfig.compress.permission !== 'deny' &&
              opencodeConfig.permission?.compress === false
            ) {
              dcpLogger?.info('Compress permission is disabled by Opencode config.');
            }

            if (dcpConfig.commands.enabled && dcpConfig.compress.permission !== 'deny') {
              opencodeConfig.command ??= {};
              opencodeConfig.command['dcp'] = {
                template: '',
                description: 'Show available DCP commands',
              };
            }

            if (dcpConfig.compress.permission !== 'deny') {
              const existing = opencodeConfig.experimental?.primary_tools ?? [];
              opencodeConfig.experimental = {
                ...opencodeConfig.experimental,
                primary_tools: [...existing, 'compress'],
              };
            }
          },
        }
      : {}),
    ...(dcpEnabled && dcpConfig
      ? {
          event: async (input: { event: unknown }) => {
            const sessionId = getDcpSessionIdFromEvent(input);
            if (!sessionId) {
              return;
            }

            const state = await getDcpState(sessionId);
            handleCompressionEvent(state, input.event as never);
            await persistDcpState(sessionId, state);
          },
        }
      : {}),
  };
};

export default ContextyPlugin;
