// ============================================================
// ARENA — ELO 로 들어가는 방
// 래더가 아니라 방 입장형이다. 티어는 성적표가 아니라 입장 자격이고,
// 방마다 유효 시간·참가비·ELO 변동폭이 다르다.
//
// 세 가지 규칙이 이 파일의 전부다.
//  1) 들어갈 수 있는 방은 지금 선 방 하나뿐이다. 위로도 아래로도 못 간다.
//  2) 승급은 자동이 아니다 — ELO 가 닿으면 유저가 직접 올라가고, 이전 방은 닫힌다.
//  3) 강등 없다 — ELO 가 떨어져도 방은 닫히지 않는다.
// ============================================================

export type ArenaId = 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond';

export type Arena = {
  id: ArenaId;
  name: string;
  /** 이 방에 들어가려면 필요한 ELO. */
  eloFloor: number;
  /** 한 판의 유효 시간(초). null 이면 무제한. */
  matchSeconds: number | null;
  /** 참가비(코인). */
  entryFee: number;
  /** 승패 한 판의 ELO 변동폭. 낮은 방일수록 크게 흔들어 제자리를 빨리 찾게 한다. */
  eloSwing: number;
  /** 이 방에 있는 동안의 지갑 상한. 넘친 코인은 명예 포인트로 간다. */
  walletCap: number;
  /** ROLL 로 얻는 휴식 보상의 기준 분. 긴 판을 뛰는 사람일수록 한 번에 크게 쉰다. */
  breakMinutes: number;
  /** 솔로 매치를 끝냈을 때 받는 코인. 방이 길수록 크다. */
  soloReward: number;
  color: string;
  blurb: string;
};

const MIN = 60;

export const ARENAS: readonly Arena[] = [
  {
    id: 'bronze',
    name: 'Bronze',
    eloFloor: 0,
    matchSeconds: 60 * MIN,
    entryFee: 20,
    eloSwing: 25,
    walletCap: 3000,
    breakMinutes: 8,
    soloReward: 10,
    color: '#9C6B43',
    blurb: 'One hour. Sit down and start.',
  },
  {
    id: 'silver',
    name: 'Silver',
    eloFloor: 1000,
    matchSeconds: 120 * MIN,
    entryFee: 50,
    eloSwing: 20,
    walletCap: 5000,
    breakMinutes: 14,
    soloReward: 22,
    color: '#8A9099',
    blurb: 'Two hours. One sitting, one break.',
  },
  {
    id: 'gold',
    name: 'Gold',
    eloFloor: 1200,
    matchSeconds: 180 * MIN,
    entryFee: 120,
    eloSwing: 16,
    walletCap: 8000,
    breakMinutes: 20,
    soloReward: 40,
    color: '#B5822B',
    blurb: 'Three hours. The usual study block.',
  },
  {
    id: 'platinum',
    name: 'Platinum',
    eloFloor: 1400,
    matchSeconds: 300 * MIN,
    entryFee: 300,
    eloSwing: 12,
    walletCap: 13000,
    breakMinutes: 30,
    soloReward: 70,
    color: '#4E8C86',
    blurb: 'Five hours. Breaks are a strategy now.',
  },
  {
    id: 'diamond',
    name: 'Diamond',
    eloFloor: 1600,
    matchSeconds: null,
    entryFee: 600,
    eloSwing: 8,
    walletCap: 20000,
    breakMinutes: 40,
    soloReward: 120,
    color: '#3D6EA8',
    blurb: 'No time limit. The match ends when you do.',
  },
];

export const STARTING_ELO = 800;

export const arenaById = (id: ArenaId): Arena => ARENAS.find((a) => a.id === id) ?? ARENAS[0];

export const arenaIndex = (id: ArenaId) => ARENAS.findIndex((a) => a.id === id);

export const nextArena = (id: ArenaId): Arena | null => ARENAS[arenaIndex(id) + 1] ?? null;

/** ELO 만 보고 정해지는 방. 새 계정이 처음 서는 자리를 정할 때 쓴다. */
export function arenaForElo(elo: number): Arena {
  let found = ARENAS[0];
  for (const arena of ARENAS) if (elo >= arena.eloFloor) found = arena;
  return found;
}

/** 승급할 수 있는지. 자동으로 올리지 않고 물어보기 위한 판정이다. */
export function canPromote(elo: number, currentId: ArenaId): boolean {
  const next = nextArena(currentId);
  return !!next && elo >= next.eloFloor;
}

/** 승급까지 남은 점수. 다음 방이 없으면 null. */
export function eloToNext(elo: number, currentId: ArenaId): number | null {
  const next = nextArena(currentId);
  if (!next) return null;
  return Math.max(0, next.eloFloor - elo);
}

/** 한 판이 끝난 뒤의 ELO. 방의 변동폭만큼 오르내리고 0 아래로는 안 간다. */
export function eloAfter(elo: number, arena: Arena, result: 'win' | 'loss' | 'draw'): number {
  if (result === 'draw') return elo;
  return Math.max(0, elo + (result === 'win' ? arena.eloSwing : -arena.eloSwing));
}

/** '1H', '2H 30M', '무제한'. */
export function formatMatchLength(seconds: number | null): string {
  if (seconds === null) return 'No limit';
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.round((seconds % 3600) / 60);
  if (hours === 0) return `${minutes}M`;
  return minutes === 0 ? `${hours}H` : `${hours}H ${minutes}M`;
}
