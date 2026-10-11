import { useCallback, useEffect, useState } from 'react';
import { dailyTotals, dayKey, loadSessions, storage } from './sessions';
import { PLAYER_COINS } from './wallet';
import { arenaById, arenaForElo, STARTING_ELO, type Arena, type ArenaId } from './arena';
import { couponsAllowed, type MatchOutcome } from './match';
import { jackpotCoins, type CouponId } from './coupons';
import {
  accrueRollTickets,
  activeMatchCoupons,
  capsuleVerdict,
  COUPON_USE,
  dayToAnchor,
  settleCompound,
  studyStreak,
} from './couponEffects';

// ============================================================
// INVENTORY — 지갑과 가진 물건
// 코인은 여기 하나로 모인다. 상점에서 쓰고, ROLL 로 받고,
// 배틀 로비는 이 잔고로 설 수 있는 티어를 정한다.
// ============================================================

export const INVENTORY_STORAGE_KEY = '@study_timer/inventory';

export type Inventory = {
  coins: number;
  /** 물건 id → 가진 개수. 쿠폰은 여러 장, 꾸밈새는 한 개까지. */
  items: Record<string, number>;
  /** 대전 실력 점수. 입장 자격이자 순위. */
  elo: number;
  /** 지금 서 있는 방. 승급은 자동이 아니라 유저가 고른다. */
  arenaId: ArenaId;
  /** 소프트캡·지갑 상한에 걸려 코인 대신 쌓인 몫. */
  honor: number;
  /** 오늘 첫 세션 보너스를 이미 받은 날(YYYY-MM-DD). 하루 한 번만. */
  firstBonusDay: string | null;
  /** 축하금을 이미 받은 방들. 같은 방에서 두 번 받지 않게. */
  giftedArenas: string[];
  /** 판에 들고 들어갈 쿠폰 두 자리. 비어 있으면 null. */
  equipped: (string | null)[];
  /** 쌓여 있는 ROLL 뽑기권. 하루에 한 장씩 늘고, 한 번 펼칠 때 한 장 쓴다. */
  rollTickets: number;
  /** 뽑기권을 마지막으로 받은 날(YYYY-MM-DD). 비어 있으면 아직 한 장도 안 받았다. */
  ticketDay: string | null;
  /** ROLL 로 받아 모아 둔 휴식(분). 타이머의 휴식 저금통에 더해져 판을 넘어 남는다. */
  bankedBreak: number;
  /** 랭크전 연승. 시간의 닻이 한 번 지켜 준다. */
  winStreak: number;
  /** 시간의 닻이 메워 준 날들. 연속 공부 일수에서 공부한 날로 친다. */
  streakPatches: string[];
  /** 봉인 중인 타임캡슐. */
  capsule: { startDay: string } | null;
  /** 돌고 있는 복리 두루마리. settledThrough 는 마지막으로 정산한 날. */
  compound: { startDay: string; settledThrough: string | null } | null;
  /** 암시장이 열린 날. 그날 하루만 열린다. */
  secretShopDay: string | null;
};

export const DEFAULT_INVENTORY: Inventory = {
  coins: PLAYER_COINS,
  items: {},
  elo: STARTING_ELO,
  arenaId: arenaForElo(STARTING_ELO).id,
  honor: 0,
  firstBonusDay: null,
  giftedArenas: [],
  equipped: [null, null],
  rollTickets: 0,
  ticketDay: null,
  bankedBreak: 0,
  winStreak: 0,
  streakPatches: [],
  capsule: null,
  compound: null,
  secretShopDay: null,
};

export async function loadInventory(): Promise<Inventory> {
  try {
    const raw = await storage.getItem(INVENTORY_STORAGE_KEY);
    if (!raw) return DEFAULT_INVENTORY;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return DEFAULT_INVENTORY;
    // 기본값 위에 얹는 것이 곧 추가된 칸의 마이그레이션이다.
    return {
      ...DEFAULT_INVENTORY,
      ...parsed,
      coins: typeof parsed.coins === 'number' ? parsed.coins : DEFAULT_INVENTORY.coins,
      items: parsed.items && typeof parsed.items === 'object' ? parsed.items : {},
      elo: typeof parsed.elo === 'number' ? parsed.elo : DEFAULT_INVENTORY.elo,
      equipped: Array.isArray(parsed.equipped)
        ? [parsed.equipped[0] ?? null, parsed.equipped[1] ?? null]
        : [null, null],
      streakPatches: Array.isArray(parsed.streakPatches) ? parsed.streakPatches : [],
    };
  } catch {
    return DEFAULT_INVENTORY;
  }
}

async function save(next: Inventory): Promise<Inventory> {
  try {
    await storage.setItem(INVENTORY_STORAGE_KEY, JSON.stringify(next));
  } catch (error) {
    console.error('Failed to save inventory:', error);
  }
  return next;
}

export const countOf = (inv: Inventory, id: string) => inv.items[id] ?? 0;

/** 읽고 → 고치고 → 쓴다. 고칠 게 없으면 fn 이 그대로 돌려주면 된다. */
async function update(fn: (inv: Inventory) => Inventory): Promise<Inventory> {
  const inv = await loadInventory();
  const next = fn(inv);
  return next === inv ? inv : save(next);
}

/** 한 장 뺀다. 다 떨어지면 끼워 둔 슬롯도 비운다. */
function spend(inv: Inventory, id: string, count = 1): Inventory {
  const left = Math.max(0, countOf(inv, id) - count);
  return {
    ...inv,
    items: { ...inv.items, [id]: left },
    equipped: left > 0 ? inv.equipped : inv.equipped.map((slot) => (slot === id ? null : slot)),
  };
}

/** 지갑 상한까지만 코인으로, 넘는 몫은 명예로. */
function credit(inv: Inventory, amount: number): Inventory {
  const room = Math.max(0, arenaById(inv.arenaId).walletCap - inv.coins);
  const coins = Math.min(Math.max(0, amount), room);
  return { ...inv, coins: inv.coins + coins, honor: inv.honor + Math.max(0, amount) - coins };
}


/** 살 수 있는지. 값이 모자라거나, 한 개짜리를 이미 들고 있으면 안 된다. */
export function canBuy(inv: Inventory, id: string, price: number, unique: boolean) {
  if (unique && countOf(inv, id) > 0) return false;
  return inv.coins >= price;
}

/** 산다. 조건이 안 맞으면 지갑을 건드리지 않고 그대로 돌려준다. */
export async function buyItem(id: string, price: number, unique: boolean): Promise<Inventory> {
  const inv = await loadInventory();
  if (!canBuy(inv, id, price, unique)) return inv;
  return save({
    ...inv,
    coins: inv.coins - price,
    items: { ...inv.items, [id]: countOf(inv, id) + 1 },
  });
}

/** 쿠폰 한 자리를 채우거나 비운다. 같은 쿠폰을 두 자리에 겹쳐 끼우지는 못한다. */
export async function equipCoupon(slot: 0 | 1, id: string | null): Promise<Inventory> {
  const inv = await loadInventory();
  const next = [inv.equipped[0] ?? null, inv.equipped[1] ?? null];
  const other = slot === 0 ? 1 : 0;
  if (id !== null && next[other] === id) next[other] = null;
  next[slot] = id;
  return save({ ...inv, equipped: next });
}

/** 값 없이 받는다 — ROLL 로 뽑은 쿠폰 같은 것. */
export async function grantItem(id: string, count = 1): Promise<Inventory> {
  const inv = await loadInventory();
  return save({ ...inv, items: { ...inv.items, [id]: countOf(inv, id) + count } });
}

export async function addCoins(amount: number): Promise<Inventory> {
  const inv = await loadInventory();
  return save({ ...inv, coins: Math.max(0, inv.coins + amount) });
}

/** 세션이나 정산의 결과를 한 번에 반영한다. */
export async function applyLedger(patch: {
  coins?: number;
  honor?: number;
  elo?: number;
  arenaId?: ArenaId;
  firstBonusDay?: string | null;
  /** 축하금을 받은 방으로 표시한다. */
  giftArena?: string;
}): Promise<Inventory> {
  const inv = await loadInventory();
  return save({
    ...inv,
    giftedArenas:
      patch.giftArena && !inv.giftedArenas.includes(patch.giftArena)
        ? [...inv.giftedArenas, patch.giftArena]
        : inv.giftedArenas,
    coins: Math.max(0, inv.coins + (patch.coins ?? 0)),
    honor: Math.max(0, inv.honor + (patch.honor ?? 0)),
    elo: patch.elo !== undefined ? Math.max(0, patch.elo) : inv.elo,
    arenaId: patch.arenaId ?? inv.arenaId,
    firstBonusDay: patch.firstBonusDay !== undefined ? patch.firstBonusDay : inv.firstBonusDay,
  });
}

// ---------- 쿠폰 ----------

/** 이번 판에 먹힐 쿠폰. 입장 전에 화면이 미리 보여 줄 때도 쓴다. */
export function matchCouponsFor(inv: Inventory, arena: Arena, solo: boolean): CouponId[] {
  return activeMatchCoupons({
    equipped: inv.equipped,
    items: inv.items,
    solo,
    allowed: couponsAllowed(arena),
  });
}

/**
 * 판에 들어선다. 참가비를 내고(자유 이용권이면 건너뛰고), 들고 들어간 쿠폰을 한 장씩 뺀다.
 * 판에서 뜻이 없는 쿠폰(솔로의 방패 같은 것)은 빼지 않는다.
 */
export async function enterMatch(
  arena: Arena,
  solo: boolean
): Promise<{ inv: Inventory; coupons: CouponId[]; entryPaid: number }> {
  let coupons: CouponId[] = [];
  let entryPaid = 0;
  const inv = await update((current) => {
    coupons = matchCouponsFor(current, arena, solo);
    entryPaid = solo || coupons.includes('freeEntry') ? 0 : arena.entryFee;
    let next: Inventory = { ...current, coins: Math.max(0, current.coins - entryPaid) };
    for (const id of coupons) next = spend(next, id);
    return next;
  });
  return { inv, coupons, entryPaid };
}

/** 매칭을 접었다. 판이 열리지 않았으니 들고 들어간 쿠폰은 돌려준다. */
export async function returnCoupons(coupons: readonly string[]): Promise<Inventory> {
  if (!coupons.length) return loadInventory();
  return update((inv) => {
    const items = { ...inv.items };
    for (const id of coupons) items[id] = (items[id] ?? 0) + 1;
    return { ...inv, items };
  });
}

/**
 * 랭크전 연승을 고친다. 지면 끊기지만, 시간의 닻을 들고 있으면 한 장 쓰고 지킨다.
 * 연승이 없을 때는 닻을 태우지 않는다.
 */
export async function recordDuel(
  outcome: MatchOutcome
): Promise<{ inv: Inventory; anchored: boolean }> {
  let anchored = false;
  const inv = await update((current) => {
    if (outcome === 'draw') return current;
    if (outcome === 'win') return { ...current, winStreak: current.winStreak + 1 };
    if (current.winStreak > 0 && countOf(current, 'streakAnchor') > 0) {
      anchored = true;
      return spend(current, 'streakAnchor');
    }
    return { ...current, winStreak: 0 };
  });
  return { inv, anchored };
}

/** 모아 둔 휴식에서 꺼내 쓴다. 모자라면 있는 만큼만. */
export async function spendBankedBreak(minutes: number): Promise<Inventory> {
  return update((inv) =>
    minutes <= 0 ? inv : { ...inv, bankedBreak: Math.max(0, inv.bankedBreak - minutes) }
  );
}

/** 황금 시간이 더 얹어 준 몫을 넣는다. 상한은 credit 이 맡는다. */
export async function creditCoins(amount: number): Promise<Inventory> {
  if (amount <= 0) return loadInventory();
  return update((inv) => credit(inv, amount));
}

/** 지금 쓸 수 있는 뽑기권. 지난 날들 몫까지 쳐서 센다(저장은 하지 않는다). */
export const rollTicketsNow = (inv: Inventory, today = dayKey(new Date())) =>
  accrueRollTickets(inv.rollTickets, inv.ticketDay, today).tickets;

/**
 * ROLL 로 펼친 쪽의 보상을 받는다. 뽑기권을 한 장 쓴다.
 * 쿠폰은 가방으로, 운명의 주사위는 그 자리에서 코인으로.
 * 쉬는 시간 보상은 휴식 저금통(bankedBreak)에 쌓여 다음 판 타이머에서 쓴다.
 */
export async function claimRoll(
  reward: { coupon: CouponId; coins: number } | { breakMinutes: number }
): Promise<Inventory> {
  const today = dayKey(new Date());
  return update((inv) => {
    const { tickets, lastDay } = accrueRollTickets(inv.rollTickets, inv.ticketDay, today);
    if (tickets <= 0) return inv;
    let next: Inventory = { ...inv, rollTickets: tickets - 1, ticketDay: lastDay };
    if ('breakMinutes' in reward) return { ...next, bankedBreak: next.bankedBreak + reward.breakMinutes };
    if (COUPON_USE[reward.coupon] === 'instant') next = credit(next, reward.coins);
    else next = { ...next, items: { ...next.items, [reward.coupon]: countOf(next, reward.coupon) + 1 } };
    return next;
  });
}

/** 가방에서 꺼내 쓰는 쿠폰을 지금 쓸 수 있는지. 못 쓰면 이유를 돌려준다. */
export function bagUseBlocked(inv: Inventory, id: CouponId, today = dayKey(new Date())): string | null {
  const use = COUPON_USE[id];
  if (use !== 'use' && use !== 'instant') return 'Not used from the bag.';
  if (countOf(inv, id) <= 0) return 'None left.';
  if (id === 'timeCapsule') {
    if (inv.capsule) return 'A capsule is already sealed.';
    if (countOf(inv, 'skinHardback') > 0) return 'You already own the hardback skin.';
  }
  if (id === 'compoundBank' && inv.compound) return 'A scroll is already working.';
  if (id === 'secretShop' && inv.secretShopDay === today) return 'The black market is already open.';
  return null;
}

/**
 * 가방에서 쿠폰을 꺼내 쓴다. 쓸 수 없으면 그대로 돌려준다.
 * 운명의 주사위는 여기서 굴러 coins 에 얼마가 나왔는지 실어 보낸다.
 */
export async function spendBagCoupon(id: CouponId): Promise<{ inv: Inventory; coins: number }> {
  const today = dayKey(new Date());
  let coins = 0;
  const inv = await update((inv) => {
    if (bagUseBlocked(inv, id, today)) return inv;
    const next = spend(inv, id);
    if (id === 'luckyGamble') {
      coins = jackpotCoins(Math.floor(Math.random() * 1_000_000));
      return credit(next, coins);
    }
    if (id === 'timeCapsule') return { ...next, capsule: { startDay: today } };
    if (id === 'compoundBank') return { ...next, compound: { startDay: today, settledThrough: null } };
    return { ...next, secretShopDay: today };
  });
  return { inv, coins };
}

/** 하루 단위로 도는 쿠폰을 정산하면서 알릴 만한 일. */
export type DailyEvent =
  | { kind: 'capsuleWon' }
  | { kind: 'capsuleBroken' }
  | { kind: 'compound'; coins: number; done: boolean }
  | { kind: 'anchoredDay'; day: string };

/**
 * 지나간 날들을 정산한다 — 타임캡슐, 복리 두루마리, 끊길 뻔한 연속 공부.
 * 앱을 열 때와 가방을 볼 때 부른다. 몇 번을 불러도 같은 날을 두 번 세지 않는다.
 */
export async function settleDailyCoupons(now = new Date()): Promise<DailyEvent[]> {
  const today = dayKey(now);
  const byDay = dailyTotals(await loadSessions());
  const minutesOn = (day: string) => Math.floor((byDay.get(day) ?? 0) / 60000);
  const events: DailyEvent[] = [];

  await update((inv) => {
    let next = inv;

    if (next.capsule) {
      const verdict = capsuleVerdict(next.capsule.startDay, today, minutesOn);
      if (verdict === 'won') {
        next = {
          ...next,
          capsule: null,
          items: { ...next.items, skinHardback: Math.max(1, countOf(next, 'skinHardback')) },
        };
        events.push({ kind: 'capsuleWon' });
      } else if (verdict === 'broken') {
        next = { ...next, capsule: null };
        events.push({ kind: 'capsuleBroken' });
      }
    }

    if (next.compound) {
      const result = settleCompound({
        ...next.compound,
        today,
        coins: next.coins,
        walletCap: arenaById(next.arenaId).walletCap,
        minutesOn,
      });
      if (result.settledThrough !== next.compound.settledThrough) {
        events.push({ kind: 'compound', coins: result.coins - next.coins, done: result.done });
        next = {
          ...next,
          coins: result.coins,
          honor: next.honor + result.honor,
          compound: result.done
            ? null
            : { startDay: next.compound.startDay, settledThrough: result.settledThrough },
        };
      }
    }

    if (countOf(next, 'streakAnchor') > 0) {
      const day = dayToAnchor(today, minutesOn, next.streakPatches);
      if (day) {
        next = { ...spend(next, 'streakAnchor'), streakPatches: [...next.streakPatches, day] };
        events.push({ kind: 'anchoredDay', day });
      }
    }

    return next;
  });

  return events;
}

/** 오늘까지 이어진 연속 공부 일수. 닻으로 메운 날도 친다. */
export async function studyStreakNow(now = new Date()): Promise<number> {
  const [inv, sessions] = await Promise.all([loadInventory(), loadSessions()]);
  const byDay = dailyTotals(sessions);
  return studyStreak(
    dayKey(now),
    (day) => Math.floor((byDay.get(day) ?? 0) / 60000),
    inv.streakPatches
  );
}

// ⚠️ 임시 — 테스트용. 출시 전에 이 블록과 Shop 의 TestBench 를 함께 지운다.
/** 지갑·점수를 원하는 값으로 직접 밀어 넣는다. 규칙을 우회하므로 테스트에서만 쓴다. */
export async function debugSet(patch: Partial<Inventory>): Promise<Inventory> {
  const inv = await loadInventory();
  return save({ ...inv, ...patch });
}

/** 화면에서 쓰는 훅. 값이 올 때까지는 기본 지갑을 보여 준다. */
export function useInventory() {
  const [inv, setInv] = useState<Inventory>(DEFAULT_INVENTORY);
  const [ready, setReady] = useState(false);

  const refresh = useCallback(async () => {
    setInv(await loadInventory());
    setReady(true);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const buy = useCallback(async (id: string, price: number, unique: boolean) => {
    setInv(await buyItem(id, price, unique));
  }, []);

  return { inv, ready, refresh, buy };
}
