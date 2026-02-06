import type { PluginInput } from '@opencode-ai/plugin';
import type { ContextyConfig, SubsessionConfig } from '../types';
import { TLSResult } from './types';
import { Shell } from './Shell';
import { SubsessionHelper } from '../aasm/SubsessionHelper';

export class TLSModule {
  private shell: Shell;
  private internalModel: SubsessionHelper;
  private config: ContextyConfig['tls'];
  private configPath: string | null = null;

  constructor(pluginInput: PluginInput, config?: ContextyConfig, configPath?: string) {
    const { client, $ } = pluginInput;
    this.config = {enabled: true};
    if (config) this.config = config.tls;
    if (configPath) this.configPath = configPath;

    const subsessionConfig: SubsessionConfig = {
      timeout: 30 * 1000,
      pollInterval: 500,
      stabilityRequired: 3
    };

    if (this.config?.model) subsessionConfig.model = this.config.model;

    this.shell = new Shell($);
    this.internalModel = new SubsessionHelper(client, subsessionConfig);
  }

  async executeTLS(command: string, sessionID: string): Promise<TLSResult> {
    const output = await this.shell.execute(command);
    const prompt = this.createSummaryPrompt(command, output);
    const summary = await this.internalModel.callLLM(prompt, sessionID);
    return {
      command: command,
      output: output,
      summary: summary
    }
  }

  createTemplate(result: TLSResult): string {
    return (
`Provide the verbatim content located after <tls-output-start> and before <tls-output-end>. Do not modify any characters.
<tls-output-start>
----------------------------------------------------
${result.command}
----------------------------------------------------
${result.output}
----------------------------------------------------
summary:
 ${result.summary}
<tls-output-end>`
    )
  }

  private createSummaryPrompt(command: string, output: string): string {
    return (
`Act as a system administrator. I will provide you with a terminal command and its output. Please summarize the results concisely, focusing on the core outcome. Categorize your summary into three specific statuses: Success, Warning, and Error. If a category is not applicable, you may omit it.
command: ${command}
output: ${output}`
    )
  }

}