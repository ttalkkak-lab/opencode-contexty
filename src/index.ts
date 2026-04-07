import type { Plugin, PluginInput } from '@opencode-ai/plugin';
import * as path from 'path';
import * as fs from 'fs/promises';
import { Logger } from './utils';
import { AASMModule } from './aasm';
import { createAASMChatHook, createHSCMMTransformHook, createCommandHook } from './hooks';
import { createAgentTool } from './tools';
import { ContextyConfig } from './types';
import { TLSModule } from './tls';

export const ContextyPlugin: Plugin = async (pluginInput: PluginInput) => {
  const {client, directory} = pluginInput;

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
        hscmm: userConfig.hscmm,
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

  return {
    tool: {
      aasm: createAgentTool(aasm),
    },
    'chat.message': createAASMChatHook(aasm, client),
    'command.execute.before': createCommandHook(tls, pluginInput),
    'experimental.chat.messages.transform': createHSCMMTransformHook(directory),
  };
};

export default ContextyPlugin;
