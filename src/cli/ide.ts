/**
 * IDE configuration and extension installation
 */

import { execSync } from 'child_process';
import { join } from 'path';
import { info, warn, success } from './ui.js';

export type IDEType = 'vscode' | 'vscode-insiders' | 'vscodium' | 'cursor' | 'windsurf' | 'none';

export interface IDEConfig {
  name: string;
  cliCommand: string;
  extensionPath: string;
}

const HOME = process.env.HOME || process.env.USERPROFILE || '~';

export const IDE_CONFIGS: Record<Exclude<IDEType, 'none'>, IDEConfig> = {
  vscode: {
    name: 'Visual Studio Code',
    cliCommand: 'code',
    extensionPath: join(HOME, '.vscode', 'extensions'),
  },
  'vscode-insiders': {
    name: 'VS Code Insiders',
    cliCommand: 'code-insiders',
    extensionPath: join(HOME, '.vscode-insiders', 'extensions'),
  },
  vscodium: {
    name: 'VSCodium',
    cliCommand: 'codium',
    extensionPath: join(HOME, '.vscode-oss', 'extensions'),
  },
  cursor: {
    name: 'Cursor',
    cliCommand: 'cursor',
    extensionPath: join(HOME, '.cursor', 'extensions'),
  },
  windsurf: {
    name: 'Windsurf',
    cliCommand: 'windsurf',
    extensionPath: join(HOME, '.windsurf', 'extensions'),
  },
};

export const EXTENSION_ID = 'ttalkkak-lab.contexty-hscmm';
export const EXTENSION_REPO = 'https://github.com/ttalkkak-lab/opencode-contexty-extension';

function checkCliAvailable(cliCommand: string): boolean {
  try {
    execSync(`which ${cliCommand}`, { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

export function installIDEExtension(ide: IDEType): boolean {
  if (ide === 'none') {
    info('Skipping IDE extension installation');
    return true;
  }

  const ideConfig = IDE_CONFIGS[ide];
  if (!ideConfig) {
    warn(`Unknown IDE: ${ide}`);
    return false;
  }

  console.log('');
  info(`Installing HSCMM extension for ${ideConfig.name}...`);

  // Check if CLI is available
  if (!checkCliAvailable(ideConfig.cliCommand)) {
    warn(`${ideConfig.cliCommand} CLI not found in PATH`);
    info(`Please install the extension manually from: ${EXTENSION_REPO}`);
    info(`Or ensure ${ideConfig.cliCommand} is in your PATH and run:`);
    info(`  ${ideConfig.cliCommand} --install-extension ${EXTENSION_ID}`);
    return false;
  }

  try {
    // Try to install via CLI
    execSync(`${ideConfig.cliCommand} --install-extension ${EXTENSION_ID}`, {
      stdio: 'inherit',
    });
    success(`Installed HSCMM extension for ${ideConfig.name}`);
    return true;
  } catch {
    // If marketplace install fails, try from VSIX URL
    warn(`Could not install from marketplace, trying alternative method...`);
    try {
      const vsixUrl = `${EXTENSION_REPO}/releases/latest/download/opencode-contexty-extension.vsix`;
      execSync(`${ideConfig.cliCommand} --install-extension ${vsixUrl}`, {
        stdio: 'inherit',
      });
      success(`Installed HSCMM extension for ${ideConfig.name} from GitHub releases`);
      return true;
    } catch {
      warn(`Could not install extension automatically`);
      info(`Please install manually from: ${EXTENSION_REPO}/releases`);
      info(`Or run: ${ideConfig.cliCommand} --install-extension ${EXTENSION_ID}`);
      return false;
    }
  }
}

export function getIDEDisplayName(ide: IDEType): string {
  if (ide === 'none') return 'None';
  return IDE_CONFIGS[ide]?.name || ide;
}

export function isValidIDE(ide: string): ide is IDEType {
  return ide === 'none' || ide in IDE_CONFIGS;
}
