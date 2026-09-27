// ============================================================
// RANKS — 판당 시간과 판돈으로 나눈 티어
// 장소(아레나)로 나누지 않는다. 오래 앉을수록, 크게 걸수록 높은 티어다.
// 들어가려면 판돈만이 아니라 최소 보유 코인(minCoins)을 넘겨야 한다.
// ============================================================

export type RankId =
  | 'iron'
  | 'bronze'
  | 'silver'
  | 'gold'
  | 'platinum'
  | 'emerald'
  | 'diamond'
  | 'master'
  | 'grandmaster'
  | 'challenger';

export type Rank = {
  id: RankId;
  name: string;
  /** 한 판의 길이(초). 둘 다 이 시간을 채우면 무승부. */
  matchSeconds: number;
  /** 판돈(H-Coin). */
  bet: number;
  /** 이 티어에서 뛰려면 지갑에 최소 이만큼은 있어야 한다. */
  minCoins: number;
  /** ROLL 로 얻는 휴식 보상의 기준 분. 판이 길수록 한 번에 더 크게 쉰다. */
  breakMinutes: number;
  /** 티어 색. 뱃지와 선택 테두리에 쓴다. */
  color: string;
  blurb: string;
};

const M = 60;

// 판 길이는 15분에서 6시간 30분까지. 티어가 오를수록 간격이 넓어진다 —
// 아래쪽은 가볍게 들어오고, 위쪽은 한 칸 올라가는 게 확실히 무겁게.
export const RANKS: readonly Rank[] = [
  { id: 'iron', name: 'Iron', matchSeconds: 15 * M, bet: 5, minCoins: 0, breakMinutes: 4, color: '#6F6F68', blurb: 'Fifteen minutes. Just sit down.' },
  { id: 'bronze', name: 'Bronze', matchSeconds: 30 * M, bet: 15, minCoins: 60, breakMinutes: 6, color: '#9C6B43', blurb: 'Half an hour, one sitting.' },
  { id: 'silver', name: 'Silver', matchSeconds: 50 * M, bet: 35, minCoins: 180, breakMinutes: 9, color: '#8A9099', blurb: 'Fifty minutes. No break needed.' },
  { id: 'gold', name: 'Gold', matchSeconds: 75 * M, bet: 70, minCoins: 400, breakMinutes: 12, color: '#B5822B', blurb: 'An hour and a quarter — the usual block.' },
  { id: 'platinum', name: 'Platinum', matchSeconds: 105 * M, bet: 130, minCoins: 800, breakMinutes: 16, color: '#4E8C86', blurb: 'Nearly two hours of real focus.' },
  { id: 'emerald', name: 'Emerald', matchSeconds: 145 * M, bet: 230, minCoins: 1500, breakMinutes: 21, color: '#3F7A4A', blurb: 'Two and a half hours. Pace yourself.' },
  { id: 'diamond', name: 'Diamond', matchSeconds: 195 * M, bet: 400, minCoins: 2800, breakMinutes: 27, color: '#3D6EA8', blurb: 'Over three hours. Few last it.' },
  { id: 'master', name: 'Master', matchSeconds: 255 * M, bet: 700, minCoins: 5000, breakMinutes: 34, color: '#6E4E9E', blurb: 'Four and a quarter hours. Breaks are a strategy now.' },
  { id: 'grandmaster', name: 'Grandmaster', matchSeconds: 320 * M, bet: 1200, minCoins: 9000, breakMinutes: 42, color: '#A2492F', blurb: 'Five hours and twenty. Bring water.' },
  { id: 'challenger', name: 'Challenger', matchSeconds: 390 * M, bet: 2000, minCoins: 15000, breakMinutes: 55, color: '#D97706', blurb: 'Six and a half hours — the longest match there is.' },
];

export const rankById = (id: RankId): Rank => RANKS.find((rank) => rank.id === id) ?? RANKS[0];

/** 지갑이 감당하는 가장 높은 티어. 로비를 열었을 때 여기에 서 있게 한다. */
export const highestUnlocked = (coins: number): Rank => {
  const open = RANKS.filter((rank) => coins >= rank.minCoins);
  return open[open.length - 1] ?? RANKS[0];
};

export const isUnlocked = (rank: Rank, coins: number) => coins >= rank.minCoins;

/** '2H', '1H 30M', '30M' 처럼 판 길이를 짧게. */
export const formatMatchLength = (seconds: number) => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.round((seconds % 3600) / 60);
  if (hours === 0) return `${minutes}M`;
  return minutes === 0 ? `${hours}H` : `${hours}H ${minutes}M`;
};
