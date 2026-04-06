import type { FolderAccess, ToolCategory } from '../acpm/types';

export interface MetricsSnapshot {
  version: number;
  sessionID: string;
  timestamp: string;
  tokens: TokenMetrics;
  files: FileMetrics[];
  tools: ToolMetrics[];
  acpm: AcpmMetrics;
}

export interface TokenMetrics {
  input: number;
  output: number;
  reasoning: number;
  cacheRead: number;
  cacheWrite: number;
}

export interface FileMetrics {
  path: string;
  tokenEstimate: number;
  role: string;
}

export interface ToolMetrics {
  name: string;
  count: number;
  successCount: number;
  failCount: number;
}

export interface AcpmMetrics {
  activePreset: string | null;
  allowCount: number;
  denyCount: number;
  sanitizeCount: number;
  deniedByCategory: Record<string, number>;
  folderAccessDistribution: Record<FolderAccess, number>;
  toolCategoryStatus: ToolCategoryStatus[];
}

export interface ToolCategoryStatus {
  category: ToolCategory;
  enabled: boolean;
}
