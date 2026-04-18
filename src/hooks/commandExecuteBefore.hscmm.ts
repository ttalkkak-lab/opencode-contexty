import * as path from 'path';
import { PluginInput, Hooks } from '@opencode-ai/plugin';
import { readToolLog, readToolLogBlacklist, writeToolLogBlacklist } from '../hscmm';
import { getFilePathsFromParameters, matchesGlob } from '../dcp/protectedPatterns';
import { sendIgnoredMessage } from '../dcp/ui/notification';
import { createLogger as createDCPLogger } from '../dcp/logger';
import { sessionTracker } from '../core/sessionTracker';

const BAN_HANDLED_SENTINEL = '__BAN_HANDLED__';

function normalizePathValue(value: string): string {
  return value.replaceAll('\\', '/');
}

function parseBanPath(args: string): string {
  const raw = args.trim();
  return raw.startsWith('@') ? raw.slice(1) : raw;
}

function matchesTargetPath(candidatePath: string, targetPattern: string, directory: string): boolean {
  const normalizedTarget = normalizePathValue(targetPattern);
  const normalizedTargetAbsolute = normalizePathValue(path.resolve(directory, targetPattern));
  const normalizedCandidate = normalizePathValue(candidatePath);
  const normalizedCandidateAbsolute = normalizePathValue(path.resolve(directory, candidatePath));
  const hasGlob = /[*?]/.test(normalizedTarget);

  if (hasGlob) {
    return (
      matchesGlob(normalizedCandidate, normalizedTarget) ||
      matchesGlob(normalizedCandidateAbsolute, normalizedTarget) ||
      matchesGlob(normalizedCandidateAbsolute, normalizedTargetAbsolute)
    );
  }

  const normalizedTargetDir = normalizedTarget.endsWith('/') ? normalizedTarget : `${normalizedTarget}/`;
  const normalizedTargetAbsoluteDir = normalizedTargetAbsolute.endsWith('/')
    ? normalizedTargetAbsolute
    : `${normalizedTargetAbsolute}/`;

  return (
    normalizedCandidate === normalizedTarget ||
    normalizedCandidate === normalizedTargetAbsolute ||
    normalizedCandidate.startsWith(normalizedTargetDir) ||
    normalizedCandidateAbsolute === normalizedTarget ||
    normalizedCandidateAbsolute === normalizedTargetAbsolute ||
    normalizedCandidateAbsolute.startsWith(normalizedTargetAbsoluteDir)
  );
}

export function createBanCommandHook(pluginInput: PluginInput): Hooks['command.execute.before'] {
  const logger = createDCPLogger(false);

  return async (input) => {
    sessionTracker.setSessionId(input.sessionID);
    if (input.command === 'ban') {
      const targetPath = parseBanPath(input.arguments);

      if (targetPath.length === 0) {
        await sendIgnoredMessage(
          pluginInput.client,
          input.sessionID,
          'Usage: /ban @<file-or-directory-path>',
          {},
          logger,
        );
        throw new Error(BAN_HANDLED_SENTINEL);
      }

      const [toolLogSpec, blacklistSpec] = await Promise.all([
        readToolLog(pluginInput.directory, input.sessionID),
        readToolLogBlacklist(pluginInput.directory, input.sessionID),
      ]);

      const matchedIds: string[] = [];

      for (const part of toolLogSpec.parts) {
        const filePaths = getFilePathsFromParameters(part.tool, part.state.input);
        if (
          filePaths.some((filePath) => matchesTargetPath(filePath, targetPath, pluginInput.directory))
        ) {
          matchedIds.push(part.id);
        }
      }

      const mergedIds = Array.from(new Set([...blacklistSpec.ids, ...matchedIds])).sort((a, b) => a.localeCompare(b));
      await writeToolLogBlacklist(pluginInput.directory, input.sessionID, { ids: mergedIds });

      const addedCount = matchedIds.filter((id) => !blacklistSpec.ids.includes(id)).length;
      const text = addedCount > 0
        ? `Added ${addedCount} part id(s) to blacklist for @${targetPath}. Hidden parts are excluded on next context load.`
        : matchedIds.length === 0
          ? `No matching tool parts were found in this session for @${targetPath}. Read/edit that file in this session first, then run /ban again.`
          : `All matching part ids for @${targetPath} are already blacklisted.`;

      await sendIgnoredMessage(pluginInput.client, input.sessionID, text, {}, logger);
      throw new Error(BAN_HANDLED_SENTINEL);
    }
  };
}
