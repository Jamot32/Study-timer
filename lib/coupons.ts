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
    effect: 'Every midnight your coins grow five percent. Only on days you studied thirty minutes.',
  },
  {
    id: 'secretShop',
    name: 'Black Market Key',
    quote: 'SECRETS OPEN ONLY TO THOSE WHO ARE READY.',
    who: '',
    effect: 'The hidden bookshop opens for one day. Rare titles and skins at half price.',
  },
];

/** 주사위 쿠폰이 즉시 주는 코인. 50~500 사이에서 10 단위로 떨어진다. */
export const JACKPOT_MIN = 50;
export const JACKPOT_MAX = 500;

export function jackpotCoins(seed: number): number {
  const steps = (JACKPOT_MAX - JACKPOT_MIN) / 10; // 45
  return JACKPOT_MIN + (Math.abs(seed) % (steps + 1)) * 10;
}
