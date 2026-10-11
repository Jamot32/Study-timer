import type { Arena } from './arena';

// ============================================================
// MATCH — 승패 판정(FP)과 정산
//
// 승패는 분이 아니라 FP 로 가른다. 이 분리가 쿠폰과 보너스가 기록을
// 오염시키지 않고 개입할 수 있는 유일한 통로다.
// 공부 시간은 여기 들어오기만 하고, 여기서 나가 기록을 바꾸는 일은 없다.
// ============================================================

/** 참가비 풀에서 태우는 비율. 상시 작동하는 주 싱크다. */
export const RAKE = 0.1;

/** 아이템(쿠폰)이 움직일 수 있는 최대치 — 기본 FP 의 30%. */
export const ITEM_CAP_RATIO = 0.3;

/**
 * 세션 하나를 끝까지 마쳤을 때 붙는 몫(기본 FP 대비)과 그 상한.
 * 브리프가 수치를 정해 두지 않아 여기서 정했다. 조정하려면 이 두 값만 만지면 된다.
 */
export const COMPLETION_BONUS_RATIO = 0.02;
export const COMPLETION_BONUS_CAP = 0.1;

/** 사전에 선언한 목표 시간을 채웠을 때(기본 FP 대비). 이것도 여기서 정한 값이다. */
export const GOAL_BONUS_RATIO = 0.1;

/** 플래티넘 위로는 랭크전에서 쿠폰을 쓰지 못한다. */
export function couponsAllowed(arena: Arena): boolean {
  return arena.id === 'bronze' || arena.id === 'silver' || arena.id === 'gold';
}

export type FpInput = {
  /** 매치에 반영된 집중 시간(초). 입장 전 공부는 여기 들어오지 않는다. */
  matchSeconds: number;
  /** 매치 중 끝까지 마친 세션 수. */
  completedSessions?: number;
  /** 사전 목표를 채웠는지. */
  goalMet?: boolean;
  /** 쿠폰이 더하려는 몫(FP). 상한을 넘으면 잘린다. */
  couponBonus?: number;
};

export type FpBreakdown = {
  base: number;
  completion: number;
  goal: number;
  /** 상한에 걸린 뒤 실제로 먹힌 쿠폰 보정. */
  coupon: number;
  /** 쿠폰이 상한에 걸려 잘려 나간 몫. 0 이면 상한에 안 닿은 것. */
  couponClipped: number;
  total: number;
};

/** 기본 FP 는 매치 반영 분 그대로다. 1분 = 1 FP. */
export function computeFp(input: FpInput): FpBreakdown {
  const base = Math.floor(Math.max(0, input.matchSeconds) / 60);

  const completion = Math.round(
    Math.min(base * COMPLETION_BONUS_CAP, base * COMPLETION_BONUS_RATIO * (input.completedSessions ?? 0))
  );
  const goal = input.goalMet ? Math.round(base * GOAL_BONUS_RATIO) : 0;

  const wanted = Math.max(0, Math.round(input.couponBonus ?? 0));
  const cap = Math.floor(base * ITEM_CAP_RATIO);
  const coupon = Math.min(wanted, cap);

  return {
    base,
    completion,
    goal,
    coupon,
    couponClipped: wanted - coupon,
    total: base + completion + goal + coupon,
  };
}

export type MatchOutcome = 'win' | 'loss' | 'draw';

export function outcomeOf(myFp: number, theirFp: number): MatchOutcome {
  if (myFp > theirFp) return 'win';
  if (myFp < theirFp) return 'loss';
  return 'draw';
}

/**
 * 시간 비례 환급률. 유효 시간을 다 채웠으면 1.
 * 무제한 방(다이아)은 기준이 될 상한이 없으니 두 사람 중 더 오래 앉은 쪽을 자로 쓴다.
 */
export function refundRatio(arena: Arena, mySeconds: number, theirSeconds: number): number {
  const limit = arena.matchSeconds ?? Math.max(mySeconds, theirSeconds);
  if (limit <= 0) return 0;
  return Math.max(0, Math.min(1, mySeconds / limit));
}

export type Settlement = {
  /** 두 사람이 낸 참가비 합. */
  pool: number;
  /** 내가 돌려받는 참가비. */
  myRefund: number;
  /** 상대가 돌려받는 참가비. */
  theirRefund: number;
  /** 태워 없애는 몫. */
  burn: number;
  /** 환급과 소각을 빼고 승자가 가져가는 몫. */
  winnerTake: number;
  /** 내 지갑의 순증감. 참가비를 이미 낸 뒤 기준. */
  myNet: number;
};

/**
 * 한 판의 정산.
 *
 * 브리프의 두 문장 — "승자 = 풀 × 0.9" 와 "패자 환급 = 참가비 × 시간비율" — 은
 * 그대로 두면 판마다 코인이 새로 생긴다(실버 예시: 100 들어오고 131 나감).
 * 그래서 순서를 정했다: **환급을 먼저 빼고, 남은 몫에서 10%를 태우고, 나머지를 승자에게.**
 * 경제가 닫히고, "패배의 대가는 덜 한 만큼"이라는 원칙도 그대로 산다.
 */
export function settleMatch(args: {
  arena: Arena;
  outcome: MatchOutcome;
  mySeconds: number;
  theirSeconds: number;
}): Settlement {
  const { arena, outcome, mySeconds, theirSeconds } = args;
  const fee = arena.entryFee;
  const pool = fee * 2;

  const myRatio = refundRatio(arena, mySeconds, theirSeconds);
  const theirRatio = refundRatio(arena, theirSeconds, mySeconds);

  // 진 쪽만 시간만큼 돌려받는다. 이긴 쪽 몫은 아래 winnerTake 로 나간다.
  let myRefund = 0;
  let theirRefund = 0;
  if (outcome === 'loss') myRefund = Math.round(fee * myRatio);
  if (outcome === 'win') theirRefund = Math.round(fee * theirRatio);
  if (outcome === 'draw') {
    myRefund = Math.round(fee * myRatio);
    theirRefund = Math.round(fee * theirRatio);
  }

  const remainder = Math.max(0, pool - myRefund - theirRefund);
  const burn = Math.round(remainder * RAKE);
  const prize = remainder - burn;

  if (outcome === 'draw') {
    // 무승부는 남은 몫을 반씩. 홀수 한 닢은 태운다.
    const half = Math.floor(prize / 2);
    return {
      pool,
      myRefund: myRefund + half,
      theirRefund: theirRefund + half,
      burn: burn + (prize - half * 2),
      winnerTake: 0,
      myNet: myRefund + half - fee,
    };
  }

  const iWon = outcome === 'win';
  return {
    pool,
    myRefund,
    theirRefund,
    burn,
    winnerTake: prize,
    myNet: (iWon ? prize : myRefund) - fee,
  };
}
