import { MIN_SESSION_MS, storage, type WeekStart } from './sessions';

export const SETTINGS_STORAGE_KEY = '@study_timer/settings';

export type Settings = {
  weekStartsOn: WeekStart;
  minSessionMs: number; // sessions shorter than this are discarded
};

export const DEFAULT_SETTINGS: Settings = {
  weekStartsOn: 1,
  minSessionMs: MIN_SESSION_MS,
};

export const MIN_SESSION_CHOICES = [
  { label: '30s', value: 30000 },
  { label: '1 min', value: 60000 },
  { label: '5 min', value: 300000 },
];

export function minSessionLabel(ms: number): string {
  return (
    MIN_SESSION_CHOICES.find((c) => c.value === ms)?.label ?? `${Math.round(ms / 1000)}s`
  );
}

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
