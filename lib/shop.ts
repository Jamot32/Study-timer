import { COUPONS, JACKPOT_PRICE, type Coupon } from './coupons';

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
  /** 목록에 보이는 짧은 요약. 자르지 않고 그대로 보여 준다. */
  tagline: string;
  /** 상세 시트에 나오는 전체 설명. */
  blurb: string;
  price: number;
  kind: ShopKind;
  /** 한 개만 가질 수 있는지. 스킨·칭호는 true, 쿠폰은 여러 장. */
  unique: boolean;
  /** 쿠폰이면 원본. 가방에서 효과를 다시 읽어 줄 때 쓴다. */
  coupon?: Coupon;
  /** 암시장이 열린 날에만 진열된다. */
  secret?: boolean;
};

/** 암시장이 열린 날 꾸밈새에 붙는 할인. */
export const SECRET_SHOP_DISCOUNT = 0.5;

/** 쿠폰 값. id → 코인. */
const COUPON_PRICES: Record<string, number> = {
  luckyGamble: JACKPOT_PRICE,
  freeEntry: 110,
  timeShield: 130,
  plunderSeal: 140,
  streakAnchor: 150,
  goldenHour: 160,
  blackMarketKey: 180,
  secretShop: 180,
  timeCapsule: 210,
};

// 운명의 주사위도 판다. 기댓값(coupons.JACKPOT_EXPECTED)이 값보다 낮게 잡혀 있어 코인 기계가 되지 않는다.
// 복리 두루마리는 팔지 않는다 — ROLL 에서 드물게만 나온다.
export const NOT_FOR_SALE: readonly string[] = ['compoundBank'];

const couponEntries: ShopEntry[] = COUPONS.map((coupon) => ({
  id: coupon.id,
  name: coupon.name,
  tagline: coupon.tagline,
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
    tagline: 'Bound-book dial',
    blurb: 'The dial dressed as a bound book. Gold leaf on the rim.',
    price: 600,
    kind: 'skin',
    unique: true,
  },
  {
    id: 'skinMidnight',
    name: 'Midnight Garden',
    tagline: 'Always-night sky',
    blurb: 'The sky over the dial stays at its darkest hour, all session long.',
    price: 450,
    kind: 'skin',
    unique: true,
  },
  {
    id: 'titleNightScholar',
    name: 'Title — Night Scholar',
    tagline: 'Shown under your name',
    blurb: 'Worn under your name, on the timer and in the rankings.',
    price: 300,
    kind: 'title',
    unique: true,
  },
  {
    id: 'titleGardener',
    name: 'Title — Quiet Gardener',
    tagline: 'Shown under your name',
    blurb: 'For the ones who show up on the slow days too.',
    price: 300,
    kind: 'title',
    unique: true,
  },
  // ---------- 암시장 전용 ----------
  {
    id: 'skinVellum',
    name: 'Vellum & Ink',
    tagline: 'Calfskin & ink dial',
    blurb: 'The dial on old calfskin, the hours written in iron-gall ink.',
    price: 900,
    kind: 'skin',
    unique: true,
    secret: true,
  },
  {
    id: 'titleArchivist',
    name: 'Title — The Archivist',
    tagline: 'A rare title',
    blurb: 'Only sold under the counter. Few hold it.',
    price: 700,
    kind: 'title',
    unique: true,
    secret: true,
  },
];

/** 가질 수 있는 모든 물건. 가방은 여기서 찾는다 — 팔지 않는 것도 ROLL 로 들어온다. */
export const CATALOG: readonly ShopEntry[] = [...couponEntries, ...cosmeticEntries];

/** 상점에는 쿠폰만 진열한다. 꾸밈새는 가방에 이미 있더라도 새로 살 수 없다. */
export const SHOP: readonly ShopEntry[] = CATALOG.filter(
  (e) => e.kind === 'coupon' && !NOT_FOR_SALE.includes(e.id)
);

/** 지금 진열대에 오르는 물건. 암시장 물건은 열린 날에만. */
export const shopShelf = (secretOpen: boolean) => SHOP.filter((e) => secretOpen || !e.secret);

/** 지금 값. 암시장이 열린 날엔 꾸밈새가 반값이다. */
export function priceOf(entry: ShopEntry, secretOpen: boolean): number {
  if (!secretOpen || entry.kind === 'coupon') return entry.price;
  return Math.round(entry.price * SECRET_SHOP_DISCOUNT);
}

export const shopById = (id: string): ShopEntry | undefined => CATALOG.find((e) => e.id === id);

export const SHOP_SECTIONS: { kind: ShopKind; title: string; hint: string }[] = [
  { kind: 'coupon', title: 'Coupons', hint: 'One use each. Stack as many as you like.' },
];
