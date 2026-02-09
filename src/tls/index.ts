import type { PluginInput } from '@opencode-ai/plugin';
import type { ContextyConfig, SubsessionConfig } from '../types';
import { TLSResult } from './types';
import { Shell } from './Shell';
import { SubsessionHelper } from '../aasm/SubsessionHelper';
import { ShellRunningError, SummarizationFailError } from './errors';

export class TLSModule {
  private client: PluginInput['client'];
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
    this.client = client;
    this.shell = new Shell($);
    this.internalModel = new SubsessionHelper(client, subsessionConfig);
  }

  async executeTLS(command: string, sessionID: string): Promise<TLSResult> {
    let output: string = "";
    let summary: string = "";
    try {
      output = await this.shell.execute(command);

      const progressIcons = ['   ', '.  ', '.. ', '...', '...', '.. ', '.  ', '   '];
      let index = 0;

      const summarizationInterval = setInterval(()=>{
        this.client.tui.showToast({
          body: {
            title: 'TLS Info',
            message: `✅ Success to run '${command.substring(0, 16)}'.\nSummarizing${progressIcons[index]}`,
            variant: 'info',
            duration: 500
          }
        });
        index = (index + 1) % progressIcons.length;
      }, 175);

      const prompt = this.createSummaryPrompt(command, output);
      summary = await this.internalModel.callLLM(prompt, sessionID);
      clearInterval(summarizationInterval);

      if (summary === '') throw new SummarizationFailError('Fail to call LLM.');

      await this.client.tui.showToast({
        body: {
          title: 'TLS Info',
          message: `✅ Success to summarize.`,
          variant: 'success',
          duration: 5000
        }
      });

      return {
        command: command,
        output: output,
        summary: summary
      }
    } catch(e) {
      if (e instanceof ShellRunningError) {
        return {
          command: command,
          output: output,
          summary: `Fail to run command ${command}.`
        }
      } else if (e instanceof SummarizationFailError) {
        return {
          command: command,
          output: output,
          summary: "Fail to summarize result."
        }
      }
      else throw e;
    }

  }

  createTemplate(result: TLSResult): string {
    return (
`Repeat content located after <tls-output-start> and before <tls-output-end>. Do not modify or add any characters.
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