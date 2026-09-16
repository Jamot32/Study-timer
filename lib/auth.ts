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

/** Shared with the inputs (maxLength) and the validator, so they cannot drift. */
export const NAME_MAX = 20;
export const TITLE_MAX = 20;

// hex literals, not the T tokens — pixel.tsx imports react-native, which the
// node self-check cannot load.
// Free from the start; the reward frames below are gated by lib/progress.ts.
export const FRAMES = [
  { label: 'INK', value: '#2e2218' },
  { label: 'FLAME', value: '#d95b2e' },
  { label: 'MOSS', value: '#4b7f52' },
  { label: 'SEA', value: '#2f6f9f' },
  { label: 'PLUM', value: '#7a4f9e' },
  // earned — see FRAME_UNLOCKS
  { label: 'GOLD', value: '#c9a227' },
  { label: 'ROSE', value: '#c2577a' },
  { label: 'ICE', value: '#7fb6c9' },
  { label: 'VOID', value: '#3b3355' },
];

/**
 * `x`/`y` are 0-1 fractions of the drag range (the picture minus the sticker),
 * so a placement survives any avatar size: 0 = flush left/top, 1 = flush right/bottom.
 */
export type Sticker = { glyph: string; x: number; y: number };

/** A drag surface with dozens of stickers is a bug, not a feature. */
export const MAX_STICKERS = 8;

export const STICKERS = [
  '⚡',
  '🔥',
  '❄️',
  '🍀',
  '💤',
  '🎧',
  '📚',
  '☕',
  '👑',
  '🎯',
  // earned — see STICKER_UNLOCKS
  '💎',
  '🚀',
  '🧠',
  '🏆',
  '🐉',
  '🌌',
];

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
 * Lengths are clamped here as well as in the inputs: a profile restored from an
 * older build (or a hand-edited store) must still load into the current UI.
 */
export function normalizeProfile(input: Profile): Profile {
  const stickers = stickerList(input.stickers);
  const title = str(input.title);
  return {
    name: input.name.trim().slice(0, NAME_MAX),
    ...(str(input.avatar) ? { avatar: input.avatar } : {}),
    ...(title ? { title: title.slice(0, TITLE_MAX) } : {}),
    ...(str(input.frame) ? { frame: input.frame } : {}),
    ...(stickers.length ? { stickers } : {}),
  };
}

/**
 * Why a name cannot be used, or null when it can. Blank is the dangerous case:
 * loadProfile reads a blank name as "signed out", so committing one would erase
 * the profile (and with it the look) on the next launch.
 */
export function nameError(name: string): string | null {
  const trimmed = name.trim();
  if (!trimmed) return 'NAME CANNOT BE BLANK';
  if (trimmed.length > NAME_MAX) return `MAX ${NAME_MAX} CHARACTERS`;
  return null;
}

/**
 * Lifts one sticker to the end of the list. Array order is draw order, so the
 * sticker last touched ends up on top instead of hidden behind an older one.
 * Out-of-range indices return the profile untouched.
 */
export function bringStickerToFront(profile: Profile, index: number): Profile {
  const stickers = profile.stickers ?? [];
  if (index < 0 || index >= stickers.length - 1) return profile;
  const next = [...stickers];
  const [lifted] = next.splice(index, 1);
  next.push(lifted);
  return { ...profile, stickers: next };
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
  // Refuse the write rather than let a blank name read back as signed out. The
  // editor validates first; this is the backstop for any other caller.
  if (!profile.name) return profile;
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
