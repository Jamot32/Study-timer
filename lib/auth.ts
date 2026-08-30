import { storage } from './sessions.ts';

export const PROFILE_STORAGE_KEY = '@study_timer/profile';

export type Profile = { name: string };

export async function loadProfile(): Promise<Profile | null> {
  try {
    const raw = await storage.getItem(PROFILE_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed.name !== 'string' || !parsed.name.trim()) return null;
    return { name: parsed.name };
  } catch {
    return null;
  }
}

export async function saveProfile(name: string): Promise<Profile> {
  const profile = { name: name.trim() };
  try {
    await storage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(profile));
  } catch (error) {
    console.error('Failed to save profile:', error);
  }
  return profile;
}

export async function clearProfile(): Promise<void> {
  try {
    await storage.removeItem(PROFILE_STORAGE_KEY);
  } catch (error) {
    console.error('Failed to clear profile:', error);
  }
}
