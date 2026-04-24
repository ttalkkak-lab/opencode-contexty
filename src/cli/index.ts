#!/usr/bin/env node
/**
 * OpenCode Contexty CLI
 * Interactive and non-interactive installer for contexty.config.json
 */

import { parseArgs } from 'util';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { execSync } from 'child_process';

import { colors, log, info, error, success, banner } from './ui.js';
import { ContextyConfig, DCPConfig, DEFAULT_CONFIG, writeConfig, GLOBAL_CONTEXTY_CONFIG_PATH } from './config.js';
import { IDEType, installIDEExtension, getIDEDisplayName, isValidIDE } from './ide.js';
import { registerPlugin } from './plugin.js';
import { prompt, promptSelect, promptYesNo } from './prompt.js';
import { runConfigCommand } from './configCommand.js';

// ============================================================================
// CLI Arguments
// ============================================================================

interface CliValues {
  'no-tui': boolean;
  ide: string;
  'aasm-mode': string;
  model: string;
  dcp: boolean;
  'dcp-permission': string;
  'dcp-max-context': string;
  help: boolean;
  version: boolean;
}

interface CliConfig extends ContextyConfig {
  acpm?: {
    defaultPreset: string;
  };
}

const DEFAULT_CLI_VALUES: CliValues = {
  'no-tui': false,
  ide: 'vscode',
  'aasm-mode': 'passive',
  model: '',
  dcp: false,
  'dcp-permission': 'allow',
  'dcp-max-context': '80%',
  help: false,
  version: false,
};

function parseCliArgs(): { values: CliValues; positionals: string[] } {
  try {
    const { values, positionals } = parseArgs({
      args: process.argv.slice(2),
      options: {
        'no-tui': { type: 'boolean', default: false },
        ide: { type: 'string', default: 'vscode' },
        'aasm-mode': { type: 'string', default: 'passive' },
        model: { type: 'string', default: '' },
        dcp: { type: 'boolean', default: false },
        'dcp-permission': { type: 'string', default: 'allow' },
        'dcp-max-context': { type: 'string', default: '80%' },
        help: { type: 'boolean', short: 'h', default: false },
        version: { type: 'boolean', short: 'v', default: false },
      },
      allowPositionals: true,
    });

    return { values: values as CliValues, positionals };
  } catch {
    return { values: { ...DEFAULT_CLI_VALUES, help: true }, positionals: [] };
  }
}

// ============================================================================
// Help
// ============================================================================

function showHelp(): void {
  console.log(`
${colors.bold}Usage:${colors.reset} npx @ttalkkak-lab/opencode-contexty <command> [options]

${colors.bold}Commands:${colors.reset}
  init                          Initialize global config (~/.config/opencode/contexty.config.json)
  config                        Configure project-local ACPM permissions

${colors.bold}Init Options:${colors.reset}
  --no-tui                      Run in non-interactive mode
  --ide=<ide>                   IDE for extension: vscode (default) | vscode-insiders | vscodium | cursor | windsurf | none
  --aasm-mode=<mode>            Set AASM mode: passive (default) | active
  --model=<model>               Set custom model for AASM (optional)
  --dcp                         Enable DCP (Dynamic Context Pruning)
  --dcp-permission=<perm>       Compression permission: allow (default) | ask | deny
  --dcp-max-context=<val>       Context limit threshold, e.g. 80% (default) or 150000
  -h, --help                    Show this help message
  -v, --version                 Show version

${colors.bold}Examples:${colors.reset}
  ${colors.dim}# Interactive init${colors.reset}
  npx @ttalkkak-lab/opencode-contexty init

  ${colors.dim}# Non-interactive with defaults (installs VSCode extension)${colors.reset}
  npx @ttalkkak-lab/opencode-contexty init --no-tui

  ${colors.dim}# Install for Cursor IDE${colors.reset}
  npx @ttalkkak-lab/opencode-contexty init --no-tui --ide=cursor

  ${colors.dim}# Skip IDE extension installation${colors.reset}
  npx @ttalkkak-lab/opencode-contexty init --no-tui --ide=none

  ${colors.dim}# Active mode with custom model${colors.reset}
  npx @ttalkkak-lab/opencode-contexty init --no-tui --aasm-mode=active --model=google/antigravity-gemini-3-flash

  ${colors.dim}# Configure project-local ACPM permissions${colors.reset}
  npx @ttalkkak-lab/opencode-contexty config
`);
}

// ============================================================================
// DCP Config Builder
// ============================================================================

function parseContextLimit(value: string): number | `${number}%` {
  const trimmed = value.trim();
  if (trimmed.endsWith('%')) {
    return trimmed as `${number}%`;
  }
  const num = parseInt(trimmed, 10);
  return isNaN(num) ? '80%' : num;
}

function buildDCPConfig(
  compressPermission: 'ask' | 'allow' | 'deny',
  maxContextLimit: number | `${number}%`,
  autoStrategies: boolean
): DCPConfig {
  return {
    enabled: true,
    debug: false,
    pruneNotification: 'minimal',
    pruneNotificationType: 'toast',
    commands: { enabled: true, protectedTools: [] },
    manualMode: { enabled: true, automaticStrategies: autoStrategies },
    turnProtection: { enabled: false, turns: 0 },
    experimental: { allowSubAgents: false, customPrompts: false },
    protectedFilePatterns: [],
    compress: {
      mode: 'range',
      permission: compressPermission,
      showCompression: true,
      summaryBuffer: false,
      maxContextLimit,
      minContextLimit: '10%',
      nudgeFrequency: 3,
      iterationNudgeThreshold: 5,
      nudgeForce: 'soft',
      protectedTools: [],
      protectUserMessages: false,
    },
    strategies: {
      deduplication: { enabled: true, protectedTools: [] },
      purgeErrors: { enabled: true, turns: 3, protectedTools: [] },
    },
  };
}

// ============================================================================
// Interactive Mode
// ============================================================================

async function runInteractive(): Promise<{ config: CliConfig; ide: IDEType }> {
  banner();
  log(`${colors.dim}Let's configure your global contexty.config.json${colors.reset}`);
  log(`${colors.dim}Config will be saved to ~/.config/opencode/${colors.reset}\n`);

  // 0. IDE Selection
  const ideChoice = await promptSelect(
    'Which IDE do you want to install the Contexty extension for?',
    [
      'vscode - Visual Studio Code',
      'vscode-insiders - VS Code Insiders',
      'vscodium - VSCodium',
      'cursor - Cursor',
      'windsurf - Windsurf',
      'none - Skip IDE extension installation',
    ],
    0
  );
  const ide = ideChoice.split(' - ')[0] as IDEType;

  // 1. AASM Mode
  const modeChoice = await promptSelect(
    'Select AASM supervision mode:',
    [
      'passive - Monitors without intervention (recommended)',
      'active - Actively lints and analyzes intent',
    ],
    0
  );
  const aasmMode: 'passive' | 'active' = modeChoice.startsWith('passive') ? 'passive' : 'active';

  // 2. Model (optional)
  const useCustomModel = await promptYesNo(
    'Use a custom model for AASM? (default: session model)',
    false
  );
  let model: string | undefined;

  if (useCustomModel) {
    const modelInput = await prompt(
      'Enter model identifier (e.g., google/antigravity-gemini-3-flash): '
    );
    if (modelInput) {
      model = modelInput;
    }
  }

  // 3. DCP (Dynamic Context Pruning)
  const enableDCP = await promptYesNo(
    'Enable DCP (Dynamic Context Pruning)?',
    true
  );
  let dcp: DCPConfig | undefined;

  if (enableDCP) {
    // 3a. Compression permission
    const permChoice = await promptSelect(
      'How should the agent handle compression requests?',
      [
        'allow - Automatically allow compression (recommended)',
        'ask   - Ask for confirmation each time',
        'deny  - Disable compression (auto-strategies only)',
      ],
      0
    );
    const compressPermission = permChoice.split(' - ')[0].trim() as 'allow' | 'ask' | 'deny';

    // 3b. Context limit threshold
    const thresholdChoice = await promptSelect(
      'At what context usage should the agent be nudged to compress?',
      [
        '70% - Aggressive (compress early)',
        '80% - Balanced (recommended)',
        '90% - Conservative (compress late)',
        'custom - Enter manually',
      ],
      1
    );
    let maxContextLimit: number | `${number}%`;
    if (thresholdChoice.startsWith('custom')) {
      const customVal = await prompt('Enter threshold (e.g., 75% or 150000): ');
      maxContextLimit = parseContextLimit(customVal || '80%');
    } else {
      maxContextLimit = thresholdChoice.split(' - ')[0].trim() as `${number}%`;
    }

    // 3c. Automatic strategies
    const autoStrategies = await promptYesNo(
      'Enable automatic strategies? (deduplication + error pruning)',
      true
    );

    dcp = buildDCPConfig(compressPermission, maxContextLimit, autoStrategies);
  }

  const config: CliConfig = {
    $schema: DEFAULT_CONFIG.$schema,
    aasm: { mode: aasmMode },
    tls: { enabled: true },
  };

  if (model) {
    config.aasm.model = model;
  }

  if (dcp) {
    config.dcp = dcp;
  }

  return { config, ide };
}

// ============================================================================
// Non-Interactive Mode
// ============================================================================

function runNonInteractive(values: CliValues): CliConfig {
  const aasmMode = values['aasm-mode'] === 'active' ? 'active' : 'passive';
  const model = values.model || undefined;

  const config: CliConfig = {
    $schema: DEFAULT_CONFIG.$schema,
    aasm: { mode: aasmMode },
    tls: { enabled: true },
  };

  if (model) {
    config.aasm.model = model;
  }

  if (values.dcp) {
    const rawPermission = values['dcp-permission'];
    const compressPermission: 'ask' | 'allow' | 'deny' =
      rawPermission === 'ask' || rawPermission === 'deny' ? rawPermission : 'allow';
    const maxContextLimit = parseContextLimit(values['dcp-max-context'] || '80%');
    config.dcp = buildDCPConfig(compressPermission, maxContextLimit, true);
  }

  return config;
}

// ============================================================================
// Star Prompt
// ============================================================================

async function askForStar(): Promise<void> {
  const star = await promptYesNo(
    'Would you like to star us on GitHub? ⭐',
    true
  );

  if (star) {
    const repoUrl = 'https://github.com/ttalkkak-lab/opencode-contexty';
    try {
      const cmd = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'start' : 'xdg-open';
      execSync(`${cmd} ${repoUrl}`, { stdio: 'ignore' });
      success('Opening GitHub in your browser — thanks for the support! 🙏');
    } catch {
      log(`  ${colors.dim}${repoUrl}${colors.reset}`);
    }
  }
}

// ============================================================================
// Main
// ============================================================================

async function main(): Promise<void> {
  const { values, positionals } = parseCliArgs();

  // Handle --version
  if (values.version) {
    try {
      const pkg = JSON.parse(readFileSync(join(__dirname, '..', '..', 'package.json'), 'utf-8'));
      console.log(pkg.version);
    } catch {
      console.log('0.1.0');
    }
    process.exit(0);
  }

  // Handle --help
  if (values.help) {
    showHelp();
    process.exit(0);
  }

  // Route commands
  const command = positionals[0];

  if (command === 'config') {
    await runConfigCommand();
    process.exit(0);
  }

  if (command !== 'init') {
    if (command) {
      error(`Unknown command: ${command}`);
    }
    showHelp();
    process.exit(command ? 1 : 0);
  }

  // === init command ===

  // Check if config already exists (global)
  if (existsSync(GLOBAL_CONTEXTY_CONFIG_PATH)) {
    log(
      `${colors.yellow}⚠${colors.reset} contexty.config.json already exists at ${GLOBAL_CONTEXTY_CONFIG_PATH}`
    );
    if (!values['no-tui']) {
      const overwrite = await promptYesNo('Do you want to overwrite it?', false);
      if (!overwrite) {
        info('Aborted. Existing config preserved.');
        process.exit(0);
      }
    } else {
      info('Overwriting existing config (--no-tui mode)');
    }
  }

  // Run interactive or non-interactive mode
  let config: ContextyConfig;
  let ide: IDEType;

  if (values['no-tui']) {
    info('Running in non-interactive mode...');
    config = runNonInteractive(values);
    ide = values.ide as IDEType;

    // Validate IDE option
    if (!isValidIDE(ide)) {
      log(
        `${colors.yellow}⚠${colors.reset} Invalid IDE option: ${ide}. Using 'vscode' as default.`
      );
      ide = 'vscode';
    }
  } else {
    const result = await runInteractive();
    config = result.config;
    ide = result.ide;
  }

  // Write config (global)
  const configPath = writeConfig(config);
  success(`Created ${configPath}`);

  // Register plugin
  log('');
  registerPlugin();

  // Install IDE extension
  installIDEExtension(ide);

  // Print summary
  const ideInfo = getIDEDisplayName(ide);
  const dcpSummary = config.dcp?.enabled
    ? `enabled (permission: ${config.dcp.compress.permission}, limit: ${config.dcp.compress.maxContextLimit})`
    : 'disabled';
  log(`
${colors.green}${colors.bold}✓ Setup complete!${colors.reset}

${colors.bold}Configuration:${colors.reset}
  AASM Mode:     ${config.aasm.mode}
  Model:         ${config.aasm.model || '(session default)'}
  DCP:           ${dcpSummary}
  IDE Extension: ${ideInfo}

${colors.dim}Use 'npx @ttalkkak-lab/opencode-contexty config' to set up project-local ACPM permissions.${colors.reset}
`);

  // Ask for star
  if (!values['no-tui']) {
    await askForStar();
  }
}

main().catch((e) => {
  error(`Fatal error: ${e.message}`);
  process.exit(1);
});
