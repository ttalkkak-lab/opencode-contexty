import type { Plugin } from '@opencode-ai/plugin';
import * as path from 'path';
import * as fs from 'fs/promises';
import { Logger } from './utils';
import { AASMModule } from './aasm';
import { createAASMChatHook, createHSCMMTransformHook, createTLSHook } from './hooks';
import { createAgentTool } from './tools';
import { ContextyConfig } from './types';

export const ContextyPlugin: Plugin = async ({ client, directory }) => {
  // Initialize Logger for server-side logging
  Logger.setClient(client);

  const defaultConfig: ContextyConfig = {
    aasm: {
      enabled: true,
      mode: 'active',
      enableLinting: true,
      confidenceThreshold: 0.7,
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
        // Preserve other optional configs if present
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

  const aasm = new AASMModule(config, client);

  return {
    tool: {
      agent: createAgentTool(aasm),
    },
    'chat.message': createAASMChatHook(aasm, client),
    'experimental.chat.messages.transform': createHSCMMTransformHook(directory),
    event: createTLSHook(client)
  };
};

export default ContextyPlugin;
