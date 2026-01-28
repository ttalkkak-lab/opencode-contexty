import type { Plugin } from '@opencode-ai/plugin';
import * as path from 'path';
import * as fs from 'fs/promises';
import { Logger } from './utils/index';
import { AASMModule } from './aasm';
import {
  createAASMChatHook,
  createHSCMMTransformHook,
  createTLSEventHook,
  createTLSChatHook,
} from './hooks';
import { TLSModule } from './tls';
import { createTLSTool } from './tools';
import { ContextyConfig } from './types';

export const ContextyPlugin: Plugin = async ({ client, directory }) => {
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
        hscmm: userConfig.hscmm,
        tls: userConfig.tls,
      };
    } catch {
      // Config file doesn't exist or is not accessible
    }
  } catch (error) {
    Logger.warn(
      `Failed to load config from ${configPath}: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }

  const aasm = new AASMModule(config, client);
  const tlsModule = new TLSModule(client, config.tls);

  console.log('[Contexty Plugin] Loading plugin...');
  console.log('[Contexty Plugin] Creating tools: agent, tls');

  const aasmChatHook = createAASMChatHook(aasm, client);
  const tlsChatHook = createTLSChatHook(tlsModule, client);

  const combinedChatHook = async (
    input: Parameters<typeof aasmChatHook>[0],
    output: Parameters<typeof aasmChatHook>[1]
  ) => {
    await tlsChatHook(input, output);
    await aasmChatHook(input, output);
  };

  return {
    tool: {
      tls: createTLSTool(tlsModule, client),
    },
    'chat.message': combinedChatHook,
    'experimental.chat.messages.transform': createHSCMMTransformHook(directory),
    event: createTLSEventHook(tlsModule),
  };
};

console.log('[Contexty Plugin] Plugin exported successfully');

export default ContextyPlugin;
