import { tool } from '@opencode-ai/plugin';
import type { ACPMModule } from '../acpm';

export function createAcpmTool(acpm: ACPMModule): ReturnType<typeof tool> {
  return tool({
    description:
      'ACPM - Permission management. Commands: status, list, switch <name>, reload',
    args: {
      command: tool.schema.enum(['status', 'list', 'switch', 'reload']),
      name: tool.schema.string().optional(),
    },
    async execute(args, _context) {
      try {
        switch (args.command) {
          case 'status': {
            const preset = acpm.getActivePreset();
            if (!preset) {
              return JSON.stringify({ active: null, message: 'No active preset' });
            }
            return JSON.stringify({
              active: preset.name,
              folderPermissions: preset.folderPermissions,
              toolPermissions: preset.toolPermissions,
            });
          }

          case 'list': {
            const presets = await acpm.listPresets();
            const active = acpm.getActivePreset();
            return JSON.stringify({
              presets: presets.map((p) => ({
                name: p.name,
                active: p.name === active?.name,
                folders: p.folderPermissions.length,
                tools: p.toolPermissions.length,
              })),
            });
          }

          case 'switch': {
            if (!args.name) {
              return JSON.stringify({ error: 'name is required for switch command' });
            }
            await acpm.loadPreset(args.name);
            const loaded = acpm.getActivePreset();
            return JSON.stringify({
              switched: args.name,
              loaded: loaded?.name ?? null,
            });
          }

          case 'reload': {
            const activeName = acpm.getActivePreset()?.name;
            if (activeName) {
              await acpm.loadPreset(activeName);
            }
            return JSON.stringify({ reloaded: true, activePreset: activeName });
          }
        }
      } catch (error) {
        return JSON.stringify({
          error: error instanceof Error ? error.message : String(error),
        });
      }
    },
  });
}
