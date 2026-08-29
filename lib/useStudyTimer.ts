import { useCallback, useEffect, useRef, useState } from 'react';
import { saveSession, StudySession } from './sessions';
import { loadSettings } from './settings';

export type TimerState = 'ready' | 'running' | 'paused';

const TICK_MS = 100;

export interface UseStudyTimerResult {
  state: TimerState;
  elapsedMs: number;
  toggle: () => void;
  reset: () => void;
  finish: (subject?: string | null) => Promise<StudySession | null>;
}

export function formatElapsed(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  // Always HH:MM:SS so the clock never changes width mid-session.
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

export function useStudyTimer(): UseStudyTimerResult {
  const [state, setState] = useState<TimerState>('ready');
  const [elapsedMs, setElapsedMs] = useState(0);

  const accumulatedMs = useRef(0);
  const startedAt = useRef<number | null>(null);
  const sessionStartedAt = useRef<string | null>(null);

  useEffect(() => {
    if (state !== 'running') return;
    const id = setInterval(() => {
      const start = startedAt.current;
      if (start === null) return;
      setElapsedMs(accumulatedMs.current + (Date.now() - start));
    }, TICK_MS);
    return () => clearInterval(id);
  }, [state]);

  const toggle = useCallback(() => {
    if (startedAt.current !== null) {
      accumulatedMs.current += Date.now() - startedAt.current;
      startedAt.current = null;
      setElapsedMs(accumulatedMs.current);
      setState('paused');
    } else {
      if (sessionStartedAt.current === null) {
        sessionStartedAt.current = new Date().toISOString();
      }
      startedAt.current = Date.now();
      setState('running');
    }
  }, []);

  const reset = useCallback(() => {
    accumulatedMs.current = 0;
    startedAt.current = null;
    sessionStartedAt.current = null;
    setElapsedMs(0);
    setState('ready');
  }, []);

  const finish = useCallback(
    async (subject?: string | null): Promise<StudySession | null> => {
      const now = Date.now();
      let totalMs = accumulatedMs.current;
      if (startedAt.current !== null) {
        totalMs += now - startedAt.current;
      }

      if (totalMs === 0) {
        return null;
      }

      const startedIso =
        sessionStartedAt.current ?? new Date(now - totalMs).toISOString();
      const endedIso = new Date(now).toISOString();

      const { minSessionMs } = await loadSettings();
      const session = await saveSession(
        {
          startedAt: startedIso,
          endedAt: endedIso,
          durationMs: totalMs,
          subject,
        },
        minSessionMs
      );

      accumulatedMs.current = 0;
      startedAt.current = null;
      sessionStartedAt.current = null;
      setElapsedMs(0);
      setState('ready');

      return session;
    },
    []
  );

  return { state, elapsedMs, toggle, reset, finish };
}
