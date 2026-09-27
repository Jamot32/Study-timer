import { useCallback, useEffect, useState } from 'react';
import { storage } from './sessions';
import { PLAYER_COINS } from './wallet';

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
};

export const DEFAULT_INVENTORY: Inventory = {
  coins: PLAYER_COINS,
  items: {},
};

export async function loadInventory(): Promise<Inventory> {
  try {
    const raw = await storage.getItem(INVENTORY_STORAGE_KEY);
    if (!raw) return DEFAULT_INVENTORY;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return DEFAULT_INVENTORY;
    return {
      coins: typeof parsed.coins === 'number' ? parsed.coins : DEFAULT_INVENTORY.coins,
      items: parsed.items && typeof parsed.items === 'object' ? parsed.items : {},
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
    coins: inv.coins - price,
    items: { ...inv.items, [id]: countOf(inv, id) + 1 },
  });
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
