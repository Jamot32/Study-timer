import { useCallback, useEffect, useState } from 'react';
import { loadSessions, sessionsForDay } from './sessions';

// ============================================================
// TODAY — 오늘 얼마나 공부했나
// 기록(lib/sessions)에서 읽기만 한다. 여기서 값을 만들거나 고치지 않는다.
// 랭크전 입장 게이트와 소프트캡이 이 숫자를 기준으로 삼는다.
// ============================================================

export async function studiedMinutesToday(now = new Date()): Promise<number> {
  const sessions = await loadSessions();
  const today = sessionsForDay(sessions, now);
  const ms = today.reduce((sum, session) => sum + session.durationMs, 0);
  return Math.floor(ms / 60000);
}

/** 화면에서 쓰는 훅. 탭을 다시 열 때마다 새로 읽는다. */
export function useStudiedToday(refreshKey: unknown = 0) {
  const [minutes, setMinutes] = useState(0);
  const [ready, setReady] = useState(false);

  const refresh = useCallback(async () => {
    setMinutes(await studiedMinutesToday());
    setReady(true);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh, refreshKey]);

  return { minutes, ready, refresh };
}
