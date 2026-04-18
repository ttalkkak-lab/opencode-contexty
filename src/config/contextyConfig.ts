import * as fs from 'fs/promises';
import * as path from 'path';
import { GLOBAL_CONTEXTY_CONFIG_PATH } from './paths';
import type { ContextyConfig } from '../types';

export const CONTEXTY_CONFIG_SCHEMA_URL =
  'https://unpkg.com/@ttalkkak-lab/opencode-contexty/schema.json';

export const DEFAULT_CONTEXTY_CONFIG: ContextyConfig = {
  $schema: CONTEXTY_CONFIG_SCHEMA_URL,
  aasm: {
    mode: 'passive',
  },
  tls: {
    enabled: true,
  },
};

export interface LoadedContextyConfig {
  config: ContextyConfig;
  configPath: string;
}

export function getLocalContextyConfigPath(directory: string): string {
  return path.join(directory, 'contexty.config.json');
}

function mergeOptionalObject<T extends Record<string, unknown>>(
  base: T | undefined,
  override: T | undefined
): T | undefined {
  if (!base && !override) {
    return undefined;
  }

  return {
    ...(base ?? {}),
    ...(override ?? {}),
  } as T;
}

export function mergeContextyConfig(
  base: ContextyConfig,
  override?: Partial<ContextyConfig> | null
): ContextyConfig {
  if (!override) {
    return base;
  }

  return {
    ...base,
    ...override,
    $schema: override.$schema ?? base.$schema,
    aasm: {
      ...base.aasm,
      ...override.aasm,
    },
    tls: {
      ...base.tls,
      ...override.tls,
    },
    hscmm: mergeOptionalObject(base.hscmm, override.hscmm),
    acpm: mergeOptionalObject(base.acpm, override.acpm),
    dcp: override.dcp ?? base.dcp,
  };
}

async function readContextyConfig(
  configPath: string
): Promise<Partial<ContextyConfig> | null> {
  try {
    const raw = await fs.readFile(configPath, 'utf8');
    const parsed = JSON.parse(raw);

    return parsed && typeof parsed === 'object'
      ? (parsed as Partial<ContextyConfig>)
      : null;
  } catch {
    return null;
  }
}

export async function loadContextyConfig(directory?: string): Promise<LoadedContextyConfig> {
  const configPaths = directory
    ? [GLOBAL_CONTEXTY_CONFIG_PATH, getLocalContextyConfigPath(directory)]
    : [GLOBAL_CONTEXTY_CONFIG_PATH];

  let config = DEFAULT_CONTEXTY_CONFIG;
  let configPath = GLOBAL_CONTEXTY_CONFIG_PATH;

  for (const candidatePath of configPaths) {
    const parsed = await readContextyConfig(candidatePath);
    if (!parsed) {
      continue;
    }

    config = mergeContextyConfig(config, parsed);
    configPath = candidatePath;
  }

  return { config, configPath };
}
