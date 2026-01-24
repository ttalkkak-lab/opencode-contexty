import type { LintResult } from '../types';

export function buildLintPrompt(userMessage: string): string {
  return `You are an architecture linter analyzing a user's request to an AI coding assistant.

Analyze the following user request and detect any architecture anti-patterns or violations.

USER REQUEST:
"""
${userMessage}
"""

Check for these anti-patterns:
1. Monolithic main file - putting all logic in main.ts/index.ts/app.ts
2. God object/class/function - single component doing too much
3. Global/shared mutable state - violates encapsulation
4. Tight coupling - components too dependent on each other
5. Mixed concerns - business logic mixed with UI/infrastructure

Determine the aggregate SEVERITY of the request:
- critical: Explicit violation of core architecture principles (e.g., "put everything in main.ts"). MUST be blocked.
- warning: Potential issue but context-dependent (e.g., "use global state"). Needs user confirmation or further check.
- advisory: Minor issue or ambiguous request that needs clarification. Information only.

IMPORTANT: The fields "message", "fix", and "suggestions" MUST be in the same language as the USER REQUEST.
- If User Request is Korean, output Korean (한국어).
- If User Request is Japanese, output Japanese (日本語).
- If User Request is English, output English.

Respond ONLY with valid JSON in this exact format:
{
  "valid": true/false,
  "severity": "critical" | "warning" | "advisory",
  "issues": [
    {
      "severity": "error" | "warning" | "info",
      "type": "anti-pattern" | "architecture-violation" | "convention-mismatch",
      "message": "description of the issue (SAME LANGUAGE AS USER REQUEST)",
      "fix": "suggested fix (SAME LANGUAGE AS USER REQUEST)"
    }
  ],
  "suggestions": ["suggestion 1", "suggestion 2"],
  "confidence": 0.0-1.0
}

If no issues found, return: {"valid": true, "severity": "advisory", "issues": [], "suggestions": [], "confidence": 1.0}

CRITICAL: Double-check the language of "message", "fix", and "suggestions". They MUST match the user's language.
Severity MUST be one of: critical, warning, advisory (English only).

JSON response:`;
}

export function parseLintResponse(response: string): LintResult | null {
  try {
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;

    const parsed = JSON.parse(jsonMatch[0]);

    if (typeof parsed.valid !== 'boolean') return null;
    if (!Array.isArray(parsed.issues)) return null;

    let severity: LintResult['severity'] = 'warning';
    if (['critical', 'warning', 'advisory'].includes(parsed.severity)) {
      severity = parsed.severity;
    }

    return {
      valid: parsed.valid,
      severity,
      issues: parsed.issues.map((issue: any) => ({
        severity: issue.severity || 'warning',
        type: issue.type || 'anti-pattern',
        message: issue.message || 'Unknown issue',
        fix: issue.fix,
      })),
      suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions : [],
      confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0.5,
    };
  } catch {
    return null;
  }
}
