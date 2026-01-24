import type { OpencodeClient } from '@opencode-ai/sdk';
import {
  IntentAnalysis,
  LintResult,
  LintIssue,
  ContextyConfig,
  AgentMode,
  SubsessionConfig,
} from '../types';
import { Logger } from '../utils';
import { SubsessionHelper } from './SubsessionHelper';
import { LLMLinter } from './LLMLinter';

export class IntentAnalyzer {
  analyzeIntent(userPrompt: string): IntentAnalysis {
    const promptLower = userPrompt.toLowerCase();

    let intentType: IntentAnalysis['intentType'] = 'other';
    if (this.isRefactor(promptLower)) intentType = 'refactor';
    else if (this.isFeature(promptLower)) intentType = 'feature';
    else if (this.isBugfix(promptLower)) intentType = 'bugfix';
    else if (this.isTest(promptLower)) intentType = 'test';
    else if (this.isDocs(promptLower)) intentType = 'docs';

    const targets = this.extractTargets(userPrompt);
    const architecturalImpact = this.estimateImpact(promptLower, intentType);

    return {
      intentType,
      targets,
      confidence: 0.8,
      architecturalImpact,
    };
  }

  private isRefactor(prompt: string): boolean {
    const keywords = ['refactor', 'restructure', 'reorganize', 'clean up', 'improve structure'];
    return keywords.some((kw) => prompt.includes(kw));
  }

  private isFeature(prompt: string): boolean {
    const keywords = ['add', 'create', 'implement', 'new feature', 'build'];
    return keywords.some((kw) => prompt.includes(kw));
  }

  private isBugfix(prompt: string): boolean {
    const keywords = ['fix', 'bug', 'error', 'issue', 'problem', 'not working'];
    return keywords.some((kw) => prompt.includes(kw));
  }

  private isTest(prompt: string): boolean {
    const keywords = ['test', 'spec', 'unit test', 'integration test'];
    return keywords.some((kw) => prompt.includes(kw));
  }

  private isDocs(prompt: string): boolean {
    const keywords = ['document', 'readme', 'comment', 'docs', 'documentation'];
    return keywords.some((kw) => prompt.includes(kw));
  }

  private extractTargets(prompt: string): string[] {
    const filePatterns = /[\w/-]+\.(ts|js|py|java|go|rs|cpp|c|h)\b/g;
    const matches = prompt.match(filePatterns);
    return matches ? Array.from(new Set(matches)) : [];
  }

  private estimateImpact(
    prompt: string,
    intentType: IntentAnalysis['intentType']
  ): 'low' | 'medium' | 'high' {
    if (intentType === 'refactor') return 'high';
    if (intentType === 'feature') return 'medium';
    if (intentType === 'bugfix') return 'low';

    const impactKeywords = {
      high: ['architecture', 'database', 'api', 'migration', 'breaking'],
      medium: ['module', 'service', 'component'],
    };

    if (impactKeywords.high.some((kw) => prompt.includes(kw))) return 'high';
    if (impactKeywords.medium.some((kw) => prompt.includes(kw))) return 'medium';
    return 'low';
  }
}

export class AASMModule {
  private analyzer: IntentAnalyzer;
  private llmLinter: LLMLinter | null = null;
  private mode: AgentMode;
  private config: ContextyConfig['aasm'];
  private client: OpencodeClient | null = null;

  constructor(config: ContextyConfig, client?: OpencodeClient) {
    this.config = config.aasm;
    this.mode = config.aasm.mode;
    this.analyzer = new IntentAnalyzer();

    if (client) {
      this.setClient(client);
    }
  }

  /**
   * Set the OpenCode client for LLM-based linting.
   * Must be called before using llmLint: 'always' mode.
   */
  setClient(client: OpencodeClient): void {
    this.client = client;

    const subsessionConfig: Partial<SubsessionConfig> = {};
    if (this.config.model) {
      subsessionConfig.model = this.config.model;
    }

    const subsessionHelper = new SubsessionHelper(client, subsessionConfig);
    this.llmLinter = new LLMLinter(subsessionHelper);
  }

  async validateIntent(
    userPrompt: string,
    sessionID?: string
  ): Promise<{
    approved: boolean;
    intent: IntentAnalysis;
    lintResult: LintResult;
    llmUsed?: boolean;
    llmError?: string;
  }> {
    if (this.mode === 'passive') {
      return {
        approved: true,
        intent: this.analyzer.analyzeIntent(userPrompt),
        lintResult: {
          valid: true,
          severity: 'advisory',
          issues: [],
          suggestions: [],
          confidence: 1.0,
        },
      };
    }

    const intent = this.analyzer.analyzeIntent(userPrompt);

    if (!this.config.enableLinting) {
      return {
        approved: true,
        intent,
        lintResult: {
          valid: true,
          severity: 'advisory',
          issues: [],
          suggestions: [],
          confidence: 1.0,
        },
      };
    }

    if (this.llmLinter && this.client && sessionID) {
      try {
        const lintResult = await this.llmLinter.lint(userPrompt, sessionID, intent);
        return { approved: true, intent, lintResult, llmUsed: true };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        Logger.warn(`LLM linting failed: ${errorMessage}`);
        return {
          approved: true,
          intent,
          lintResult: {
            valid: true,
            severity: 'advisory',
            issues: [],
            suggestions: [],
            confidence: 1.0,
          },
          llmUsed: false,
          llmError: errorMessage,
        };
      }
    }

    return {
      approved: true,
      intent,
      lintResult: {
        valid: true,
        severity: 'advisory',
        issues: [],
        suggestions: [],
        confidence: 1.0,
      },
    };
  }

  setMode(mode: AgentMode): void {
    this.mode = mode;
    Logger.info(`AASM mode set to: ${mode}`);
  }

  getMode(): AgentMode {
    return this.mode;
  }

  async handleCommand(command: string): Promise<string> {
    switch (command) {
      case 'active':
        this.setMode('active');
        return '✅ AASM mode set to: ACTIVE (Architecture linting enabled)';

      case 'passive':
        this.setMode('passive');
        return '✅ AASM mode set to: PASSIVE (No architecture linting)';

      case 'status':
        return `
AASM Status:
- Mode: ${this.mode.toUpperCase()}
- Linting Enabled: ${this.config.enableLinting ? 'Yes' : 'No'}
- Confidence Threshold: ${this.config.confidenceThreshold}
`;

      default:
        return `❌ Unknown agent command: ${command}\n\nUsage: /agent <active|passive|status>`;
    }
  }
}
