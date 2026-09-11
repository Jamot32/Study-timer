import { storage } from './sessions.ts';

export const PROFILE_STORAGE_KEY = '@study_timer/profile';

/**
 * `avatar` is either a glyph from AVATARS or an image URI (http:/file:/data:),
 * so swapping in a real picture later needs no storage change.
 * `frame` is the avatar's outer line colour.
 */
export type Profile = {
  name: string;
  avatar?: string;
  title?: string;
  frame?: string;
  /** Glyphs layered on the picture, each dragged to its own spot. */
  stickers?: Sticker[];
};

export const AVATARS = ['🐱', '🦊', '🐸', '🐧', '🦉', '👾', '🌙', '⭐'];

// hex literals, not the T tokens — pixel.tsx imports react-native, which the
// node self-check cannot load.
export const FRAMES = [
  { label: 'INK', value: '#2e2218' },
  { label: 'FLAME', value: '#d95b2e' },
  { label: 'MOSS', value: '#4b7f52' },
  { label: 'SEA', value: '#2f6f9f' },
  { label: 'PLUM', value: '#7a4f9e' },
];

/**
 * `x`/`y` are 0-1 fractions of the drag range (the picture minus the sticker),
 * so a placement survives any avatar size: 0 = flush left/top, 1 = flush right/bottom.
 */
export type Sticker = { glyph: string; x: number; y: number };

/** A drag surface with dozens of stickers is a bug, not a feature. */
export const MAX_STICKERS = 8;

export const STICKERS = ['⚡', '🔥', '❄️', '🍀', '💤', '🎧', '📚', '☕', '👑', '🎯'];

export const isImageAvatar = (avatar?: string) => !!avatar && /^(https?:|file:|data:)/.test(avatar);

const str = (value: unknown) => (typeof value === 'string' && value.trim() ? value.trim() : undefined);

// Two older shapes still live in storage: a plain glyph list placed by tap order,
// and a 3x3 slot index. Both map onto fractions on read.
const LEGACY_CORNERS = [
  { x: 0, y: 0 },
  { x: 1, y: 0 },
  { x: 0, y: 1 },
  { x: 1, y: 1 },
];

export const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

const stickerList = (value: unknown): Sticker[] => {
  if (!Array.isArray(value)) return [];
  return value
    .map((item, index): Sticker | null => {
      if (typeof item === 'string') {
        const glyph = str(item);
        const corner = LEGACY_CORNERS[index];
        return glyph && corner ? { glyph, ...corner } : null;
      }
      const glyph = str(item?.glyph);
      if (!glyph) return null;
      if (Number.isInteger(item?.slot) && item.slot >= 0 && item.slot < 9) {
        return { glyph, x: (item.slot % 3) / 2, y: Math.floor(item.slot / 3) / 2 };
      }
      if (!Number.isFinite(item?.x) || !Number.isFinite(item?.y)) return null;
      return { glyph, x: clamp01(item.x), y: clamp01(item.y) };
    })
    .filter((sticker): sticker is Sticker => !!sticker)
    .slice(0, MAX_STICKERS);
  // no sort — array order is draw order and must stay stable while dragging
};

/**
 * Drops blank/unknown fields so an edit round-trips unchanged. Pure — the
 * Settings screen uses it to build the next profile before the write lands.
 */
export function normalizeProfile(input: Profile): Profile {
  const stickers = stickerList(input.stickers);
  return {
    name: input.name.trim(),
    ...(str(input.avatar) ? { avatar: input.avatar } : {}),
    ...(str(input.title) ? { title: str(input.title) } : {}),
    ...(str(input.frame) ? { frame: input.frame } : {}),
    ...(stickers.length ? { stickers } : {}),
  };
}

export async function loadProfile(): Promise<Profile | null> {
  try {
    const raw = await storage.getItem(PROFILE_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed.name !== 'string' || !parsed.name.trim()) return null;
    // only spread back the keys that are actually set — an undefined field would
    // break the deepStrictEqual round-trip checks.
    return normalizeProfile(parsed);
  } catch {
    return null;
  }
}

export async function saveProfile(input: Profile): Promise<Profile> {
  const profile = normalizeProfile(input);
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
