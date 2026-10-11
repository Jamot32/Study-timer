// ============================================================
// COUPONS — ROLL 로 뽑는 특전
// 책을 펴면 절반은 그냥 '쉴 시간'(랭크에 따라 액수가 다름),
// 절반은 여기 있는 쿠폰 하나가 나온다.
// 쿠폰마다 왼쪽 쪽에 실릴 명언이 정해져 있다 — 보상과 짝이 맞는 문장이다.
//
// 책은 세리프(Fraunces)로 찍히고 그 글꼴에는 한글 자소가 없다.
// 그래서 쪽에 적히는 글은 앱의 다른 화면과 같이 영문으로 둔다.
// ============================================================

export type CouponId =
  | 'timeShield'
  | 'goldenHour'
  | 'plunderSeal'
  | 'luckyGamble'
  | 'streakAnchor'
  | 'freeEntry'
  | 'timeCapsule'
  | 'compoundBank'
  | 'secretShop';

export type Coupon = {
  id: CouponId;
  /** 쪽에 찍히는 이름. */
  name: string;
  /** 왼쪽 쪽에 실리는 명언. 대문자 — 다른 명언들과 같은 결. */
  quote: string;
  /** 말한 이. 없으면 빈 문자열. */
  who: string;
  /** 오른쪽 쪽에 적히는 효과. 두세 줄로 접힌다. */
  effect: string;
  /** 즉시 받는 보상인지(true) 다음 판·다음 세션까지 들고 가는지(false). */
  instant?: boolean;
};

export const COUPONS: readonly Coupon[] = [
  {
    id: 'timeShield',
    name: 'Time Shield',
    quote: 'FAILURE IS SIMPLY THE CHANCE TO BEGIN AGAIN.',
    who: 'HENRY FORD',
    effect: 'Lose your next duel and it costs you nothing. Your stake comes back to you.',
  },
  {
    id: 'goldenHour',
    name: 'Golden Hour',
    quote: 'TIME IS THE MOST VALUABLE THING A MAN CAN SPEND.',
    who: 'THEOPHRASTUS',
    effect: 'Your next finished session pays double. Every minute of focus earns two H-Coin.',
  },
  {
    id: 'plunderSeal',
    name: 'Plunder Seal',
    quote: 'WINNERS FIND A WAY. LOSERS FIND AN EXCUSE.',
    who: '',
    effect: 'Win your next duel and take fifty percent more coins off your rival.',
  },
  {
    id: 'luckyGamble',
    name: 'Dice of Fate',
    quote: 'THE DIE IS CAST.',
    who: 'JULIUS CAESAR',
    effect: 'Paid on the spot. The dice decide how much.',
    instant: true,
  },
  {
    id: 'streakAnchor',
    name: 'Anchor of Time',
    quote: 'WHATEVER YOU CAN DO, BEGIN IT TODAY.',
    who: 'GOETHE',
    effect: 'Break a study streak or a winning run and this puts it back. Once.',
  },
  {
    id: 'freeEntry',
    name: 'Ticket of Freedom',
    quote: 'NOTHING VENTURED, NOTHING GAINED.',
    who: '',
    effect: 'Enter your next ranked duel without staking a coin. Win and the reward is the same.',
  },
  {
    id: 'timeCapsule',
    name: 'Time Capsule',
    quote: 'THE BEST WAY TO PREDICT THE FUTURE IS TO CREATE IT.',
    who: 'PETER DRUCKER',
    effect: 'Sealed for three days. Study an hour a day and the hardback timer skin is yours.',
  },
  {
    id: 'compoundBank',
    name: 'Compound Scroll',
    quote: 'MANY GRAINS OF DUST MAKE A MOUNTAIN.',
    who: '',
    effect: 'For three nights your coins grow five percent at midnight. Only on days you studied thirty minutes.',
  },
  {
    id: 'secretShop',
    name: 'Black Market Key',
    quote: 'SECRETS OPEN ONLY TO THOSE WHO ARE READY.',
    who: '',
    effect: 'The hidden bookshop opens for one day. Rare titles and skins at half price.',
  },
];

/**
 * ROLL 에서 쿠폰이 나올 때 어떤 쿠폰일지의 무게. 클수록 자주 나온다.
 * 복리 두루마리는 상점에서 팔지 않는 귀한 물건이라 아주 드물게만 나온다
 * (쿠폰이 나온 판의 약 1%, ROLL 한 번 기준 약 0.5%).
 */
export const ROLL_WEIGHTS: Record<CouponId, number> = {
  timeShield: 12,
  goldenHour: 12,
  plunderSeal: 12,
  luckyGamble: 12,
  streakAnchor: 12,
  freeEntry: 12,
  timeCapsule: 12,
  secretShop: 12,
  compoundBank: 1,
};
const ROLL_TOTAL = Object.values(ROLL_WEIGHTS).reduce((sum, w) => sum + w, 0);

/** ROLL 에서 나올 쿠폰을 무게대로 고른다. 같은 씨앗이면 같은 쿠폰. */
export function rollCoupon(seed: number): Coupon {
  let roll = Math.abs(Math.floor(seed)) % ROLL_TOTAL;
  for (const coupon of COUPONS) {
    const weight = ROLL_WEIGHTS[coupon.id];
    if (roll < weight) return coupon;
    roll -= weight;
  }
  return COUPONS[0];
}

/**
 * 주사위 쿠폰의 눈. 무게(100 중 몇)만큼 자주 나온다.
 * 대개 작게 떨어지고 가끔 크게 터진다 — 기댓값은 77 로, 상점 값(90)보다 낮다.
 * 사서 굴리면 평균적으로 조금 손해, 운이 좋으면 크게 남는 도박이다.
 */
export const JACKPOT_FACES: readonly { coins: number; weight: number }[] = [
  { coins: 20, weight: 30 },
  { coins: 40, weight: 25 },
  { coins: 60, weight: 20 },
  { coins: 100, weight: 13 },
  { coins: 200, weight: 8 },
  { coins: 500, weight: 4 },
];
const JACKPOT_TOTAL = JACKPOT_FACES.reduce((sum, face) => sum + face.weight, 0);

/** 상점에서 주사위 한 장의 값. 기댓값보다 높아야 코인 기계가 되지 않는다. */
export const JACKPOT_PRICE = 90;

export const JACKPOT_EXPECTED =
  JACKPOT_FACES.reduce((sum, face) => sum + face.coins * face.weight, 0) / JACKPOT_TOTAL;

export function jackpotCoins(seed: number): number {
  let roll = Math.abs(Math.floor(seed)) % JACKPOT_TOTAL;
  for (const face of JACKPOT_FACES) {
    if (roll < face.weight) return face.coins;
    roll -= face.weight;
  }
  return JACKPOT_FACES[0].coins;
}
