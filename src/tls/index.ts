import type { PluginInput } from '@opencode-ai/plugin';
import type { ContextyConfig, SubsessionConfig } from '../types';
import { SubsessionHelper } from '../aasm/subsessionHelper';
import { TlsResult, BunShellOutput } from './types';
import { Shell } from './shell';
import { TuiController } from './tuiController';
import { getSummarizationPrompt } from './prompts';

export class TLSModule {
  private tui: TuiController;
  private shell: Shell;
  private internalModel: SubsessionHelper;
  private config: ContextyConfig['tls'];

  constructor(pluginInput: PluginInput, config?: ContextyConfig, configPath?: string) {
    const { client, $ } = pluginInput;
    this.config = {enabled: true};
    if (config) this.config = config.tls;
    void configPath;

    const subsessionConfig: SubsessionConfig = {
      timeout: 30 * 1000,
      pollInterval: 500,
      stabilityRequired: 3
    };

    if (this.config?.model) subsessionConfig.model = this.config.model;
    this.tui = new TuiController(client);
    this.shell = new Shell($);
    this.internalModel = new SubsessionHelper(client, subsessionConfig);
  }

  async executeTLS(command: string, sessionID: string): Promise<TlsResult> {
    const output: BunShellOutput = await this.shell.execute(command);
    const prompt = getSummarizationPrompt(command, output);
    let summary: string;

    this.tui.showSummarizingTui(command);

    try {
      summary = await this.internalModel.callLLM(prompt, sessionID);
    } catch(e) {
      this.tui.showFail();

      return {
        success: false,
        command: command,
        output: output.text(),
        summary: "Fail to Summay"
      };
    }

    this.tui.clear();
    this.tui.showSuccess();

    return {
      success: true,
      command: command,
      output: output.text(),
      summary: summary
    };
  }

}

export * from './types';
export * from './prompts';
