import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Alert, AppState, Pressable, StyleSheet, Text, View } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { Check, Flag, Moon, Pause, Play, RotateCcw, Sun } from 'lucide-react-native'
import { confirmDestructive } from '../lib/confirm'
import { useStudyTimer } from '../lib/useStudyTimer'
import { awayOutcome } from '../lib/away'
import { type Profile } from '../lib/auth'
import { Avatar } from './Avatar'
import ConfirmDialog from './PixelConfirm'
import { Button, Card, ProgressBar, RADIUS, T } from './nova'
import { OPPONENT } from './BattleLobby'

// ============================================================
// STUDY TIMER — React Native (Expo)
// 하늘이 도는 원형 다이얼. 색은 nova / secret garden 팔레트를 따른다.
// ============================================================

// ---------- 설정 ----------
// 하늘이 한 사이클(낮→밤) 도는 데 걸리는 시간(초).
// 지금은 테스트용으로 60초. 실사용 시 3600으로 되돌리세요.
const CYCLE_SECONDS = 3600
// 사이클을 어느 시점에서 시작할지 (0~1).
// 0.22 = 아침~낮 시작 지점. 0이면 동트기 전부터 시작.
const SKY_START = 0.22

// 브레이크 적립 기준(초). 이건 하늘 주기와 무관하게 항상 1시간 유지.
const BREAK_EARN_SECONDS = 3600

// ---------- 프로시저럴 하늘 ----------
// 한 사이클(CYCLE_SECONDS) 동안 아래 키프레임 사이를 매초 보간한다.
// 각 단계는 [위, 아래] 2색이고 중간 밴드는 자동으로 두 색의 중간값.
// t=0 동트기 전 → 일출 → 낮(유지) → 일몰 → 밤(유지) → 다시 동트기 전.
const hexToRgb = (hex: string) => {
  const n = parseInt(hex.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

const rgbToHex = (r: number, g: number, b: number) =>
  `#${((1 << 24) | (Math.round(r) << 16) | (Math.round(g) << 8) | Math.round(b)).toString(16).slice(1)}`

const lerpColor = (a: string, b: string, amount: number) => {
  const [ar, ag, ab] = hexToRgb(a)
  const [br, bg, bb] = hexToRgb(b)
  return rgbToHex(ar + (br - ar) * amount, ag + (bg - ag) * amount, ab + (bb - ab) * amount)
}

type SkyPhase = { t: number; top: string; bottom: string }

const SKY_PHASES: SkyPhase[] = [
  { t: 0.0, top: '#2E3358', bottom: '#3B4A6B' },  // 동트기 전: 흐린 남색
  { t: 0.07, top: '#6A5E82', bottom: '#D9A08C' }, // 여명: 자줏빛 → 살구
  { t: 0.13, top: '#E7B473', bottom: '#F0D399' }, // 일출: 앰버 → 연한 금빛
  { t: 0.22, top: '#BBD2C8', bottom: '#8FAF95' }, // 아침~낮: 안개 낀 초록빛 하늘
  { t: 0.5, top: '#BBD2C8', bottom: '#8FAF95' },  // 낮 유지
  { t: 0.57, top: '#EBC983', bottom: '#C98F4F' }, // 해 질 녘: 금빛 → 앰버
  { t: 0.63, top: '#C87B54', bottom: '#9C6E52' }, // 일몰: 구운 주황 → 흙빛
  { t: 0.7, top: '#6E6180', bottom: '#4C4F63' },  // 매직 아워: 흐린 보라
  { t: 0.78, top: '#262B3D', bottom: '#151824' }, // 밤: 깊은 남색
  { t: 0.94, top: '#262B3D', bottom: '#151824' }, // 밤 유지
  { t: 1.0, top: '#2E3358', bottom: '#3B4A6B' },  // 다시 동트기 전 (루프 연결)
]

type SkyKeyframe = { t: number; colors: [string, string, string] }

// [위, 아래]에서 중간 밴드를 계산해 3밴드 키프레임으로 변환
const SKY_KEYFRAMES: SkyKeyframe[] = SKY_PHASES.map((phase) => ({
  t: phase.t,
  colors: [phase.top, lerpColor(phase.top, phase.bottom, 0.5), phase.bottom],
}))

// 진행도(0~1)를 넣으면 현재 하늘의 3색을 계산해서 돌려준다.
const skyAt = (progress: number): [string, string, string] => {
  const p = ((progress % 1) + 1) % 1
  for (let i = 0; i < SKY_KEYFRAMES.length - 1; i++) {
    const from = SKY_KEYFRAMES[i]
    const to = SKY_KEYFRAMES[i + 1]
    if (p >= from.t && p <= to.t) {
      const span = to.t - from.t || 1
      const amount = (p - from.t) / span
      return [
        lerpColor(from.colors[0], to.colors[0], amount),
        lerpColor(from.colors[1], to.colors[1], amount),
        lerpColor(from.colors[2], to.colors[2], amount),
      ]
    }
  }
  return SKY_KEYFRAMES[0].colors
}

// 하늘 밝기에 따라 글자색을 정한다 (중간 밴드의 상대 휘도 기준)
const isSkyDark = (hex: string) => {
  const [r, g, b] = hexToRgb(hex)
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255 < 0.45
}

// StyleSheet.absoluteFillObject가 없는 타입 버전 호환용
const ABS_FILL = {
  position: 'absolute',
  left: 0,
  right: 0,
  top: 0,
  bottom: 0,
} as const

// ---------- 유틸 ----------
const formatTime = (totalSeconds: number) => {
  const h = Math.floor(totalSeconds / 3600).toString().padStart(2, '0')
  const m = Math.floor((totalSeconds % 3600) / 60).toString().padStart(2, '0')
  const s = (totalSeconds % 60).toString().padStart(2, '0')
  return `${h}:${m}:${s}`
}

const formatWeeklyMax = (totalSeconds: number) => {
  const h = Math.floor(totalSeconds / 3600)
  const m = Math.floor((totalSeconds % 3600) / 60)
  return `${h}H ${m.toString().padStart(2, '0')}M`
}

// ---------- 메인 컴포넌트 ----------
export function StudyTimer({
  onFinished,
  onOpenProfile,
  onResign,
  matchStarting = false,
  profile,
}: {
  onFinished?: () => void
  onOpenProfile?: () => void
  /** Give up the match: drops the session unsaved and hands the screen back. */
  onResign?: () => void
  /** 3-2-1 카운트다운이 도는 중. 끝나기 전까지는 상대 시계도 멈춰 있다. */
  matchStarting?: boolean
  /** Logged-in profile; drives the header avatar, outer line, title and name. */
  profile?: Profile
}) {
  const [mode, setMode] = useState<'FOCUS' | 'SHORT BREAK'>('FOCUS')
  const [breakBank, setBreakBank] = useState(0)
  const [streakBroken, setStreakBroken] = useState(false)
  const [weeklyMax, setWeeklyMax] = useState(0)
  const [breakElapsed, setBreakElapsed] = useState(0)
  const [isFinishing, setIsFinishing] = useState(false)
  const [confirmResign, setConfirmResign] = useState(false)
  // 상대 타이머. 서버가 없으니 매치가 걸린 동안 1초씩 도는 로컬 시뮬레이션이다.
  const [opponentElapsed, setOpponentElapsed] = useState(0)

  // FOCUS runs on the shared timer so finished sessions actually reach the
  // dashboard; SHORT BREAK runs on its own counter so break time is never
  // recorded as study time.
  const { state, elapsedMs, toggle, reset: resetFocus, finish } = useStudyTimer()
  const focusElapsed = Math.floor(elapsedMs / 1000)
  const onBreak = mode === 'SHORT BREAK'
  const elapsed = onBreak ? breakElapsed : focusElapsed
  const isRunning = onBreak ? true : state === 'running'

  useEffect(() => {
    if (!onBreak) return
    const interval = setInterval(() => setBreakElapsed((value) => value + 1), 1000)
    return () => clearInterval(interval)
  }, [onBreak])

  useEffect(() => {
    if (onBreak) return
    setWeeklyMax((maximum) => Math.max(maximum, focusElapsed))
  }, [focusElapsed, onBreak])

  // 배틀 중일 때만 상대 시계가 돈다. 3-2-1 카운트다운이 끝나야 비로소 출발한다.
  const inBattle = onResign !== undefined
  useEffect(() => {
    if (!inBattle || matchStarting) {
      // 카운트다운 동안엔 0 으로 세워 둔다.
      if (matchStarting) setOpponentElapsed(0)
      return
    }
    const interval = setInterval(() => setOpponentElapsed((value) => value + 1), 1000)
    return () => clearInterval(interval)
  }, [inBattle, matchStarting])

  // one 5-minute credit per full hour of focus. Counting crossings rather than
  // `elapsed % 3600 === 0` because the shared timer ticks every 100ms and can
  // skip the exact second.
  const earnedHours = useRef(0)
  useEffect(() => {
    if (onBreak) return
    const hours = Math.floor(focusElapsed / BREAK_EARN_SECONDS)
    if (hours > earnedHours.current) {
      setBreakBank((value) => value + 5 * (hours - earnedHours.current))
    }
    earnedHours.current = hours
  }, [focusElapsed, onBreak])

  const cycleProgress = (elapsed % CYCLE_SECONDS) / CYCLE_SECONDS
  const skyColors = useMemo(() => skyAt(cycleProgress + SKY_START), [cycleProgress])
  const isDay = !isSkyDark(skyColors[1])
  const skyText = isDay ? '#22261C' : '#F1EFE6'
  const breakLabel = breakBank > 0 ? `${breakBank} minutes banked` : 'No break banked yet'

  const endBreak = useCallback(() => {
    setMode('FOCUS')
    setBreakElapsed(0)
  }, [])

  const toggleTimer = () => {
    if (onBreak) {
      endBreak()
      return
    }
    if (isRunning && breakBank === 0) setStreakBroken(true)
    toggle()
  }

  const handleFinish = useCallback(async () => {
    if (onBreak) {
      endBreak()
      return
    }
    if (elapsedMs === 0 || isFinishing) return
    setIsFinishing(true)
    try {
      const session = await finish()
      earnedHours.current = 0
      if (session !== null) onFinished?.()
    } catch (error) {
      console.error('Failed to finish session:', error)
      Alert.alert('Error', 'Failed to save session.')
    } finally {
      setIsFinishing(false)
    }
  }, [elapsedMs, endBreak, finish, isFinishing, onBreak, onFinished])

  // Leaving the app stops the clock; coming back resumes it. Stay away longer
  // than the limit without being on a paid break and the session is banked.
  // The listener is registered once, so it reads live values through a ref.
  const live = useRef({ onBreak, isRunning, hasTime: elapsedMs > 0, handleFinish, resetFocus, toggle })
  live.current = { onBreak, isRunning, hasTime: elapsedMs > 0, handleFinish, resetFocus, toggle }

  useEffect(() => {
    const leftAt = { at: null as number | null, wasRunning: false }
    const subscription = AppState.addEventListener('change', (next) => {
      const { onBreak, isRunning, hasTime, handleFinish, resetFocus, toggle } = live.current

      if (next === 'active') {
        if (leftAt.at === null) return
        const awayMs = Date.now() - leftAt.at
        const wasRunning = leftAt.wasRunning
        leftAt.at = null
        switch (awayOutcome(awayMs, { onBreak, hasTime, wasRunning })) {
          case 'finish':
            handleFinish()
            break
          case 'reset':
            resetFocus()
            break
          case 'resume':
            toggle()
            break
        }
        return
      }

      // 'inactive' is a transient iOS state (notification shade, app switcher);
      // only a real background counts as leaving.
      if (next === 'background' && leftAt.at === null) {
        leftAt.at = Date.now()
        leftAt.wasRunning = isRunning && !onBreak
        if (leftAt.wasRunning) toggle()
      }
    })
    return () => subscription.remove()
  }, [])

  const reset = () => {
    if (onBreak) {
      endBreak()
      return
    }
    const discard = () => {
      resetFocus()
      earnedHours.current = 0
      setStreakBroken(false)
    }
    if (elapsedMs > 0) {
      confirmDestructive(
        'Discard Session?',
        'This will reset the timer without saving your study time.',
        'Discard',
        discard
      )
    } else {
      discard()
    }
  }

  // 항복. 진행 중인 세션은 저장하지 않고 버린 뒤 로비로 돌려보낸다.
  // 확인창은 OS 기본 Alert 대신 앱 모달(ConfirmDialog)로 띄운다.
  const giveUp = () => {
    setConfirmResign(false)
    resetFocus()
    earnedHours.current = 0
    setStreakBroken(false)
    setBreakElapsed(0)
    setMode('FOCUS')
    setOpponentElapsed(0)
    onResign?.()
  }

  // 시간이 0이어도 묻는다 — 항복은 눌렀다고 바로 나가 버리면 안 되는 동작.
  const handleResign = () => setConfirmResign(true)

  const useBreak = (minutes: number) => {
    if (breakBank < minutes) return
    // pause rather than reset: the focus time accumulated so far must survive
    // the break so it can still be finished and saved.
    if (state === 'running') toggle()
    setBreakBank((value) => value - minutes)
    setBreakElapsed(0)
    setMode('SHORT BREAK')
  }

  const name = profile?.name.trim() || 'Guest'
  const title = profile?.title || 'Username'

  const time = useMemo(() => formatTime(elapsed), [elapsed])
  const SkyIcon = isDay ? Sun : Moon

  return (
    <View
      style={[styles.screen, { paddingTop: 4, paddingBottom: 12 }]}
    >
      <View style={styles.frame}>
        {/* 헤더 */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Pressable onPress={onOpenProfile} accessibilityRole="button" accessibilityLabel="Edit profile">
              <Avatar profile={profile} size={40} />
            </Pressable>
            <View>
              <Text style={styles.label} numberOfLines={1}>{title}</Text>
              <View style={styles.nameRow}>
                <Text style={styles.name} numberOfLines={1}>
                  {name}
                </Text>
                <Text style={styles.level}>Lv 4</Text>
              </View>
            </View>
          </View>

          {/* 상대 시계는 눌러서 보는 게 아니라 늘 작게 붙어 있다. */}
          {inBattle && (
            <View style={styles.rivalChip}>
              <Text style={styles.rivalLabel}>{OPPONENT.name}</Text>
              <Text style={styles.rivalTime}>{formatTime(opponentElapsed)}</Text>
            </View>
          )}
        </View>

        {/* 상태 줄 */}
        <View style={styles.statusRow}>
          <View>
            <Text style={styles.label}>{onBreak ? 'Short break' : 'Focus'}</Text>
            <Text style={styles.statusText}>
              {isRunning ? 'In session' : 'Ready when you are'}
            </Text>
          </View>
          <Card level={0} tone="alt" radius={RADIUS.md} boxStyle={styles.weeklyBox}>
            <Text style={styles.weeklyLabel}>Weekly max</Text>
            <Text style={styles.weeklyValue}>{formatWeeklyMax(weeklyMax)}</Text>
          </Card>
        </View>

        {/* 다이얼 */}
        <View style={styles.dialWrap}>
          <View style={styles.dial}>
            {/* 세 색을 부드럽게 녹인 하늘. 밴딩 없이 이어진다. */}
            <LinearGradient
              colors={skyColors}
              locations={[0, 0.52, 1]}
              style={ABS_FILL}
            />
            <View style={styles.dialContent}>
              <View style={styles.cycleRow}>
                <SkyIcon size={15} color={skyText} />
                <Text style={[styles.cycleText, { color: skyText }]}>
                  {isDay ? 'Day cycle' : 'Night cycle'}
                </Text>
              </View>
              <Text style={[styles.time, { color: skyText }]} accessibilityLiveRegion="polite">
                {time}
              </Text>
              <Text style={[styles.cycleSub, { color: skyText }]}>
                {Math.round(cycleProgress * 100)}% of cycle
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.progressWrap}>
          <ProgressBar value={cycleProgress} height={8} />
        </View>

        {/* 컨트롤 */}
        <View style={styles.controls}>
          <Button size="lg" onPress={toggleTimer} style={styles.mainButton}>
            {isRunning ? (
              <Pause size={20} color={T.primaryFg} />
            ) : (
              <Play size={20} color={T.primaryFg} fill={T.primaryFg} />
            )}
            <Text style={styles.mainButtonText}>{isRunning ? 'Pause' : 'Start'}</Text>
          </Button>
          <Button
            size="lg"
            variant="soft"
            onPress={handleFinish}
            disabled={!onBreak && (elapsedMs === 0 || isFinishing)}
            accessibilityLabel="Finish session and save it"
            style={styles.iconButton}
          >
            <Check size={20} color={T.primaryDeep} />
          </Button>
          <Button
            size="lg"
            variant="outline"
            onPress={reset}
            accessibilityLabel="Reset timer"
            style={styles.iconButton}
          >
            <RotateCcw size={20} color={T.inkSoft} />
          </Button>
        </View>

        {onResign && (
          <Button
            block
            variant="ghost"
            onPress={handleResign}
            accessibilityLabel="Resign the match"
            style={styles.resignButton}
          >
            <Flag size={16} color={T.danger} />
            <Text style={styles.resignText}>Resign</Text>
          </Button>
        )}

        {/* 브레이크 뱅크 */}
        <Card level={1} style={styles.bankWrap} boxStyle={styles.bankCard}>
          <View style={styles.bankHeader}>
            <Text style={styles.bankTitle}>Short break bank</Text>
            <Text style={styles.bankValue}>{breakBank} min</Text>
          </View>
          <Text style={styles.bankDesc}>
            1 hour of focus adds 5 minutes. Spend them whenever you need.
          </Text>
          <View style={styles.bankButtons}>
            {[5, 10, 15].map((minutes) => (
              <Button
                key={minutes}
                variant="outline"
                size="sm"
                disabled={breakBank < minutes}
                onPress={() => useBreak(minutes)}
                style={styles.bankButton}
              >
                Use {minutes}m
              </Button>
            ))}
          </View>
          <Text style={[styles.bankStatus, streakBroken && { color: T.danger }]}>
            {streakBroken ? 'Session record broken — no break was banked.' : breakLabel}
          </Text>
        </Card>
      </View>

      <ConfirmDialog
        visible={confirmResign}
        title="Resign match?"
        message={
          elapsedMs > 0
            ? 'You forfeit the battle and this study time will not be saved.'
            : 'You forfeit the battle and go back to the lobby.'
        }
        confirmLabel="Resign"
        cancelLabel="Keep studying"
        onConfirm={giveUp}
        onCancel={() => setConfirmResign(false)}
      />
    </View>
  )
}

// ---------- 스타일 ----------
const styles = StyleSheet.create({
  screen: {
    backgroundColor: T.bg,
    paddingHorizontal: 16,
  },
  frame: { paddingTop: 4 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1, marginRight: 10 },
  rivalChip: { alignItems: 'flex-end' },
  rivalLabel: {
    fontFamily: T.fontMedium,
    fontSize: 10,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: T.muted,
  },
  rivalTime: { fontFamily: T.fontDisplay, fontSize: 15, color: T.inkSoft, marginTop: 1 },
  label: {
    fontFamily: T.fontMedium,
    fontSize: 11,
    letterSpacing: 1.1,
    textTransform: 'uppercase',
    color: T.muted,
  },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2 },
  name: { fontFamily: T.fontDisplay, fontSize: 19, color: T.ink },
  level: { fontFamily: T.fontMedium, fontSize: 12, color: T.primaryDeep },

  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 14,
  },
  statusText: { fontFamily: T.font, fontSize: 14, color: T.muted, marginTop: 3 },
  weeklyBox: { paddingHorizontal: 14, paddingVertical: 10, alignItems: 'flex-end' },
  weeklyLabel: {
    fontFamily: T.fontMedium,
    fontSize: 10,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: T.muted,
  },
  weeklyValue: { fontFamily: T.fontDisplay, fontSize: 17, color: T.ink, marginTop: 2 },

  dialWrap: { alignSelf: 'center', marginTop: 22 },
  dial: {
    width: 276,
    height: 276,
    borderRadius: 138,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    // 하늘 원반은 테두리 대신 그림자로 떠 있다.
    shadowColor: '#3B3320',
    shadowOpacity: 0.16,
    shadowRadius: 26,
    shadowOffset: { width: 0, height: 12 },
    elevation: 6,
  },
  dialContent: { alignItems: 'center' },
  cycleRow: { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 14 },
  cycleText: { fontFamily: T.fontMedium, fontSize: 13, letterSpacing: 0.3 },
  time: { fontFamily: T.fontDisplay, fontSize: 46, letterSpacing: -1 },
  cycleSub: { fontFamily: T.font, fontSize: 12, marginTop: 12, opacity: 0.8 },

  progressWrap: { marginTop: 20 },

  controls: { flexDirection: 'row', gap: 10, marginTop: 20 },
  mainButton: { flex: 1, alignSelf: 'stretch' },
  mainButtonText: { fontFamily: T.fontMedium, fontSize: 17, color: T.primaryFg },
  iconButton: { width: 56, paddingHorizontal: 0 },

  resignButton: { marginTop: 10 },
  resignText: { fontFamily: T.fontMedium, fontSize: 15, color: T.danger },

  bankWrap: { marginTop: 20, marginBottom: 16 },
  bankCard: { padding: 18 },
  bankHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  bankTitle: { fontFamily: T.fontMedium, fontSize: 16, color: T.ink },
  bankValue: { fontFamily: T.fontDisplay, fontSize: 18, color: T.primaryDeep },
  bankDesc: { fontFamily: T.font, fontSize: 13, lineHeight: 20, color: T.muted, marginTop: 6 },
  bankButtons: { flexDirection: 'row', gap: 8, marginTop: 14 },
  bankButton: { flex: 1, alignSelf: 'stretch', paddingHorizontal: 0 },
  bankStatus: { fontFamily: T.font, fontSize: 13, color: T.muted, marginTop: 14 },
})

export default StudyTimer
