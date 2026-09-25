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
  /** 티어 색. 뱃지와 선택 테두리에 쓴다. */
  color: string;
  blurb: string;
};

const M = 60;

// 판 길이는 30분에서 시작해 5시간(최상위)까지. 5시간이 한 판의 상한이다.
export const RANKS: readonly Rank[] = [
  { id: 'iron', name: 'Iron', matchSeconds: 30 * M, bet: 5, minCoins: 0, color: '#6F6F68', blurb: 'Half an hour. Just sit down.' },
  { id: 'bronze', name: 'Bronze', matchSeconds: 60 * M, bet: 10, minCoins: 50, color: '#9C6B43', blurb: 'One hour, one sitting.' },
  { id: 'silver', name: 'Silver', matchSeconds: 90 * M, bet: 20, minCoins: 150, color: '#8A9099', blurb: 'Ninety minutes. One break allowed.' },
  { id: 'gold', name: 'Gold', matchSeconds: 120 * M, bet: 40, minCoins: 300, color: '#B5822B', blurb: 'Two hours. The usual study block.' },
  { id: 'platinum', name: 'Platinum', matchSeconds: 150 * M, bet: 70, minCoins: 600, color: '#4E8C86', blurb: 'Two and a half hours of real focus.' },
  { id: 'emerald', name: 'Emerald', matchSeconds: 180 * M, bet: 110, minCoins: 1000, color: '#3F7A4A', blurb: 'Three hours. Pace yourself.' },
  { id: 'diamond', name: 'Diamond', matchSeconds: 210 * M, bet: 170, minCoins: 1800, color: '#3D6EA8', blurb: 'Three and a half hours. Few last it.' },
  { id: 'master', name: 'Master', matchSeconds: 240 * M, bet: 250, minCoins: 3000, color: '#6E4E9E', blurb: 'Four hours. Breaks are a strategy now.' },
  { id: 'grandmaster', name: 'Grandmaster', matchSeconds: 270 * M, bet: 400, minCoins: 5000, color: '#A2492F', blurb: 'Four and a half hours. Bring water.' },
  { id: 'challenger', name: 'Challenger', matchSeconds: 300 * M, bet: 600, minCoins: 8000, color: '#D97706', blurb: 'Five hours — the longest match there is.' },
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
