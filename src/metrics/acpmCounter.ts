import type { ACPMModule } from '../acpm';
import type { FolderAccess, Preset, ToolCategory } from '../acpm/types';
import type { AcpmMetrics, ToolCategoryStatus } from './types';

export interface AcpmCounterCounts {
  allowCount: number;
  denyCount: number;
  sanitizeCount: number;
  deniedByCategory: Record<string, number>;
}

export class AcpmCounter {
  private allowCount = 0;
  private denyCount = 0;
  private sanitizeCount = 0;
  private deniedByCategory = new Map<ToolCategory, number>();

  recordAllow(): void {
    this.allowCount += 1;
  }

  recordDeny(category: ToolCategory): void {
    this.denyCount += 1;
    this.deniedByCategory.set(category, (this.deniedByCategory.get(category) ?? 0) + 1);
  }

  recordSanitize(): void {
    this.sanitizeCount += 1;
  }

  getCounts(): AcpmCounterCounts {
    return {
      allowCount: this.allowCount,
      denyCount: this.denyCount,
      sanitizeCount: this.sanitizeCount,
      deniedByCategory: Object.fromEntries(this.deniedByCategory),
    };
  }

  reset(): void {
    this.allowCount = 0;
    this.denyCount = 0;
    this.sanitizeCount = 0;
    this.deniedByCategory.clear();
  }
}

export const acpmCounter = new AcpmCounter();

function createEmptyFolderAccessDistribution(): Record<FolderAccess, number> {
  return {
    denied: 0,
    'read-only': 0,
    'read-write': 0,
  };
}

function buildToolCategoryStatus(preset: Preset): ToolCategoryStatus[] {
  return preset.toolPermissions.map((permission) => ({
    category: permission.category,
    enabled: permission.enabled,
  }));
}

function buildFolderAccessDistribution(preset: Preset): Record<FolderAccess, number> {
  const distribution = createEmptyFolderAccessDistribution();

  for (const permission of preset.folderPermissions) {
    distribution[permission.access] += 1;
  }

  return distribution;
}

export function buildAcpmMetrics(acpm: ACPMModule, counter: AcpmCounter): AcpmMetrics {
  const preset = acpm.getActivePreset();
  const counts = counter.getCounts();

  return {
    activePreset: preset?.name ?? null,
    allowCount: counts.allowCount,
    denyCount: counts.denyCount,
    sanitizeCount: counts.sanitizeCount,
    deniedByCategory: counts.deniedByCategory,
    folderAccessDistribution: preset ? buildFolderAccessDistribution(preset) : createEmptyFolderAccessDistribution(),
    toolCategoryStatus: preset ? buildToolCategoryStatus(preset) : [],
  };
}
