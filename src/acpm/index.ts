import path from 'path';
import { PermissionEvaluator } from './evaluator';
import { PermissionStorage } from './storage';
import type { PermissionsFile, Preset } from './types';

const defaultPermissionsFile = (): PermissionsFile => ({
  version: 1,
  presets: [],
});

export class ACPMModule {
  private readonly storage: PermissionStorage;
  private readonly ready: Promise<void>;
  private activePreset: Preset | null = null;
  private evaluator: PermissionEvaluator = new PermissionEvaluator(null);

  constructor(baseDir: string, defaultPresetName?: string) {
    this.storage = new PermissionStorage(path.resolve(baseDir));
    this.ready = this.initialize(defaultPresetName);
  }

  private async initialize(defaultPresetName?: string): Promise<void> {
    try {
      await this.storage.ensurePermissionsFile();

      if (defaultPresetName) {
        await this.loadPresetInternal(defaultPresetName);
      }
    } catch {
      this.setActivePreset(null);
    }
  }

  private async ensureReady(): Promise<void> {
    await this.ready;
  }

  private setActivePreset(preset: Preset | null): void {
    this.activePreset = preset;
    this.evaluator = new PermissionEvaluator(preset);
  }

  async loadPreset(presetName: string): Promise<void> {
    await this.ensureReady();
    await this.loadPresetInternal(presetName);
  }

  private async loadPresetInternal(presetName: string): Promise<void> {
    
    try {
      const permissionsFile = await this.storage.readPresets();
      const preset = permissionsFile.presets.find((entry) => entry.name === presetName) ?? null;
      this.setActivePreset(preset);
    } catch {
      this.setActivePreset(null);
    }
  }

  getActivePreset(): Preset | null {
    return this.activePreset;
  }

  async listPresets(): Promise<Preset[]> {
    await this.ensureReady();

    try {
      const permissionsFile = await this.storage.readPresets();
      return permissionsFile.presets;
    } catch {
      return defaultPermissionsFile().presets;
    }
  }

  async createPreset(preset: Preset): Promise<void> {
    await this.ensureReady();

    const permissionsFile = await this.storage.readPresets();
    const nextPresets = permissionsFile.presets.filter((entry) => entry.name !== preset.name);
    nextPresets.push(preset);
    await this.storage.writePresets({ ...permissionsFile, presets: nextPresets });

    if (this.activePreset?.name === preset.name) {
      this.setActivePreset(preset);
    }
  }

  async updatePreset(name: string, preset: Preset): Promise<void> {
    await this.ensureReady();

    const permissionsFile = await this.storage.readPresets();
    let found = false;
    const nextPresets = permissionsFile.presets.map((entry) => {
      if (entry.name !== name) {
        return entry;
      }

      found = true;
      return preset;
    });

    if (!found) {
      nextPresets.push(preset);
    }

    await this.storage.writePresets({ ...permissionsFile, presets: nextPresets });

    if (this.activePreset?.name === name) {
      this.setActivePreset(preset);
    }
  }

  async deletePreset(name: string): Promise<void> {
    await this.ensureReady();

    const permissionsFile = await this.storage.readPresets();
    const nextPresets = permissionsFile.presets.filter((entry) => entry.name !== name);
    await this.storage.writePresets({ ...permissionsFile, presets: nextPresets });

    if (this.activePreset?.name === name) {
      this.setActivePreset(null);
    }
  }

  getEvaluator(): PermissionEvaluator {
    return this.evaluator;
  }
}
