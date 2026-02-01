import { PluginInput, Hooks } from '@opencode-ai/plugin';
import { TLSModule } from '../tls';

export function createTLSCommandHook(tls: TLSModule, pluginInput: PluginInput): Hooks['command.execute.before'] {
  return async (input, output) => {
    if (input.command === 'tls') {
      const tlsResult = await tls.executeTLS(input.arguments, input.sessionID);
    }
  }
}