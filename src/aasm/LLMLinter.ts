import type { LintResult, IntentAnalysis } from '../types';
import { Logger } from '../utils';
import { buildLintPrompt, parseLintResponse } from './prompts';

interface LinterDependencies {
  callLLM: (prompt: string, sessionID: string) => Promise<string>;
}

export class LLMLinter {
  constructor(private subsessionHelper: LinterDependencies) {}

  async lint(userPrompt: string, sessionID: string, intent?: IntentAnalysis): Promise<LintResult> {
    try {
      const prompt = buildLintPrompt(userPrompt);
      const response = await this.subsessionHelper.callLLM(prompt, sessionID);

      Logger.debug('LLM Lint raw response', { response });

      const result = parseLintResponse(response);
      if (result) {
        Logger.debug('LLM Lint result parsed successfully', { result });
        return result;
      }

      throw new Error('Failed to parse LLM lint response');
    } catch (error) {
      Logger.error('LLM Lint failed', { error });
      throw error;
    }
  }
}
