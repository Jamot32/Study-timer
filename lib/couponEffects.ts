import type { CouponId } from './coupons';

// ============================================================
// COUPON EFFECTS — 쿠폰이 실제로 무슨 일을 하는지
// 저장소를 읽지 않는 순수 규칙만 둔다. 지갑에 반영하는 건 lib/inventory 다.
//
// 쿠폰은 쓰는 길에 따라 네 갈래다.
//  · 판 쿠폰(slot)  — 배틀 슬롯에 끼워 판에 들고 들어간다. 입장하는 순간 한 장 빠진다.
//  · 가방 쿠폰(use) — 가방에서 직접 꺼내 쓴다. 며칠에 걸쳐 효과가 돈다.
//  · 지킴이(passive) — 들고만 있으면 연속 기록이 끊길 때 알아서 한 장 쓴다.
//  · 즉시(instant)  — ROLL 에서 나오면 그 자리에서 코인으로 바뀐다. 상점에서 산 것은 가방에서 굴린다.
// ============================================================

export type CouponUse = 'slot' | 'use' | 'passive' | 'instant';

export const COUPON_USE: Record<CouponId, CouponUse> = {
  timeShield: 'slot',
  goldenHour: 'slot',
  plunderSeal: 'slot',
  freeEntry: 'slot',
  timeCapsule: 'use',
  compoundBank: 'use',
  secretShop: 'use',
  streakAnchor: 'passive',
  luckyGamble: 'instant',
};

/** 랭크전에서만 뜻이 있는 판 쿠폰. 솔로에는 걸 판돈도 상대도 없다. */
const DUEL_ONLY: readonly CouponId[] = ['timeShield', 'plunderSeal', 'freeEntry'];

/**
 * 이번 판에 실제로 먹히는 쿠폰.
 * 장착했고, 아직 들고 있고, 이 판에서 뜻이 있는 것만 남긴다.
 * @param allowed 랭크전에서 쿠폰이 허용되는 방인지 (match.couponsAllowed)
 */
export function activeMatchCoupons(args: {
  equipped: (string | null)[];
  items: Record<string, number>;
  solo: boolean;
  allowed: boolean;
}): CouponId[] {
  if (!args.solo && !args.allowed) return [];
  const out: CouponId[] = [];
  for (const id of args.equipped) {
    if (!id || !(id in COUPON_USE)) continue;
    const coupon = id as CouponId;
    if (COUPON_USE[coupon] !== 'slot') continue;
    if ((args.items[coupon] ?? 0) <= 0) continue;
    if (args.solo && DUEL_ONLY.includes(coupon)) continue;
    if (!out.includes(coupon)) out.push(coupon);
  }
  return out;
}

// ---------- 랭크전 정산 ----------

/** 약탈 인장이 상대 손실에 얹는 비율. */
export const PLUNDER_RATIO = 0.5;

export type DuelCouponResult = {
  /** 참가비 중 실제로 지갑에서 나간 몫. 자유 이용권이면 0. */
  entryPaid: number;
  /** 시간의 방패가 더 돌려준 몫. */
  shieldRefund: number;
  /** 약탈 인장이 더 가져온 몫. */
  plunder: number;
};

/**
 * 판 쿠폰이 정산에 얹는 몫. 정산(settleMatch) 자체는 건드리지 않는다 —
 * 풀은 그대로 닫히고, 쿠폰이 주는 몫은 그 바깥에서 새로 들어온다.
 */
export function duelCouponEffects(args: {
  coupons: readonly CouponId[];
  outcome: 'win' | 'loss' | 'draw';
  entryFee: number;
  myRefund: number;
  theirRefund: number;
}): DuelCouponResult {
  const has = (id: CouponId) => args.coupons.includes(id);
  const fee = args.entryFee;
  return {
    entryPaid: has('freeEntry') ? 0 : fee,
    // 지면 낸 만큼 전부 돌아온다. 시간 환급으로 이미 받은 몫은 빼고.
    shieldRefund:
      has('timeShield') && args.outcome === 'loss' ? Math.max(0, fee - args.myRefund) : 0,
    // 상대가 이 판에서 잃은 몫의 절반을 더 가져온다.
    plunder:
      has('plunderSeal') && args.outcome === 'win'
        ? Math.round(Math.max(0, fee - args.theirRefund) * PLUNDER_RATIO)
        : 0,
  };
}

/**
 * 황금 시간: 세션이 번 분을 한 번 더 준다. 첫 세션 보너스는 두 번 주지 않는다.
 * 지갑 상한을 넘는 몫은 명예로 간다.
 */
export function goldenHourBonus(args: {
  sessionCoins: number;
  firstSessionBonus: number;
  walletRoom: number;
}): { coins: number; honor: number } {
  const extra = Math.max(0, args.sessionCoins - args.firstSessionBonus);
  const coins = Math.min(extra, Math.max(0, args.walletRoom));
  return { coins, honor: extra - coins };
}

// ---------- 날짜 ----------
// 키는 lib/sessions 의 dayKey 와 같은 로컬 YYYY-MM-DD.

export function addDays(key: string, n: number): string {
  const [y, m, d] = key.split('-').map(Number);
  const date = new Date(y, m - 1, d + n);
  const mm = `${date.getMonth() + 1}`.padStart(2, '0');
  const dd = `${date.getDate()}`.padStart(2, '0');
  return `${date.getFullYear()}-${mm}-${dd}`;
}

/** from 에서 to 까지 며칠. to 가 앞이면 0. */
export function daysBetween(from: string, to: string): number {
  let n = 0;
  while (addDays(from, n) < to) n += 1;
  return n;
}

// ---------- 뽑기권 ----------

/**
 * 하루에 한 장씩 쌓이는 ROLL 뽑기권. 안 쓰면 그대로 쌓인다.
 * lastDay 는 마지막으로 뽑기권을 받은 날. 처음이면 오늘 몫 한 장부터.
 */
export function accrueRollTickets(
  tickets: number,
  lastDay: string | null,
  today: string
): { tickets: number; lastDay: string } {
  if (!lastDay) return { tickets: tickets + 1, lastDay: today };
  return { tickets: tickets + daysBetween(lastDay, today), lastDay: lastDay < today ? today : lastDay };
}

// ---------- 타임캡슐 ----------

export const CAPSULE_DAYS = 3;
export const CAPSULE_DAILY_MINUTES = 60;

export type CapsuleVerdict = 'open' | 'won' | 'broken';

/**
 * 봉인한 날부터 사흘. 하루라도 한 시간을 못 채우고 지나가면 깨진다.
 * 사흘이 다 지나야 열린다 — 셋째 날 밤이 넘어가기 전에는 아직 진행 중이다.
 */
export function capsuleVerdict(
  startDay: string,
  today: string,
  minutesOn: (day: string) => number
): CapsuleVerdict {
  for (let i = 0; i < CAPSULE_DAYS; i++) {
    const day = addDays(startDay, i);
    if (day >= today) return 'open';
    if (minutesOn(day) < CAPSULE_DAILY_MINUTES) return 'broken';
  }
  return 'won';
}

// ---------- 복리 두루마리 ----------

export const COMPOUND_NIGHTS = 3;
export const COMPOUND_RATE = 0.05;
export const COMPOUND_MIN_MINUTES = 30;

/**
 * 지나간 자정들을 하나씩 정산한다. 그날 30분을 채웠으면 잔고가 5% 자란다.
 * 지갑 상한을 넘는 몫은 명예로 간다.
 * @returns 정산 뒤 잔고·명예 증가분, 어디까지 정산했는지, 두루마리가 다 됐는지
 */
export function settleCompound(args: {
  startDay: string;
  settledThrough: string | null;
  today: string;
  coins: number;
  walletCap: number;
  minutesOn: (day: string) => number;
}): { coins: number; honor: number; settledThrough: string | null; done: boolean } {
  let coins = args.coins;
  let honor = 0;
  let settled = args.settledThrough;
  const last = addDays(args.startDay, COMPOUND_NIGHTS - 1);
  let day = settled ? addDays(settled, 1) : args.startDay;
  while (day < args.today && day <= last) {
    if (args.minutesOn(day) >= COMPOUND_MIN_MINUTES) {
      const growth = Math.round(coins * COMPOUND_RATE);
      const room = Math.max(0, args.walletCap - coins);
      const kept = Math.min(growth, room);
      coins += kept;
      honor += growth - kept;
    }
    settled = day;
    day = addDays(day, 1);
  }
  return { coins, honor, settledThrough: settled, done: settled !== null && settled >= last };
}

// ---------- 연속 기록 ----------

/** 이만큼 공부한 날이 하루로 친다. 코인이 붙는 최소 세션과 같다. */
export const STREAK_DAY_MINUTES = 10;
/** 이보다 짧은 연속은 닻을 쓰지 않는다. 하루짜리를 지키느라 한 장을 태우지 않게. */
export const ANCHOR_MIN_STREAK = 2;

/**
 * 오늘(또는 아직 오늘을 안 했으면 어제)까지 이어진 연속 공부 일수.
 * 닻으로 메운 날(patched)도 공부한 날로 친다.
 */
export function studyStreak(
  today: string,
  minutesOn: (day: string) => number,
  patched: readonly string[] = []
): number {
  const counts = (day: string) => patched.includes(day) || minutesOn(day) >= STREAK_DAY_MINUTES;
  return runEndingAt(counts(today) ? today : addDays(today, -1), counts);
}

/** day 부터 거꾸로 끊기지 않고 이어진 날 수. day 자체가 비었으면 0. */
function runEndingAt(day: string, counts: (day: string) => boolean): number {
  let n = 0;
  while (counts(day)) {
    n += 1;
    day = addDays(day, -1);
  }
  return n;
}

/**
 * 어제를 비웠는데 그 전까지 이어 오던 연속이 있으면, 닻이 메울 날(어제)을 돌려준다.
 * 메울 것이 없으면 null.
 */
export function dayToAnchor(
  today: string,
  minutesOn: (day: string) => number,
  patched: readonly string[] = []
): string | null {
  const counts = (day: string) => patched.includes(day) || minutesOn(day) >= STREAK_DAY_MINUTES;
  const yesterday = addDays(today, -1);
  if (counts(yesterday)) return null;
  return runEndingAt(addDays(today, -2), counts) >= ANCHOR_MIN_STREAK ? yesterday : null;
}
