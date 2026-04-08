/**
 * Core types for Contexty Extension (AASM Subset)
 */

/**
 * Architecture lint result from AASM
 */
export interface LintResult {
  /** Whether the intent passes architecture validation */
  valid: boolean;
  /** Aggregate severity of detected issues */
  severity: 'critical' | 'warning' | 'advisory';
  /** Detected issues */
  issues: LintIssue[];
  /** Suggestions for improvement */
  suggestions: string[];
  /** Confidence score (0-1) */
  confidence: number;
}

/**
 * Individual lint issue
 */
export interface LintIssue {
  /** Issue severity */
  severity: 'error' | 'warning' | 'info';
  /** Issue type */
  type: 'anti-pattern' | 'architecture-violation' | 'convention-mismatch';
  /** Human-readable message */
  message: string;
  /** Suggested fix */
  fix?: string;
}

/**
 * User intent analysis result
 */
export interface IntentAnalysis {
  /** Classified intent type */
  intentType: 'refactor' | 'feature' | 'bugfix' | 'test' | 'docs' | 'other';
  /** Detected target files/modules */
  targets: string[];
  /** Confidence score (0-1) */
  confidence: number;
  /** Architectural implications */
  architecturalImpact: 'low' | 'medium' | 'high';
}

/**
 * Agent mode configuration
 */
export type AgentMode = 'active' | 'passive';

/**
 * Subsession configuration for LLM calls
 */
export interface SubsessionConfig {
  /** Timeout in milliseconds */
  timeout: number;
  /** Polling interval in milliseconds */
  pollInterval: number;
  /** Number of consecutive stable checks required */
  stabilityRequired: number;
  /** LLM model to use (optional, uses host default if undefined) */
  model?: string;
}

import type { DCPConfig } from '../dcp/types';

/**
 * Extension configuration
 */

export interface ContextyConfig {
  /** HSCMM settings (Optional in this subset) */
  hscmm?: {
    maxTokens: number;
    autoCleanupThreshold: number;
    snapshotDir: string;
  };
  acpm?: {
    defaultPreset?: string;
  };
  /** TLS settings (Optional) */
  tls: {
    enabled: boolean;
    model?: string;
  };
  dcp?: DCPConfig;
  /** AASM settings */
  aasm: {
    /** Current agent mode */
    mode: AgentMode;
    /** LLM model for linting (optional) */
    model?: string;
  };
}
