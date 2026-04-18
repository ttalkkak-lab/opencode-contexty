import { join } from 'path';

const homeDir = process.env.HOME || process.env.USERPROFILE || '~';

export const CONFIG_DIR_PATH = join(homeDir, '.config', 'opencode');

export const OPENCODE_CONFIG_PATH = join(CONFIG_DIR_PATH, 'opencode.json');

export const GLOBAL_CONTEXTY_CONFIG_PATH = join(CONFIG_DIR_PATH, 'contexty.config.json');
