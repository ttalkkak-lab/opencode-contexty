import { tool } from '@opencode-ai/plugin';
import type { AASMModule } from '../aasm';

export function createAgentTool(aasm: AASMModule) {
  return tool({
    description:
      'AASM - Architecture supervision mode control. Use this to enable/disable/check architecture linting.',
    args: {
      mode: tool.schema.enum(['active', 'passive', 'status']),
    },
    async execute(args) {
      try {
        const result = await aasm.handleCommand(args.mode);
        return JSON.stringify({ success: true, message: result });
      } catch (error) {
        return JSON.stringify({
          success: false,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    },
  });
}
