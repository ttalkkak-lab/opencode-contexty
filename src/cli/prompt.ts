/**
 * Interactive prompt utilities
 */

import * as readline from 'readline';
import { colors, log } from './ui.js';

export async function prompt(question: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

export async function promptSelect(
  question: string,
  options: string[],
  defaultIdx = 0
): Promise<string> {
  log(`\n${colors.bold}${question}${colors.reset}`);
  options.forEach((opt, i) => {
    const marker = i === defaultIdx ? `${colors.green}→${colors.reset}` : ' ';
    log(`  ${marker} ${i + 1}) ${opt}`);
  });

  const answer = await prompt(`\nSelect [1-${options.length}] (default: ${defaultIdx + 1}): `);
  const idx = answer ? parseInt(answer, 10) - 1 : defaultIdx;

  if (idx >= 0 && idx < options.length) {
    return options[idx];
  }
  return options[defaultIdx];
}

export async function promptYesNo(question: string, defaultYes = true): Promise<boolean> {
  const hint = defaultYes ? '[Y/n]' : '[y/N]';
  const answer = await prompt(`${question} ${hint}: `);

  if (!answer) return defaultYes;
  return answer.toLowerCase().startsWith('y');
}
