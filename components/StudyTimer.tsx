import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Alert, Animated, AppState, Easing, Platform, Pressable, StyleSheet, Text, View } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { Check, Coins, Flag, Flame, Moon, Pause, Play, RotateCcw, Sun } from 'lucide-react-native'
import Svg, { Circle, Defs, LinearGradient as SvgGradient, Stop } from 'react-native-svg'
import { confirmDestructive } from '../lib/confirm'
import { useStudyTimer } from '../lib/useStudyTimer'
import { awayOutcome } from '../lib/away'
import { type Profile } from '../lib/auth'
import { Avatar } from './Avatar'
import ConfirmDialog from './PixelConfirm'
import { Button, Card, ProgressBar, RADIUS, T } from './nova'
import { formatMatchLength, type Rank } from '../lib/ranks'
import {
  cpuStatusLabel,
  initialCpuState,
  tickCpu,
  type CpuOpponent,
  type CpuState,
} from '../lib/cpuOpponent'

// ============================================================
// STUDY TIMER — React Native (Expo)
// 하늘이 도는 원형 다이얼. 색은 nova / secret garden 팔레트를 따른다.
// ============================================================

// ---------- 설정 ----------
// 한 시간이 기준. 하늘도, 아래 게이지도, 불꽃이 거세지는 주기도 모두 여기에 맞춘다.
const HOUR_SECONDS = 3600
// 하늘이 한 사이클(낮→밤) 도는 데 걸리는 시간(초). 한 시간에 한 바퀴.
const CYCLE_SECONDS = HOUR_SECONDS
// 사이클을 어느 시점에서 시작할지 (0~1).
// 0.22 = 아침~낮 시작 지점. 0이면 동트기 전부터 시작.
const SKY_START = 0.22

// 브레이크 적립 기준(초).
const BREAK_EARN_SECONDS = HOUR_SECONDS

// ---------- 대전 ----------
// 티어가 없을 때 쓰는 기본 판 길이. 보통은 rank.matchSeconds 가 이 값을 대신한다.
const BATTLE_MAX_SECONDS = 5 * 3600
// 집중 1분에 H-Coin 하나.
const COIN_SECONDS = 60
// 상대가 한 시간을 채울 때마다 불꽃이 한 단계 더 거세진다. 5단계가 끝.
const FLAME_STAGES = 5

// 링 한 바퀴 = 한 시간. 바퀴를 넘길 때마다 게이지 색이 올리브에서 앰버로 달아오른다.
// 마지막 색에 닿으면 그대로 유지한다.
const LAP_COLORS: readonly (readonly [string, string])[] = [
  ['#6B8E23', '#556B2F'], // 1시간: 올리브 그린
  ['#83A129', '#617A2C'], // 2시간: 밝은 잎색
  ['#A9B02A', '#828A27'], // 3시간: 익은 풀색
  ['#D9A227', '#A87A1F'], // 4시간: 금빛
  ['#F59E0B', '#D97706'], // 5시간: 앰버
] as const
// 과목 기능이 붙기 전까지 일반 모드 상단에 띄우는 자리.
const FOCUS_SUBJECT = 'Deep focus'

// ---------- 다이얼 팔레트 (올리브 그린 + 앰버) ----------
const DIAL = {
  base: '#1C1F1A',
  track: '#2B3126',
  gauge: '#6B8E23',
  gaugeDeep: '#556B2F',
  amber: '#F59E0B',
  amberDeep: '#D97706',
  text: '#F3F4F6',
  textDim: '#A7AD99',
} as const

// 하늘은 링 안쪽에 그대로 두되 이만큼 어둡게 깔아 숫자가 뜨게 한다.
const SKY_DIM = 0.76

// 숫자가 바뀌어도 폭이 흔들리지 않게 고정폭 글꼴을 쓴다.
const TIMER_FONT = Platform.select({
  ios: 'Menlo',
  android: 'monospace',
  default: 'ui-monospace, SFMono-Regular, Menlo, monospace',
})

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

/** 대전 격차용. 한 시간을 넘으면 시:분:초, 아니면 분:초. */
const formatGap = (totalSeconds: number) => {
  const s = Math.abs(totalSeconds)
  const mm = Math.floor((s % 3600) / 60).toString().padStart(2, '0')
  const ss = (s % 60).toString().padStart(2, '0')
  if (s >= 3600) return `${Math.floor(s / 3600)}:${mm}:${ss}`
  return `${mm}:${ss}`
}

const clamp01 = (value: number) => Math.max(0, Math.min(1, value))

// ---------- 진행 링 ----------
const DIAL_SIZE = 276
const RING_STROKE = 14
const RING_R = 120
const RING_CX = DIAL_SIZE / 2
const RING_LEN = 2 * Math.PI * RING_R

// 진행도(0~1)를 링 위 좌표로. 12시에서 출발해 시계 방향으로 돈다.
const pointOn = (progress: number, radius: number) => {
  const angle = clamp01(progress) * Math.PI * 2 - Math.PI / 2
  return { x: RING_CX + Math.cos(angle) * radius, y: RING_CX + Math.sin(angle) * radius }
}

function DialRing({
  progress,
  colors,
  opponent,
  heat,
}: {
  /** 이번 바퀴의 진행률 0~1. */
  progress: number
  /** 게이지 그라디언트 두 색. 바퀴마다 바뀐다. */
  colors: readonly [string, string]
  /** 상대 진행률 0~1. 대전이 아니면 null. */
  opponent: number | null
  /** 상대 불꽃의 세기 0~1. 번짐의 크기와 진하기를 키운다. */
  heat: number
}) {
  const filled = clamp01(progress)
  const rival = opponent === null ? null : pointOn(opponent, RING_R)
  return (
    <Svg width={DIAL_SIZE} height={DIAL_SIZE} style={ABS_FILL} pointerEvents="none">
      <Defs>
        <SvgGradient id="gauge" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor={colors[0]} />
          <Stop offset="1" stopColor={colors[1]} />
        </SvgGradient>
      </Defs>

      {/* 비어 있는 궤도 */}
      <Circle cx={RING_CX} cy={RING_CX} r={RING_R} stroke={DIAL.track} strokeWidth={RING_STROKE} fill="none" />

      {/* 내 공부 시간 게이지 */}
      {filled > 0 && (
        <Circle
          cx={RING_CX}
          cy={RING_CX}
          r={RING_R}
          stroke="url(#gauge)"
          strokeWidth={RING_STROKE}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={`${RING_LEN} ${RING_LEN}`}
          strokeDashoffset={RING_LEN * (1 - filled)}
          transform={`rotate(-90 ${RING_CX} ${RING_CX})`}
        />
      )}

      {/* 상대가 서 있는 자리의 번짐. 불꽃은 이 위에 겹쳐 올린다. */}
      {rival && (
        <Circle cx={rival.x} cy={rival.y} r={13 + heat * 9} fill={DIAL.amber} opacity={0.16 + heat * 0.22} />
      )}
    </Svg>
  )
}

// ---------- 메인 컴포넌트 ----------
export function StudyTimer({
  onFinished,
  onOpenProfile,
  onResign,
  matchStarting = false,
  opponent,
  rank,
  profile,
}: {
  onFinished?: () => void
  onOpenProfile?: () => void
  /** Give up the match: drops the session unsaved and hands the screen back. */
  onResign?: () => void
  /** 3-2-1 카운트다운이 도는 중. 끝나기 전까지는 상대 시계도 멈춰 있다. */
  matchStarting?: boolean
  /** 이번 판의 상대. 매칭 때 지어진 CPU 가 그대로 넘어온다. */
  opponent?: CpuOpponent | null
  /** 이번 판의 티어. 판 길이와 판돈이 여기서 온다. */
  rank?: Rank | null
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
  // 상대는 cpuOpponent 모델이 1초씩 굴려 준다. 쉬기도 하고, 기권도 한다.
  const [cpu, setCpu] = useState<CpuState | null>(null)

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
  const opponentElapsed = cpu?.studiedSeconds ?? 0
  // 판 길이는 티어가 정한다 — Iron 30분에서 Challenger 5시간까지.
  const matchSeconds = rank?.matchSeconds ?? BATTLE_MAX_SECONDS

  // 상대가 바뀌면(=새 판) 상태를 처음부터 세운다.
  useEffect(() => {
    setCpu(opponent ? initialCpuState(opponent) : null)
  }, [opponent])

  // CPU 는 내 공부 시간을 보고 반응한다. 리스너를 매초 새로 걸지 않도록 ref 로 읽는다.
  const focusRef = useRef(0)
  focusRef.current = focusElapsed

  useEffect(() => {
    if (!inBattle || matchStarting || !opponent) return
    const interval = setInterval(() => {
      setCpu((state) => (state ? tickCpu(state, opponent, { userSeconds: focusRef.current }) : state))
    }, 1000)
    return () => clearInterval(interval)
  }, [inBattle, matchStarting, opponent])

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

  // 링도 아래 게이지도 한 시간에 한 바퀴. 채우면 0에서 다시 돈다.
  const hourProgress = (elapsed % HOUR_SECONDS) / HOUR_SECONDS
  const hoursDone = Math.floor(elapsed / HOUR_SECONDS)
  const lapColors = LAP_COLORS[Math.min(hoursDone, LAP_COLORS.length - 1)]
  // 상대 불꽃도 같은 바퀴 위에 선다. 앞뒤 차이는 위쪽 격차 숫자로 읽는다.
  const opponentProgress = inBattle ? (opponentElapsed % HOUR_SECONDS) / HOUR_SECONDS : null
  // 불꽃 아이콘은 SVG 밖에 겹쳐 놓는다. 링 위 좌표만 미리 뽑아 둔다.
  const rivalPoint = opponentProgress === null ? null : pointOn(opponentProgress, RING_R)
  // 상대가 쌓은 시간만큼 불꽃이 커지고 색이 밝아진다.
  const flameStage = rivalPoint === null ? 0 : Math.min(Math.floor(opponentElapsed / HOUR_SECONDS), FLAME_STAGES)
  const flameHeat = flameStage / FLAME_STAGES
  const flameColor = lerpColor(DIAL.amberDeep, '#FBBF24', flameHeat)
  const flameSize = 18 + flameStage * 2
  // 쉬거나 판을 접은 상대의 불꽃은 사그라든다.
  const flameAlive = cpu?.phase === 'studying'
  const rivalName = opponent?.name ?? 'Rival'
  // 내가 앞서면 양수. 브레이크 시간은 대전에 안 들어간다.
  const lead = focusElapsed - opponentElapsed
  const coins = Math.floor(focusElapsed / COIN_SECONDS)
  const paused = !onBreak && !isRunning && elapsedMs > 0

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

  // 대전은 카운트다운이 끝나는 순간 알아서 출발한다. 직접 누를 필요 없다.
  const autoStarted = useRef(false)
  useEffect(() => {
    if (!inBattle) {
      autoStarted.current = false
      return
    }
    if (matchStarting || autoStarted.current) return
    autoStarted.current = true
    // 'ready' 일 때만. 사용자가 손수 멈춰 둔 세션을 다시 밀어 올리지는 않는다.
    if (state === 'ready') toggle()
  }, [inBattle, matchStarting, state, toggle])

  // 티어의 판 길이를 채우면 판이 스스로 끝난다. 시간은 저장된다.
  useEffect(() => {
    if (!inBattle || onBreak) return
    if (focusElapsed >= matchSeconds) handleFinish()
  }, [focusElapsed, handleFinish, inBattle, matchSeconds, onBreak])

  // PAUSED 는 앰버로 천천히 깜빡인다.
  const blink = useRef(new Animated.Value(1)).current
  useEffect(() => {
    if (!paused) {
      blink.setValue(1)
      return
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(blink, { toValue: 0.25, duration: 650, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(blink, { toValue: 1, duration: 650, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ])
    )
    loop.start()
    return () => loop.stop()
  }, [blink, paused])

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
    setCpu(opponent ? initialCpuState(opponent) : null)
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
              <Text style={styles.rivalLabel} numberOfLines={1}>
                {rivalName}
              </Text>
              <Text style={styles.rivalTime}>{formatTime(opponentElapsed)}</Text>
              {cpu && <Text style={styles.rivalStatus}>{cpuStatusLabel(cpu)}</Text>}
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
            {rank && (
              <Text style={[styles.rankLine, { color: rank.color }]}>
                {rank.name} · {formatMatchLength(rank.matchSeconds)} match · {rank.bet} coins staked
              </Text>
            )}
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
            {/* 하늘을 눌러 어둡게 깐다. 숫자와 게이지가 읽히는 게 먼저다. */}
            <View style={[ABS_FILL, { backgroundColor: DIAL.base, opacity: SKY_DIM }]} />
            <DialRing progress={hourProgress} colors={lapColors} opponent={opponentProgress} heat={flameHeat} />
            <View style={styles.dialContent}>
              {/* 위: 대전이면 격차, 아니면 지금 붙잡고 있는 과목 */}
              {inBattle ? (
                <View style={styles.dialTop}>
                  <Text style={[styles.gapText, { color: lead >= 0 ? DIAL.gauge : DIAL.amber }]}>
                    {lead >= 0 ? '▲' : '▼'} {lead >= 0 ? '+' : '-'}
                    {formatGap(lead)}
                  </Text>
                  <Text style={styles.dialSub} numberOfLines={1}>
                    vs {rivalName}
                  </Text>
                </View>
              ) : (
                <View style={styles.dialTop}>
                  <View style={styles.cycleRow}>
                    <SkyIcon size={14} color={DIAL.textDim} />
                    <Text style={styles.cycleText}>{FOCUS_SUBJECT}</Text>
                  </View>
                  <Text style={styles.dialSub}>{isDay ? 'Day cycle' : 'Night cycle'}</Text>
                </View>
              )}

              {/* 가운데: 시:분:초 */}
              <Text
                style={styles.time}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.7}
                accessibilityLiveRegion="polite"
              >
                {time}
              </Text>

              {/* 아래: 실시간 재화와 상태 */}
              <View style={styles.dialBottom}>
                <View style={styles.coinRow}>
                  <Coins size={13} color={DIAL.amber} strokeWidth={2.4} />
                  <Text style={styles.coinText}>+{coins} H-Coin</Text>
                </View>
                {paused ? (
                  <Animated.Text style={[styles.pausedText, { opacity: blink }]}>PAUSED</Animated.Text>
                ) : (
                  <Text style={styles.dialSub}>
                    {hoursDone > 0 ? `${hoursDone}H done · lap ${hoursDone + 1}` : 'First lap'}
                  </Text>
                )}
              </View>
            </View>

            {/* 상대의 불꽃. 내 게이지 머리를 쫓아온다. */}
            {rivalPoint && (
              <View
                style={[
                  styles.rivalMark,
                  {
                    left: rivalPoint.x - 16,
                    top: rivalPoint.y - 16,
                    shadowColor: flameColor,
                    shadowOpacity: 0.35 + flameHeat * 0.45,
                    shadowRadius: 4 + flameStage * 3,
                  },
                ]}
              >
                <Flame
                  size={flameSize}
                  color={flameColor}
                  fill={flameColor}
                  strokeWidth={1.8}
                  opacity={flameAlive ? 1 : 0.4}
                />
              </View>
            )}
          </View>
        </View>

        <View style={styles.progressWrap}>
          <View style={styles.hourRow}>
            <Text style={styles.label}>{hoursDone > 0 ? `Hour ${hoursDone + 1}` : 'This hour'}</Text>
            <Text style={styles.hourValue}>{Math.round(hourProgress * 100)}%</Text>
          </View>
          {/* 링과 같은 색으로 찬다. 바퀴가 바뀌면 여기 색도 같이 바뀐다. */}
          <ProgressBar value={hourProgress} height={8} color={lapColors[0]} />
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
  rivalStatus: { fontFamily: T.font, fontSize: 10, color: T.muted, marginTop: 1 },
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
  rankLine: { fontFamily: T.fontMedium, fontSize: 11, marginTop: 4 },
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
    width: DIAL_SIZE,
    height: DIAL_SIZE,
    borderRadius: DIAL_SIZE / 2,
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
  dialContent: { alignItems: 'center', width: RING_R * 2 - RING_STROKE - 18 },
  rivalMark: {
    position: 'absolute',
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: DIAL.base,
    // 불꽃 자체가 빛나 보이게. 색과 세기는 단계에 따라 덮어쓴다.
    shadowOffset: { width: 0, height: 0 },
    elevation: 4,
  },
  dialTop: { alignItems: 'center', marginBottom: 12 },
  dialBottom: { alignItems: 'center', marginTop: 14, height: 34 },
  cycleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  cycleText: { fontFamily: T.fontMedium, fontSize: 13, letterSpacing: 0.3, color: DIAL.textDim },
  dialSub: { fontFamily: T.font, fontSize: 11, letterSpacing: 0.4, color: DIAL.textDim, marginTop: 4 },
  gapText: {
    fontFamily: TIMER_FONT,
    fontSize: 17,
    letterSpacing: 0.6,
    fontVariant: ['tabular-nums'],
  },
  // 고정폭이라 초가 바뀌어도 숫자가 좌우로 흔들리지 않는다.
  time: {
    fontFamily: TIMER_FONT,
    fontSize: 34,
    letterSpacing: 0,
    color: DIAL.text,
    fontVariant: ['tabular-nums'],
    includeFontPadding: false,
  },
  coinRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  coinText: { fontFamily: T.fontMedium, fontSize: 13, color: DIAL.amber, letterSpacing: 0.3 },
  pausedText: {
    fontFamily: T.fontMedium,
    fontSize: 12,
    letterSpacing: 2,
    color: DIAL.amber,
    marginTop: 4,
  },

  progressWrap: { marginTop: 20 },
  hourRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  hourValue: { fontFamily: T.fontMedium, fontSize: 12, color: T.inkSoft },

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
