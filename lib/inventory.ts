import { useCallback, useEffect, useState } from 'react';
import { storage } from './sessions';
import { PLAYER_COINS } from './wallet';
import { arenaForElo, STARTING_ELO, type ArenaId } from './arena';

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
