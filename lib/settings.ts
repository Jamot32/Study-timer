import { storage, type WeekStart } from './sessions';

export const SETTINGS_STORAGE_KEY = '@study_timer/settings';

export type Settings = {
  weekStartsOn: WeekStart;
};

export const DEFAULT_SETTINGS: Settings = {
  weekStartsOn: 1,
};

export async function loadSettings(): Promise<Settings> {
  try {
    const raw = await storage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return DEFAULT_SETTINGS;
    // Merging over the defaults doubles as the migration for added/removed keys.
    return { ...DEFAULT_SETTINGS, ...parsed };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export async function saveSettings(patch: Partial<Settings>): Promise<Settings> {
  const next = { ...(await loadSettings()), ...patch };
  try {
    await storage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(next));
  } catch (error) {
    console.error('Failed to save settings:', error);
  }
  return next;
}
