import type { Plugin } from '@opencode-ai/plugin';
import * as path from 'path';
import * as fs from 'fs';
import { Logger } from './utils';
import { AASMModule } from './aasm';
import { createAASMChatHook, createHSCMMTransformHook } from './hooks';
import { createAgentTool } from './tools';
import { ContextyConfig } from './types';

export const ContextyPlugin: Plugin = async ({ client, directory }) => {
  // Initialize Logger for server-side logging
  Logger.setClient(client);

  const defaultConfig: ContextyConfig = {
    aasm: {
      mode: 'active',
      enableLinting: true,
      confidenceThreshold: 0.7,
      llmLint: 'never',
    },
  };

  let config = defaultConfig;
  const configPath = path.join(directory, 'contexty.config.json');

  try {
    if (fs.existsSync(configPath)) {
      const userConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      config = {
        ...defaultConfig,
        aasm: { ...defaultConfig.aasm, ...userConfig.aasm },
        // Preserve other optional configs if present
        hscmm: userConfig.hscmm,
        tls: userConfig.tls,
      };
    }
  } catch (error) {
    Logger.warn(`Failed to load config from ${configPath}, using defaults.`);
  }

  const aasm = new AASMModule(config, client);

  return {
    tool: {
      agent: createAgentTool(aasm),
    },
    'chat.message': createAASMChatHook(aasm, client),
    'experimental.chat.messages.transform': createHSCMMTransformHook(directory),
  };
};

export default ContextyPlugin;
