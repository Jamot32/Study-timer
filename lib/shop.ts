import { COUPONS, type Coupon } from './coupons';

// ============================================================
// SHOP — 코인으로 사는 것들
// 쿠폰은 ROLL 로 공짜로 뽑기도 하지만, 필요한 걸 바로 집고 싶을 땐 여기서 산다.
// 값은 효과의 무게를 따른다 — 한 판을 통째로 지켜 주는 것일수록 비싸다.
// 꾸밈새(스킨·칭호)는 한 번 사면 끝이라 unique 다.
// ============================================================

export type ShopKind = 'coupon' | 'skin' | 'title';

export type ShopEntry = {
  id: string;
  name: string;
  blurb: string;
  price: number;
  kind: ShopKind;
  /** 한 개만 가질 수 있는지. 스킨·칭호는 true, 쿠폰은 여러 장. */
  unique: boolean;
  /** 쿠폰이면 원본. 가방에서 효과를 다시 읽어 줄 때 쓴다. */
  coupon?: Coupon;
};

/** 쿠폰 값. id → 코인. */
const COUPON_PRICES: Record<string, number> = {
  luckyGamble: 90,
  freeEntry: 110,
  timeShield: 130,
  plunderSeal: 140,
  streakAnchor: 150,
  goldenHour: 160,
  blackMarketKey: 180,
  secretShop: 180,
  timeCapsule: 210,
  compoundBank: 260,
};

const couponEntries: ShopEntry[] = COUPONS.map((coupon) => ({
  id: coupon.id,
  name: coupon.name,
  blurb: coupon.effect,
  price: COUPON_PRICES[coupon.id] ?? 150,
  kind: 'coupon',
  unique: false,
  coupon,
}));

const cosmeticEntries: ShopEntry[] = [
  {
    id: 'skinHardback',
    name: 'Hardback Timer',
    blurb: 'The dial dressed as a bound book. Gold leaf on the rim.',
    price: 600,
    kind: 'skin',
    unique: true,
  },
  {
    id: 'skinMidnight',
    name: 'Midnight Garden',
    blurb: 'The sky over the dial stays at its darkest hour, all session long.',
    price: 450,
    kind: 'skin',
    unique: true,
  },
  {
    id: 'titleNightScholar',
    name: 'Title — Night Scholar',
    blurb: 'Worn under your name, on the timer and in the rankings.',
    price: 300,
    kind: 'title',
    unique: true,
  },
  {
    id: 'titleGardener',
    name: 'Title — Quiet Gardener',
    blurb: 'For the ones who show up on the slow days too.',
    price: 300,
    kind: 'title',
    unique: true,
  },
];

export const SHOP: readonly ShopEntry[] = [...couponEntries, ...cosmeticEntries];

export const shopById = (id: string): ShopEntry | undefined => SHOP.find((e) => e.id === id);

export const SHOP_SECTIONS: { kind: ShopKind; title: string; hint: string }[] = [
  { kind: 'coupon', title: 'Coupons', hint: 'One use each. Stack as many as you like.' },
  { kind: 'skin', title: 'Timer skins', hint: 'Changes how the dial looks. Yours for good.' },
  { kind: 'title', title: 'Titles', hint: 'Shown under your name.' },
];
