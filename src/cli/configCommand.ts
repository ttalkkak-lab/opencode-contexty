import { runACPMWizard } from './acpm.js';
import { success, info, warn } from './ui.js';
import { promptYesNo } from './prompt.js';

export async function runConfigCommand(): Promise<void> {
  const projectDir = process.cwd();

  info(`Configuring project-local ACPM permissions in ${projectDir}`);

  const enabled = await promptYesNo('Enable ACPM permissions for this project?', true);

  if (!enabled) {
    info('ACPM disabled for this project.');
    return;
  }

  const presetName = await runACPMWizard(projectDir);

  if (presetName) {
    success(`ACPM preset "${presetName}" configured for this project.`);
  } else {
    warn('No ACPM preset was created.');
  }
}
