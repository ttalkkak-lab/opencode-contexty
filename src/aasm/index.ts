import type { OpencodeClient } from '@opencode-ai/sdk';
import {
  IntentAnalysis,
  LintResult,
  LintIssue,
  ContextyConfig,
  AgentMode,
  SubsessionConfig,
} from '../types';
import { FileSystem, Logger } from '../utils';
import { SubsessionHelper } from './SubsessionHelper';
import { LLMLinter } from './LLMLinter';
import { buildReviewPrompt } from './prompts';

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
  private subsessionHelper: SubsessionHelper | null = null;
  private mode: AgentMode;
  private config: ContextyConfig['aasm'];
  private client: OpencodeClient | null = null;
  private configPath: string | null = null;

  constructor(config: ContextyConfig, client?: OpencodeClient, configPath?: string) {
    this.config = config.aasm;
    this.mode = config.aasm.mode;
    this.configPath = configPath || null;
    this.analyzer = new IntentAnalyzer();

    if (client) {
      this.setClient(client);
    }
  }

  setClient(client: OpencodeClient): void {
    this.client = client;

    const subsessionConfig: Partial<SubsessionConfig> = {};
    if (this.config.model) {
      subsessionConfig.model = this.config.model;
    }

    const subsessionHelper = new SubsessionHelper(client, subsessionConfig);
    this.subsessionHelper = subsessionHelper;
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

  isEnabled(): boolean {
    return this.config.enabled;
  }

  async setMode(mode: AgentMode): Promise<void> {
    this.mode = mode;
    Logger.info(`AASM mode set to: ${mode}`);

    if (this.configPath) {
      try {
        let currentConfig: any = {};
        if (await FileSystem.exists(this.configPath)) {
          currentConfig = await FileSystem.readJSON(this.configPath);
        }

        currentConfig.aasm = {
          ...(currentConfig.aasm || {}),
          mode,
        };

        await FileSystem.writeJSON(this.configPath, currentConfig);
        Logger.debug(`Persisted AASM mode to ${this.configPath}`);
      } catch (error) {
        Logger.warn(
          `Failed to persist AASM mode: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }
  }

  getMode(): AgentMode {
    return this.mode;
  }

  getModelName(): string {
    return this.config.model || 'default-model';
  }

  private extractUserText(message: any): string {
    return (message?.parts ?? [])
      .filter((part: any) => part?.type === 'text')
      .map((part: any) => {
        if (typeof part.text === 'string') return part.text;
        if (part.text && typeof part.text.value === 'string') return part.text.value;
        return '';
      })
      .join('\n')
      .trim();
  }

  async generateAntiPatternReport(sessionID: string, limit = 20): Promise<string> {
    if (!this.client) {
      return 'AASM review is unavailable: client is not initialized.';
    }

    const boundedLimit = Math.max(5, Math.min(100, limit));

    const sessionsResult = await this.client.session.list();
    const listedSessions = Array.isArray(sessionsResult?.data) ? sessionsResult.data : [];

    const orderedSessionIDs = [
      sessionID,
      ...listedSessions
        .map((session: any) => session?.id)
        .filter((id: any) => typeof id === 'string'),
    ].filter((id, index, arr) => typeof id === 'string' && arr.indexOf(id) === index) as string[];

    const maxSessionsToScan = Math.max(10, Math.min(60, boundedLimit * 3));
    const sessionIDsToScan = orderedSessionIDs.slice(0, maxSessionsToScan);

    const aggregatedUserPrompts: Array<{ sessionID: string; messageID: string; text: string }> = [];
    let failedSessionReads = 0;

    for (const scanSessionID of sessionIDsToScan) {
      try {
        const messagesResult = await this.client.session.messages({
          path: { id: scanSessionID },
        });
        const messages = (messagesResult.data ?? messagesResult) as any[];

        const extracted = messages
          .filter((message) => message?.info?.role === 'user')
          .map((message) => ({
            sessionID: scanSessionID,
            messageID: message?.info?.id || 'unknown',
            text: this.extractUserText(message),
          }))
          .filter((entry) => entry.text.length > 0);

        aggregatedUserPrompts.push(...extracted);
      } catch (error) {
        failedSessionReads += 1;
        Logger.warn(
          `Failed to read session ${scanSessionID} for AASM review: ${
            error instanceof Error ? error.message : String(error)
          }`
        );
      }
    }

    const userPrompts = aggregatedUserPrompts.slice(-boundedLimit);
    const sessionsIncluded = new Set(userPrompts.map((entry) => entry.sessionID)).size;

    if (userPrompts.length === 0) {
      return [
        '# AASM Anti-pattern Review',
        '',
        `- Requested Session: ${sessionID}`,
        `- Sessions Scanned: ${sessionIDsToScan.length}`,
        `- Reviewed User Messages: 0 (전체 세션 기준 최근 ${boundedLimit}개 윈도우)`,
        '',
        '분석할 사용자 텍스트 메시지가 없습니다.',
      ].join('\n');
    }

    if (this.config.enableLinting && this.subsessionHelper) {
      try {
        const prompt = buildReviewPrompt(userPrompts, {
          requestedSessionID: sessionID,
          reviewLimit: boundedLimit,
          sessionsScanned: sessionIDsToScan.length,
          sessionsIncluded,
        });

        const llmReport = (await this.subsessionHelper.callLLM(prompt, sessionID)).trim();
        if (llmReport.length > 0) {
          return llmReport;
        }
      } catch (error) {
        Logger.warn(
          `AASM review prompt generation failed, fallback to aggregate report: ${
            error instanceof Error ? error.message : String(error)
          }`
        );
      }
    }

    const linted = await Promise.all(
      userPrompts.map(async (entry) => {
        const intent = this.analyzer.analyzeIntent(entry.text);
        const fallbackLint: LintResult = {
          valid: true,
          severity: 'advisory',
          issues: [],
          suggestions: [],
          confidence: 1,
        };

        if (!this.config.enableLinting || !this.llmLinter) {
          return {
            ...entry,
            intent,
            lintResult: fallbackLint,
            llmError: undefined as string | undefined,
          };
        }

        try {
          const lintResult = await this.llmLinter.lint(entry.text, entry.sessionID, intent);
          return {
            ...entry,
            intent,
            lintResult,
            llmError: undefined as string | undefined,
          };
        } catch (error) {
          return {
            ...entry,
            intent,
            lintResult: fallbackLint,
            llmError: error instanceof Error ? error.message : String(error),
          };
        }
      })
    );

    const severityCount = { critical: 0, warning: 0, advisory: 0 };
    const issueSummaryMap = new Map<
      string,
      {
        severity: LintIssue['severity'];
        type: LintIssue['type'];
        message: string;
        fix?: string;
        count: number;
        samples: string[];
      }
    >();

    let lintErrors = 0;
    for (const entry of linted) {
      severityCount[entry.lintResult.severity] += 1;
      if (entry.llmError) {
        lintErrors += 1;
      }

      for (const issue of entry.lintResult.issues) {
        const key = `${issue.type}|${issue.severity}|${issue.message}|${issue.fix ?? ''}`;
        const existing = issueSummaryMap.get(key);
        if (!existing) {
          issueSummaryMap.set(key, {
            severity: issue.severity,
            type: issue.type,
            message: issue.message,
            fix: issue.fix,
            count: 1,
            samples: [`[${entry.sessionID}] ${entry.text.substring(0, 120)}`],
          });
          continue;
        }

        existing.count += 1;
        if (existing.samples.length < 3) {
          existing.samples.push(`[${entry.sessionID}] ${entry.text.substring(0, 120)}`);
        }
      }
    }

    const topIssues = [...issueSummaryMap.values()].sort((a, b) => b.count - a.count);
    const totalIssues = topIssues.reduce((sum, issue) => sum + issue.count, 0);

    const lines = [
      '# AASM Anti-pattern Review',
      '',
      `- Requested Session: ${sessionID}`,
      `- Sessions Scanned: ${sessionIDsToScan.length}`,
      `- Sessions Included: ${sessionsIncluded}`,
      `- Reviewed User Messages: ${linted.length} (전체 세션 기준 최근 ${boundedLimit}개 윈도우)`,
      `- Prompt-level Severity: critical=${severityCount.critical}, warning=${severityCount.warning}, advisory=${severityCount.advisory}`,
      `- Total Detected Issues: ${totalIssues}`,
    ];

    if (failedSessionReads > 0) {
      lines.push(`- Session Read Failures: ${failedSessionReads}`);
    }

    if (lintErrors > 0) {
      lines.push(`- LLM Lint Errors (fallback applied): ${lintErrors}`);
    }

    if (topIssues.length === 0) {
      lines.push('', '## Summary', '', '감지된 안티패턴이 없습니다.');
      return lines.join('\n');
    }

    lines.push('', '## Top Anti-patterns', '');

    topIssues.forEach((issue, index) => {
      lines.push(
        `${index + 1}. [${issue.severity.toUpperCase()} | ${issue.type}] ${issue.message}`,
        `   - Count: ${issue.count}`,
        `   - Suggested Fix: ${issue.fix ?? 'N/A'}`,
        `   - Sample Prompt: "${issue.samples[0]}"`,
        ''
      );
    });

    return lines.join('\n').trim();
  }

  async handleCommand(command: string): Promise<string> {
    const showToast = async (
      title: string,
      message: string,
      variant: 'success' | 'warning' | 'info' | 'error'
    ) => {
      if (this.client) {
        await this.client.tui.showToast({
          body: { title, message, variant, duration: 4000 },
        });
      }
    };

    switch (command) {
      case 'active':
        await this.setMode('active');
        await showToast('AASM: ACTIVE', 'Architecture supervision ENABLED', 'success');
        return '✅ AASM mode set to: ACTIVE (Architecture linting enabled)';

      case 'passive':
        await this.setMode('passive');
        await showToast('AASM: PASSIVE', 'Architecture supervision DISABLED', 'warning');
        return '✅ AASM mode set to: PASSIVE (No architecture linting)';

      case 'status': {
        const isEffectiveLinting = this.mode === 'active' && this.config.enableLinting;
        const statusMsg = `Mode: ${this.mode.toUpperCase()}\nLinting: ${
          isEffectiveLinting ? 'ON' : 'OFF'
        }${this.mode === 'passive' ? ' (Passive Mode)' : ''}`;

        await showToast('AASM Status', statusMsg, 'info');
        return `
AASM Status:
- Mode: ${this.mode.toUpperCase()}
- Linting Enabled: ${this.config.enableLinting ? 'Yes' : 'No'}
- Effective State: ${isEffectiveLinting ? 'ACTIVE' : 'DISABLED'}
- Confidence Threshold: ${this.config.confidenceThreshold}
`;
      }

      default:
        await showToast('AASM Error', `Unknown command: ${command}`, 'error');
        return `❌ Unknown agent command: ${command}\n\nUsage: /agent <active|passive|status>`;
    }
  }
}
