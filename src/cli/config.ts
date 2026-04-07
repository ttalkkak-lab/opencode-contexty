/**
 * Configuration types, defaults, and file operations
 */

import { writeFileSync } from 'fs';
import { join } from 'path';

export interface ContextyConfig {
  $schema: string;
  aasm: {
    mode: 'passive' | 'active';
    model?: string;
  };
}

export const DEFAULT_CONFIG: ContextyConfig = {
  $schema: 'https://unpkg.com/@ttalkkak-lab/opencode-contexty/schema.json',
  aasm: {
    mode: 'passive',
  },
};

export const OPENCODE_CONFIG_PATH = join(
  process.env.HOME || process.env.USERPROFILE || '~',
  '.config',
  'opencode',
  'opencode.json'
);

export function writeConfig(config: ContextyConfig, targetDir: string): string {
  const configPath = join(targetDir, 'contexty.config.json');
  const content = JSON.stringify(config, null, 2);
  writeFileSync(configPath, content + '\n', 'utf-8');
  return configPath;
}
