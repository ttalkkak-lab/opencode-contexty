import { PluginInput, Hooks } from '@opencode-ai/plugin';
import { TLSModule, getOutputPrompt } from '../tls';
import { appendToolLogEntry, readToolLog, readToolLogBlacklist, ToolPart } from '../hscmm';
import { generateCustomId } from '../utils';
import { sessionTracker } from '../core/sessionTracker';

function formatTokenCount(tokens: number): string {
  if (tokens >= 1000) {
    return `${(tokens / 1000).toFixed(1)}k`;
  }
  return `${tokens}`;
}

export function createCommandHook(
  tls: TLSModule,
  pluginInput: PluginInput
): Hooks['command.execute.before'] {
  return async (input, output) => {
    sessionTracker.setSessionId(input.sessionID);
    if (input.command === 'tls') {
      const tlsResult = await tls.executeTLS(input.arguments, input.sessionID);
      const template = tlsResult.success
        ? getOutputPrompt(tlsResult)
        : 'Just Stop. Do not anything.';

      const timestamp = Date.now();
      const toolPart: ToolPart = {
        id: generateCustomId('tls'),
        sessionID: input.sessionID,
        messageID: generateCustomId('msg'),
        type: 'tool',
        callID: generateCustomId('call'),
        tool: 'bash',
        state: {
          title: 'TLS summary context',
          status: 'completed',
          input: {
            command: input.arguments,
          },
          output: `output: ${tlsResult.output}\nsummary: ${tlsResult.summary}`,
          metadata: {
            output: `output: ${tlsResult.output}\summary: ${tlsResult.summary}`,
            truncated: false,
          },
          time: {
            start: timestamp,
            end: timestamp,
          },
        },
      };

      appendToolLogEntry(pluginInput.directory, input.sessionID, toolPart);

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

    if (input.command === 'ctx') {
      const directory = pluginInput.directory;
      const [blacklistSpec, logSpec] = await Promise.all([
        readToolLogBlacklist(directory, input.sessionID),
        readToolLog(directory, input.sessionID),
      ]);
      const bannedIds = new Set(blacklistSpec.ids);
      const activeParts = logSpec.parts.filter((p) => !bannedIds.has(p.id));

      let text: string;
      if (activeParts.length === 0) {
        text = 'No context files loaded.';
      } else {
        const fileMap = new Map<string, { tokens: number; partCount: number }>();
        let totalTokens = 0;

        for (const part of activeParts) {
          const filePath = (part.state as ToolPart['state']).input?.filePath;
          if (typeof filePath !== 'string') continue;
          const outputStr =
            typeof (part.state as ToolPart['state']).output === 'string'
              ? (part.state as ToolPart['state']).output
              : '';
          const tokens = Math.ceil(outputStr.length / 4);
          totalTokens += tokens;

          const existing = fileMap.get(filePath);
          if (existing) {
            existing.tokens += tokens;
            existing.partCount += 1;
          } else {
            fileMap.set(filePath, { tokens, partCount: 1 });
          }
        }

        const entries = [...fileMap.entries()]
          .map(([filePath, stats]) => ({
            filePath,
            tokens: stats.tokens,
            percentage: totalTokens > 0 ? (stats.tokens / totalTokens) * 100 : 0,
          }))
          .sort((a, b) => b.tokens - a.tokens);

        const lines: string[] = [];
        lines.push(
          `Total: ~${formatTokenCount(totalTokens)} tokens (${entries.length} files, ${activeParts.length} parts)`
        );
        lines.push('');
        for (const entry of entries) {
          const name =
            entry.filePath.length > 50 ? '…' + entry.filePath.slice(-49) : entry.filePath;
          lines.push(
            `${name}  ${entry.percentage.toFixed(1)}%  ~${formatTokenCount(entry.tokens)}`
          );
        }
        text = lines.join('\n');
      }

      output.parts.length = 0;

      await pluginInput.client.session.prompt({
        path: { id: input.sessionID },
        body: {
          noReply: true,
          parts: [
            {
              type: 'text',
              text,
              ignored: true,
            },
          ],
        },
      });

      throw new Error('__CTX_HANDLED__');
    }
  };
}
