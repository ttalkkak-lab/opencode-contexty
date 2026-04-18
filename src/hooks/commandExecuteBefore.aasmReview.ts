import { Hooks } from '@opencode-ai/plugin';
import type { AASMModule } from '../aasm';
import { sessionTracker } from '../core/sessionTracker';

function parseLimit(rawArgs: string): number {
  if (!rawArgs) {
    return 20;
  }

  const numericMatch = rawArgs.match(/\d+/);
  if (!numericMatch) {
    return 20;
  }

  const parsed = Number.parseInt(numericMatch[0], 10);
  if (!Number.isFinite(parsed)) {
    return 20;
  }

  return Math.max(5, Math.min(100, parsed));
}

export function createAASMReviewCommandHook(aasm: AASMModule): Hooks['command.execute.before'] {
  return async (input, output) => {
    sessionTracker.setSessionId(input.sessionID);

    const rawCommand = typeof input.command === 'string' ? input.command.trim() : '';
    const commandTokens = rawCommand.replace(/^\//, '').split(/\s+/).filter(Boolean);
    const commandName = (commandTokens.shift() || '').toLowerCase();
    const inlineArgs = commandTokens.join(' ');
    const explicitArgs = typeof input.arguments === 'string' ? input.arguments.trim() : '';
    const argsRaw = [inlineArgs, explicitArgs].filter(Boolean).join(' ').trim();

    if (!commandName) {
      return;
    }

    const isAasmHubCommand = commandName === 'aasm';
    const isReviewCommand = commandName === 'aasm-review';

    if (!isAasmHubCommand && !isReviewCommand) {
      return;
    }

    try {
      let text = '';

      if (isReviewCommand) {
        const limit = parseLimit(argsRaw);
        text = await aasm.generateAntiPatternReport(input.sessionID, limit);
      } else {
        const [subcommandRaw, ...restArgs] = argsRaw.split(/\s+/).filter(Boolean);
        const subcommand = (subcommandRaw || 'status').toLowerCase();

        if (subcommand === 'review') {
          const limit = parseLimit(restArgs.join(' '));
          text = await aasm.generateAntiPatternReport(input.sessionID, limit);
        } else if (subcommand === 'active' || subcommand === 'passive' || subcommand === 'status') {
          text = await aasm.handleCommand(subcommand);
        } else {
          text = [
            'Unknown /aasm subcommand.',
            '',
            'Usage:',
            '- /aasm status',
            '- /aasm active',
            '- /aasm passive',
            '- /aasm review [limit]',
            '- /aasm-review [limit]',
          ].join('\n');
        }
      }

      output.parts.length = 0;
      output.parts.push({
        type: 'text',
        text,
        synthetic: true,
        sessionID: input.sessionID,
        messageID: 'aasm-command-message',
        id: 'aasm-command-part',
      });
    } catch (error) {
      output.parts.length = 0;
      output.parts.push({
        type: 'text',
        text: `AASM command failed: ${error instanceof Error ? error.message : String(error)}`,
        synthetic: true,
        sessionID: input.sessionID,
        messageID: 'aasm-command-message',
        id: 'aasm-command-part',
      });
    }
  };
}
