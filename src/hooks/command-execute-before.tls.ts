import { PluginInput, Hooks } from '@opencode-ai/plugin';
import { TLSModule } from '../tls';

export function createTLSCommandHook(tls: TLSModule, pluginInput: PluginInput): Hooks['command.execute.before'] {
  return async (input, output) => {
    if (input.command === 'tls') {
      const tlsResult = await tls.executeTLS(input.arguments, input.sessionID);
      const template = tls.createTemplate(tlsResult);
      
      output.parts.length = 0;
      output.parts.push({
        type: 'text',
        text: template,
        synthetic: true,
        sessionID: input.sessionID,
        messageID: 'tls-message',
        id: 'tls-part',
      });
    }
  }
}