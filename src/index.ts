import { tool, type Plugin, type PluginInput } from '@opencode-ai/plugin';
import * as path from 'path';
import * as fs from 'fs/promises';
import { Logger } from './utils';
import { AASMModule } from './aasm';
import { ACPMModule } from './acpm';
import {
  createAASMChatHook,
  createHSCMMTransformHook,
  createPermissionAskHook,
  createSystemTransformHook as createACPMSystemTransformHook,
  createTLSCommandHook,
  createToolExecuteBeforeHook,
  createToolExecuteAfterHook,
} from './hooks';
import { createAgentTool, createAcpmTool } from './tools';
import { ContextyConfig } from './types';
import { TLSModule } from './tls';
import { createLogger as createDCPLogger } from './dcp/logger';
import { compressMessage } from './dcp/compress/message';
import { compressRange } from './dcp/compress/range';
import { handleDcpCommand } from './dcp/commands';
import { handleCompressionEvent } from './dcp/event-handler';
import { renderSystemPrompt } from './dcp/prompts';
import type { DCPConfig, SessionState } from './dcp/types';
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

  const candidate = (value as { sessionID?: unknown; sessionId?: unknown }).sessionID
    ?? (value as { sessionID?: unknown; sessionId?: unknown }).sessionId;

  return typeof candidate === 'string' && candidate.trim().length > 0 ? candidate : null;
}

function getDcpSessionIdFromCommand(input: { sessionID: string; arguments: string }): string {
  return input.sessionID;
}

function getDcpSessionIdFromEvent(input: { event: unknown }): string | null {
  const event = input.event as {
    properties?: { sessionID?: unknown; sessionId?: unknown; part?: unknown };
    sessionID?: unknown;
    sessionId?: unknown;
    part?: unknown;
  } | null;

  return (
    getSessionIdFromValue(event?.properties)
    ?? getSessionIdFromValue(event)
    ?? getSessionIdFromValue(event?.part)
    ?? null
  );
}

export const ContextyPlugin: Plugin = async (pluginInput: PluginInput) => {
  const {client, directory} = pluginInput;

  // Initialize Logger for server-side logging
  Logger.setClient(client);

  const defaultConfig: ContextyConfig = {
    aasm: {
      enabled: true,
      mode: 'active',
      enableLinting: true,
      confidenceThreshold: 0.7,
    },
    tls: {
      enabled: true
    }
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
        // Preserve other optional configs if present
        hscmm: userConfig.hscmm,
        acpm: userConfig.acpm,
        tls: userConfig.tls,
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
  const acpm = new ACPMModule(directory, (config as { acpm?: { defaultPreset?: string } }).acpm?.defaultPreset);
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

    const rangeArgs = tool.schema.object({
      topic: tool.schema.string(),
      content: tool.schema.array(
        tool.schema.object({
          startId: tool.schema.string(),
          endId: tool.schema.string(),
          summary: tool.schema.string(),
        })
      ),
    });

    const messageArgs = tool.schema.object({
      topic: tool.schema.string(),
      content: tool.schema.array(
        tool.schema.object({
          messageId: tool.schema.string(),
          topic: tool.schema.string(),
          summary: tool.schema.string(),
        })
      ),
    });

    return tool({
      description: 'DCP compress conversation context into reusable blocks.',
      args: dcpConfig.compress.mode === 'message' ? messageArgs : rangeArgs,
      async execute(args, context) {
        const sessionId =
          getSessionIdFromValue(context)
          ?? getDcpSessionIdFromCommand({ sessionID: sessionTracker.getSessionId() ?? '', arguments: '' })
          ?? sessionTracker.getSessionId();

        if (!sessionId) {
          throw new Error('DCP compress requires an active session.');
        }

        const state = await getDcpState(sessionId);
        const toolContext = {
          sessionId,
          client,
          state,
          config: dcpConfig,
          logger: createDCPLogger(dcpConfig.debug),
          messages: Array.isArray((context as { messages?: unknown }).messages)
            ? (context as { messages: unknown[] }).messages as never
            : undefined,
        };

        const callId =
          typeof (context as { callID?: unknown; callId?: unknown }).callID === 'string'
            ? (context as { callID?: string }).callID!
            : typeof (context as { callID?: unknown; callId?: unknown }).callId === 'string'
              ? (context as { callId?: string }).callId!
              : `dcp-${Date.now()}`;

        const result = dcpConfig.compress.mode === 'message'
          ? await compressMessage(toolContext, args as Parameters<typeof compressMessage>[1], callId)
          : await compressRange(toolContext, args as Parameters<typeof compressRange>[1], callId);

        await persistDcpState(sessionId, state);
        return result;
      },
    });
  }

  const tlsCommandHook = createTLSCommandHook(tls, pluginInput);
  const acpmSystemTransformHook = createACPMSystemTransformHook(acpm);

  return {
    tool: {
      aasm: createAgentTool(aasm),
      acpm: createAcpmTool(acpm),
      ...(compressTool ? { compress: compressTool } : {}),
    },
    'chat.message': createAASMChatHook(aasm, client, directory),
    'command.execute.before': async (input, output) => {
      await tlsCommandHook(input, output);

      if (!dcpEnabled || !dcpConfig) {
        return;
      }

      const commandName = input.command.replace(/^\//, '').trim().toLowerCase();
      if (commandName !== 'dcp') {
        return;
      }

      sessionTracker.setSessionId(input.sessionID);

      const sessionId = getDcpSessionIdFromCommand(input);
      const state = await getDcpState(sessionId);
      const rawArgs = typeof input.arguments === 'string' ? input.arguments.trim() : '';
      const args = rawArgs.length > 0 ? rawArgs.split(/\s+/).filter(Boolean) : [];
      const message = handleDcpCommand(args, state, dcpConfig, dcpLogger ?? createDCPLogger(dcpConfig.debug));

      await persistDcpState(sessionId, state);

      output.parts.length = 0;
      output.parts.push({
        type: 'text',
        text: message,
        synthetic: true,
        sessionID: input.sessionID,
        messageID: 'dcp-message',
        id: 'dcp-part',
      });
    },
    'experimental.chat.messages.transform': createHSCMMTransformHook(directory, acpm),
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
