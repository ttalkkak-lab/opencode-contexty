import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const projectRoot = new URL('../', import.meta.url);
const srcDir = new URL('../src/', import.meta.url);
const projectRootPath = fileURLToPath(projectRoot);

const productionExtensions = new Set(['.ts']);
const productionFileExcludes = [
  '.test.ts',
  '.integration.test.ts',
  '.d.ts',
];
const consoleRuleExcludes = [
  `${path.sep}src${path.sep}cli${path.sep}`,
];

const fileSegmentPattern = /^[a-z][A-Za-z0-9]*$/;
const allowedFileBaseNames = new Set([
  'index',
]);

async function walk(dirUrl) {
  const entries = await fs.readdir(dirUrl, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const entryUrl = new URL(`${entry.name}${entry.isDirectory() ? '/' : ''}`, dirUrl);
    if (entry.isDirectory()) {
      files.push(...await walk(entryUrl));
      continue;
    }

    files.push(entryUrl);
  }

  return files;
}

function isProductionTypeScript(filePath) {
  if (!productionExtensions.has(path.extname(filePath))) {
    return false;
  }

  return !productionFileExcludes.some((suffix) => filePath.endsWith(suffix));
}

function validateFileName(filePath) {
  const fileName = path.basename(filePath, path.extname(filePath));
  if (allowedFileBaseNames.has(fileName)) {
    return null;
  }

  const segments = fileName.split('.');
  for (const segment of segments) {
    if (!fileSegmentPattern.test(segment)) {
      return `Non-camelCase source file name: ${path.relative(projectRootPath, filePath)}`;
    }
  }

  return null;
}

function validateConsoleUsage(filePath, source) {
  if (consoleRuleExcludes.some((fragment) => filePath.includes(fragment))) {
    return null;
  }

  const match = source.match(/\bconsole\.(log|info|warn|error|debug)\s*\(/);
  if (!match) {
    return null;
  }

  return `Raw console.${match[1]} is not allowed in production code: ${path.relative(projectRootPath, filePath)}`;
}

async function main() {
  const files = await walk(srcDir);
  const errors = [];

  for (const fileUrl of files) {
    const filePath = fileUrl.pathname;
    if (!isProductionTypeScript(filePath)) {
      continue;
    }

    const fileNameError = validateFileName(filePath);
    if (fileNameError) {
      errors.push(fileNameError);
    }

    const source = await fs.readFile(fileUrl, 'utf8');
    const consoleError = validateConsoleUsage(filePath, source);
    if (consoleError) {
      errors.push(consoleError);
    }
  }

  if (errors.length > 0) {
    for (const error of errors) {
      console.error(error);
    }
    process.exitCode = 1;
    return;
  }

  console.log('Core lint passed.');
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
