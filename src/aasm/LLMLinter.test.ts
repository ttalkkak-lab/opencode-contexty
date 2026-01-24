import { describe, test, expect, beforeEach, mock } from 'bun:test';
import { LLMLinter } from './LLMLinter';
import type { LintResult } from '../types';

describe('LLMLinter', () => {
  let linter: LLMLinter;
  let mockSubsessionHelper: any;
  const mockSessionID = 'session-123';

  beforeEach(() => {
    mockSubsessionHelper = {
      callLLM: mock(() => Promise.resolve('')),
    };
    linter = new LLMLinter(mockSubsessionHelper);
  });

  describe('lint', () => {
    test('should return lint result from LLM', async () => {
      const llmResponse = JSON.stringify({
        valid: false,
        severity: 'warning',
        issues: [
          {
            severity: 'warning',
            type: 'anti-pattern',
            message: 'Monolithic main file detected',
            fix: 'Split into modules',
          },
        ],
        suggestions: ['Consider modular design'],
        confidence: 0.9,
      });

      mockSubsessionHelper.callLLM = mock(() => Promise.resolve(llmResponse));

      const result = await linter.lint('Put all code in main.ts', mockSessionID);

      expect(result.valid).toBe(false);
      expect(result.severity).toBe('warning');
      expect(result.issues.length).toBe(1);
      expect(result.issues[0].message).toContain('Monolithic');
      expect(result.confidence).toBe(0.9);
    });

    test('should parse JSON response correctly', async () => {
      const llmResponse = `Here's my analysis:
{
  "valid": true,
  "severity": "advisory",
  "issues": [],
  "suggestions": ["Good architecture"],
  "confidence": 0.95
}`;

      mockSubsessionHelper.callLLM = mock(() => Promise.resolve(llmResponse));

      const result = await linter.lint('Create a new service', mockSessionID);

      expect(result.valid).toBe(true);
      expect(result.severity).toBe('advisory');
      expect(result.issues.length).toBe(0);
      expect(result.suggestions).toContain('Good architecture');
    });

    test('should throw error on LLM failure', async () => {
      mockSubsessionHelper.callLLM = mock(() => Promise.reject(new Error('LLM unavailable')));

      await expect(linter.lint('Some prompt', mockSessionID)).rejects.toThrow('LLM unavailable');
    });

    test('should throw error on invalid response', async () => {
      mockSubsessionHelper.callLLM = mock(() => Promise.resolve('Invalid JSON'));

      await expect(linter.lint('Some prompt', mockSessionID)).rejects.toThrow(
        'Failed to parse LLM lint response'
      );
    });
  });
});
