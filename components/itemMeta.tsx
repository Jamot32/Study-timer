import {
  Anchor,
  Award,
  Crown,
  Dices,
  KeyRound,
  Package,
  Palette,
  PiggyBank,
  Shield,
  Sunrise,
  Ticket,
  type LucideIcon,
} from 'lucide-react-native';
import { COUPON_USE } from '@/lib/couponEffects';
import type { ShopEntry } from '@/lib/shop';

// ============================================================
// ITEM META — 물건마다 붙는 아이콘과 "어떻게 쓰는지"
// 이름을 다 읽지 않아도 아이콘으로 훑을 수 있게. Shop · Bag · 배틀 슬롯이 같은 표를 본다.
// ============================================================

const COUPON_ICONS: Record<string, LucideIcon> = {
  timeShield: Shield,
  goldenHour: Sunrise,
  plunderSeal: Crown,
  luckyGamble: Dices,
  streakAnchor: Anchor,
  freeEntry: Ticket,
  timeCapsule: Package,
  compoundBank: PiggyBank,
  secretShop: KeyRound,
};

export function itemIcon(entry: ShopEntry): LucideIcon {
  if (entry.coupon) return COUPON_ICONS[entry.coupon.id] ?? Ticket;
  return entry.kind === 'skin' ? Palette : Award;
}

/** 물건을 쓰는 방식. 목록을 이 기준으로 묶는다. */
export type ItemGroup = 'slot' | 'use' | 'instant' | 'passive' | 'skin' | 'title';

export function itemGroupOf(entry: ShopEntry): ItemGroup {
  if (entry.coupon) return COUPON_USE[entry.coupon.id];
  return entry.kind === 'skin' ? 'skin' : 'title';
}

/**
 * 묶음 이름과 한 줄 안내.
 * 슬롯 쿠폰은 배틀만이 아니라 솔로에도 들고 들어간다(골든 아워가 그렇다) — 그래서 'For battles' 가 아니다.
 */
export const ITEM_GROUPS: { key: ItemGroup; title: string; hint: string; howTo: string }[] = [
  {
    key: 'slot',
    title: 'Equip in a slot',
    hint: 'Spent when you start a battle or solo.',
    howTo: 'Equip it in one of the two coupon slots on the Battle screen. It is spent when you start your next battle or solo session.',
  },
  {
    key: 'use',
    title: 'Use from the bag',
    hint: 'Starts working the moment you use it.',
    howTo: 'Open your Bag and tap Use. The effect starts right away and runs on its own.',
  },
  {
    key: 'instant',
    title: 'Instant',
    hint: 'Turns into coins on the spot.',
    howTo: 'Roll it from your Bag — coins land in your wallet immediately.',
  },
  {
    key: 'passive',
    title: 'Automatic',
    hint: 'Kicks in on its own when you need it.',
    howTo: 'Just keep it in your Bag. It is spent automatically the moment it is needed.',
  },
  {
    key: 'skin',
    title: 'Timer skins',
    hint: 'Changes how the dial looks. Yours for good.',
    howTo: 'Yours for good once bought.',
  },
  {
    key: 'title',
    title: 'Titles',
    hint: 'Shown under your name.',
    howTo: 'Yours for good once bought. Shown under your name.',
  },
];

export const groupInfo = (key: ItemGroup) => ITEM_GROUPS.find((g) => g.key === key)!;
