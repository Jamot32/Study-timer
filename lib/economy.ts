// ============================================================
// ECONOMY — 코인이 들어오고 나가는 규칙
//
// 앵커: 1 코인 = 집중 1분. 모든 가격표는 유저 머릿속에서 시간으로 번역된다.
// 그래서 코인으로 가는 지름길(광고 → 코인)을 두지 않는다. 시간만이 입구다.
//
// 공부 시간 자체는 여기서 절대 건드리지 않는다. 이 파일은 "얼마를 줄지"만 정한다.
// ============================================================

/** 이보다 짧은 세션은 코인이 0. 기록에는 1초 단위로 전부 남는다. */
export const MIN_PAID_MINUTES = 10;

/** 오늘 첫 10분 세션을 끝냈을 때 한 번 주는 몫. 로그인만으로는 주지 않는다. */
export const FIRST_SESSION_BONUS = 30;

// 참가비 레이크(소각)는 실제로 적용되는 곳인 match.ts 에 있다.

/** 세션을 길게 끌고 갈수록 붙는 배수. */
const COMPLETION_TIERS: { minutes: number; multiplier: number }[] = [
  { minutes: 90, multiplier: 1.4 },
  { minutes: 50, multiplier: 1.3 },
  { minutes: 25, multiplier: 1.2 },
];

export function completionMultiplier(minutes: number): number {
  for (const tier of COMPLETION_TIERS) if (minutes >= tier.minutes) return tier.multiplier;
  return 1;
}

/**
 * 하루 누적에 따라 1분이 몇 코인짜리인지.
 * 많이 공부할수록 분당 값이 떨어지지만 0 이 되지는 않는다 —
 * 깎인 몫은 사라지지 않고 명예 포인트로 간다. "많이 하면 손해"를 만들지 않기 위함.
 */
const DAILY_BANDS: { upTo: number; rate: number }[] = [
  { upTo: 180, rate: 1 },
  { upTo: 360, rate: 0.6 },
  { upTo: Infinity, rate: 0.3 },
];

export function bandRate(minuteIndex: number): number {
  for (const band of DAILY_BANDS) if (minuteIndex < band.upTo) return band.rate;
  return DAILY_BANDS[DAILY_BANDS.length - 1].rate;
}

export type SessionPayout = {
  /** 지갑에 들어갈 코인. */
  coins: number;
  /** 소프트캡과 지갑 상한에 걸려 코인 대신 쌓이는 몫. */
  honor: number;
  /** 화면에 계산 과정을 보여 주기 위한 내역. */
  breakdown: {
    minutes: number;
    paidMinutes: number;
    multiplier: number;
    /** 소프트캡을 통과한 실질 분. */
    weightedMinutes: number;
    firstSessionBonus: number;
    /** 지갑 상한에 걸려 넘어간 몫. */
    overflow: number;
  };
};

/**
 * 세션 하나가 얼마가 되는지.
 * @param minutes            이번 세션의 집중 분
 * @param minutesEarnedToday 오늘 이미 인정받은 분 (소프트캡 기준점)
 * @param opts.firstSessionToday 오늘 첫 유효 세션인지
 * @param opts.walletRoom    지갑 상한까지 남은 자리. 넘치면 명예로 간다.
 */
export function sessionPayout(
  minutes: number,
  minutesEarnedToday: number,
  opts: { firstSessionToday?: boolean; walletRoom?: number } = {}
): SessionPayout {
  const whole = Math.floor(Math.max(0, minutes));
  const empty: SessionPayout = {
    coins: 0,
    honor: 0,
    breakdown: {
      minutes: whole,
      paidMinutes: 0,
      multiplier: 1,
      weightedMinutes: 0,
      firstSessionBonus: 0,
      overflow: 0,
    },
  };
  if (whole < MIN_PAID_MINUTES) return empty;

  // 1분씩 걸어가며 그 분이 속한 구간의 비율을 매긴다. 세션이 구간 경계를 넘어가도 정확하다.
  let weighted = 0;
  for (let i = 0; i < whole; i++) weighted += bandRate(minutesEarnedToday + i);

  const multiplier = completionMultiplier(whole);
  const gross = whole * multiplier;
  const earned = weighted * multiplier;

  const bonus = opts.firstSessionToday ? FIRST_SESSION_BONUS : 0;
  let coins = Math.round(earned) + bonus;
  // 소프트캡에 깎인 몫
  let honor = Math.round(gross - earned);

  // 지갑 상한. 넘치는 만큼 명예로 돌린다.
  let overflow = 0;
  if (opts.walletRoom !== undefined) {
    const room = Math.max(0, opts.walletRoom);
    if (coins > room) {
      overflow = coins - room;
      coins = room;
      honor += overflow;
    }
  }

  return {
    coins,
    honor,
    breakdown: {
      minutes: whole,
      paidMinutes: whole,
      multiplier,
      weightedMinutes: Math.round(weighted),
      firstSessionBonus: bonus,
      overflow,
    },
  };
}

/**
 * 끝낸 세션 하나가 지갑에 얼마를 넣는지 — 저장소를 읽지 않는 순수 판정.
 * 화면 쪽은 값만 실어 보내고 결과를 그대로 반영하면 된다.
 *
 * studiedTodayMinutes 는 **이번 세션을 포함한** 오늘 총합이다. 소프트캡은
 * 이번 세션이 시작되던 시점의 누적을 기준으로 걸어야 하므로 여기서 빼 준다.
 */
export function payoutForFinishedSession(args: {
  minutes: number;
  studiedTodayMinutes: number;
  coins: number;
  walletCap: number;
  firstBonusDay: string | null;
  today: string;
}): SessionPayout {
  const before = Math.max(0, args.studiedTodayMinutes - args.minutes);
  return sessionPayout(args.minutes, before, {
    firstSessionToday: args.firstBonusDay !== args.today,
    walletRoom: Math.max(0, args.walletCap - args.coins),
  });
}

// ---------- 파산 대응 ----------
// 구제 퀘스트: 25분 세션 하나에 주는 몫. 평시(25분 → 30코인)의 2.6배쯤.
export const RESCUE_QUEST = { minutes: 25, coins: 80 } as const;

// 출구는 반드시 공부여야 한다. 코인으로 가는 지름길은 여기에도 두지 않는다.

/**
 * 솔로 매치 — 상대 없이 혼자 앉는 판.
 * 참가비가 없고 횟수 제한도 없다. 지갑이 비어도 여기로는 언제나 들어올 수 있고,
 * 끝내면 방 등급에 맞는 코인이 들어온다(arena.soloReward). ELO 는 움직이지 않는다.
 * 파산에서 돌아오는 길이자, 상대를 기다리기 싫은 날의 기본값이다.
 */
export const SOLO_MIN_MINUTES = 10;

/**
 * 구제 퀘스트.
 * 참가비조차 못 내는 상태에서 25분을 채우면, 평소 적립 대신 이만큼을 준다
 * (평시의 2.6배). 다시 판에 설 수 있을 만큼만 끌어올리는 것이 목적이다.
 */
export function rescueTopUp(args: {
  minutes: number;
  coins: number;
  entryFee: number;
  normalPayout: number;
}): number {
  const stranded = args.coins < args.entryFee;
  if (!stranded || args.minutes < RESCUE_QUEST.minutes) return 0;
  return Math.max(0, RESCUE_QUEST.coins - args.normalPayout);
}

/** 새 방에 처음 들어설 때 주는 축하금. 첫 참가비를 스스로 마련하지 않아도 되게. */
export const PROMOTION_GIFT_MULTIPLIER = 5;

