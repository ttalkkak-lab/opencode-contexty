import type { PluginInput } from '@opencode-ai/plugin';
import { ShellRunningError } from './errors';

export class Shell {
  private cwd: string;
  private $: PluginInput['$'];
  
  constructor($: PluginInput['$'], cwd?: string) {
    this.$ = $;
    this.cwd = process.cwd();
    
    if (cwd) this.cwd = cwd;
  }

  async execute(command: string): Promise<string> {
    const splited_command = command.split(" ");
    return await this.$`${splited_command}`
      .cwd(this.cwd)
      .text()
      .catch(()=>{throw new ShellRunningError("Fail to run commad.")});
  }
  
  setCwd(newCwd: string) {
    this.cwd = newCwd;
  }
}