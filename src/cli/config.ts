/**
 * Configuration types, defaults, and file operations
 */

import { writeFileSync, mkdirSync } from 'fs';
import type { ContextyConfig } from '../types';
import { DEFAULT_CONTEXTY_CONFIG } from '../config/contextyConfig';
import { CONFIG_DIR_PATH, GLOBAL_CONTEXTY_CONFIG_PATH } from '../config/paths';

export { OPENCODE_CONFIG_PATH, GLOBAL_CONTEXTY_CONFIG_PATH } from '../config/paths';
export type { ContextyConfig } from '../types';

export const DEFAULT_CONFIG: ContextyConfig = DEFAULT_CONTEXTY_CONFIG;

export function writeConfig(config: ContextyConfig): string {
  mkdirSync(CONFIG_DIR_PATH, { recursive: true });

  const configPath = GLOBAL_CONTEXTY_CONFIG_PATH;
  const content = JSON.stringify(config, null, 2);
  writeFileSync(configPath, content + '\n', 'utf-8');
  return configPath;
}
