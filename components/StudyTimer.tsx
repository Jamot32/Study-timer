import React, { useEffect, useMemo, useState } from 'react'
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { Moon, Pause, Play, RotateCcw, Settings2, Sun } from 'lucide-react-native'

// ============================================================
// PIXEL STUDY TIMER — React Native (Expo)
// v2: absoluteFill 호환 수정 / 다이얼 그림자 원형 수정 /
//     safe area 대응 / 하늘 전환 주기 상수화
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

// ---------- 테마 토큰 ----------
const T = {
  bg: '#f4f0e6',
  ink: '#2e2218',
  primary: '#d95b2e',
  primaryFg: '#faf6ee',
  secondary: '#e3dcc9',
  muted: '#6e6152',
  fontPixel: 'PressStart2P_400Regular',
}

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
  { t: 0.0, top: '#2b2a66', bottom: '#1e3f8f' },  // 동트기 전: 남색 → 짙은 파랑
  { t: 0.07, top: '#6b3fa0', bottom: '#e87ea1' }, // 여명: 보라 → 분홍
  { t: 0.13, top: '#f5a86c', bottom: '#f7c948' }, // 일출: 연한 주황 → 황금색
  { t: 0.22, top: '#87ceeb', bottom: '#4aa3df' }, // 아침~낮: 하늘색 → 맑은 파랑
  { t: 0.5, top: '#87ceeb', bottom: '#4aa3df' },  // 낮 유지
  { t: 0.57, top: '#f7d154', bottom: '#e8752a' }, // 해 질 녘: 노랑 → 짙은 주황
  { t: 0.63, top: '#d94a3d', bottom: '#ef88a7' }, // 일몰(노을): 붉은색 → 분홍
  { t: 0.7, top: '#7a4f9e', bottom: '#4a4a9e' },  // 매직 아워: 보라 → 남보라
  { t: 0.78, top: '#16204d', bottom: '#050510' }, // 밤: 짙은 남색 → 검은색
  { t: 0.94, top: '#16204d', bottom: '#050510' }, // 밤 유지
  { t: 1.0, top: '#2b2a66', bottom: '#1e3f8f' },  // 다시 동트기 전 (루프 연결)
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

// ---------- 픽셀 프리미티브 ----------
type PixelBoxProps = {
  shadow?: number
  style?: StyleProp<ViewStyle>
  boxStyle?: StyleProp<ViewStyle>
  shadowStyle?: StyleProp<ViewStyle>
  children?: React.ReactNode
}

function PixelBox({ shadow = 4, style, boxStyle, shadowStyle, children }: PixelBoxProps) {
  return (
    <View style={[{ paddingRight: shadow, paddingBottom: shadow }, style]}>
      {shadow > 0 && (
        <View
          pointerEvents="none"
          style={[ABS_FILL, { backgroundColor: T.ink, left: shadow, top: shadow }, shadowStyle]}
        />
      )}
      <View style={[styles.pixelBorder, boxStyle]}>{children}</View>
    </View>
  )
}

type PixelButtonProps = {
  onPress?: () => void
  disabled?: boolean
  shadow?: number
  color?: string
  style?: StyleProp<ViewStyle>
  boxStyle?: StyleProp<ViewStyle>
  accessibilityLabel?: string
  children?: React.ReactNode
}

function PixelButton({
  onPress,
  disabled,
  shadow = 4,
  color = T.primary,
  style,
  boxStyle,
  accessibilityLabel,
  children,
}: PixelButtonProps) {
  const [pressed, setPressed] = useState(false)
  const shift = pressed && !disabled ? shadow : 0

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={[{ paddingRight: shadow, paddingBottom: shadow, opacity: disabled ? 0.4 : 1 }, style]}
    >
      {shadow > 0 && (
        <View
          pointerEvents="none"
          style={[ABS_FILL, { backgroundColor: T.ink, left: shadow, top: shadow }]}
        />
      )}
      <View
        style={[
          styles.pixelBorder,
          { backgroundColor: color, transform: [{ translateX: shift }, { translateY: shift }] },
          boxStyle,
        ]}
      >
        {children}
      </View>
    </Pressable>
  )
}

function PixelProgress({ value }: { value: number }) {
  const stepped = Math.floor(value * 60) / 60
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(value * 100) }}
      style={styles.progressTrack}
    >
      <View style={[styles.progressFill, { width: `${stepped * 100}%` }]} />
    </View>
  )
}

// ---------- 메인 컴포넌트 ----------
export function StudyTimer() {
  const [mode, setMode] = useState<'FOCUS' | 'SHORT BREAK'>('FOCUS')
  const [elapsed, setElapsed] = useState(0)
  const [breakBank, setBreakBank] = useState(0)
  const [isRunning, setIsRunning] = useState(false)
  const [streakBroken, setStreakBroken] = useState(false)
  const [weeklyMax, setWeeklyMax] = useState(0)

  useEffect(() => {
    if (!isRunning) return
    const interval = setInterval(() => {
      setElapsed((current) => {
        const next = current + 1
        if (mode === 'FOCUS') {
          setWeeklyMax((maximum) => Math.max(maximum, next))
          if (next % BREAK_EARN_SECONDS === 0) setBreakBank((value) => value + 5)
        }
        return next
      })
    }, 1000)
    return () => clearInterval(interval)
  }, [isRunning, mode])

  // 하늘/진행 바는 CYCLE_SECONDS 기준으로 돈다.
  // 매초 elapsed가 바뀔 때마다 하늘 색이 키프레임 사이에서 보간된다.
  const cycleProgress = (elapsed % CYCLE_SECONDS) / CYCLE_SECONDS
  const skyColors = useMemo(() => skyAt(cycleProgress + SKY_START), [cycleProgress])
  const isDay = !isSkyDark(skyColors[1])
  const skyText = isDay ? T.ink : '#e8ecf7'
  const breakLabel = breakBank > 0 ? `${breakBank} MIN BANKED` : 'NO BREAK BANKED'

  const toggleTimer = () => {
    if (isRunning) {
      if (mode === 'FOCUS' && breakBank === 0) setStreakBroken(true)
      setIsRunning(false)
      return
    }
    setIsRunning(true)
  }

  const reset = () => {
    setElapsed(0)
    setIsRunning(false)
    setStreakBroken(false)
  }

  const useBreak = (minutes: number) => {
    if (breakBank < minutes) return
    setBreakBank((value) => value - minutes)
    setMode('SHORT BREAK')
    setElapsed(0)
    setIsRunning(true)
  }

  const time = useMemo(() => formatTime(elapsed), [elapsed])
  const SkyIcon = isDay ? Sun : Moon

  return (
    <View
      style={[styles.screen, { paddingTop: 4, paddingBottom: 12 }]}
    >
      <PixelBox shadow={6} boxStyle={styles.frame}>
        {/* 헤더 */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <PixelBox shadow={3} boxStyle={styles.avatar}>
              <Text style={styles.avatarText}>YU</Text>
            </PixelBox>
            <View>
              <Text style={styles.label}>USERNAME</Text>
              <View style={styles.nameRow}>
                <Text style={styles.name}>YUNA</Text>
                <Text style={styles.level}>LVL 04</Text>
              </View>
            </View>
          </View>
          <PixelButton
            shadow={0}
            color={T.secondary}
            accessibilityLabel="Open timer settings"
            boxStyle={styles.iconButtonSmall}
          >
            <Settings2 size={20} color={T.ink} />
          </PixelButton>
        </View>

        {/* 상태 줄 */}
        <View style={styles.statusRow}>
          <View>
            <Text style={styles.label}>{mode}</Text>
            <Text style={styles.statusText}>{isRunning ? 'IN SESSION' : 'READY WHEN YOU ARE'}</Text>
          </View>
          <PixelBox shadow={0} boxStyle={styles.weeklyBox}>
            <Text style={[styles.label, { fontSize: 8 }]}>WEEKLY MAX</Text>
            <Text style={styles.weeklyValue}>{formatWeeklyMax(weeklyMax)}</Text>
          </PixelBox>
        </View>

        {/* 다이얼 */}
        <PixelBox
          shadow={6}
          style={styles.dialWrap}
          boxStyle={styles.dial}
          shadowStyle={styles.dialShadow}
        >
          {/* 보간된 3색을 하드스톱 밴드로 펼쳐서 픽셀 밴딩 유지 */}
          <LinearGradient
            colors={[
              skyColors[0], skyColors[0],
              skyColors[1], skyColors[1],
              skyColors[2], skyColors[2],
            ]}
            locations={[0, 0.34, 0.34, 0.62, 0.62, 1]}
            style={ABS_FILL}
          />
          <View style={styles.dialContent}>
            <View style={styles.cycleRow}>
              <SkyIcon size={16} color={skyText} />
              <Text style={[styles.cycleText, { color: skyText }]}>
                {isDay ? 'DAY CYCLE' : 'NIGHT CYCLE'}
              </Text>
            </View>
            <Text style={[styles.time, { color: skyText }]} accessibilityLiveRegion="polite">
              {time}
            </Text>
            <Text style={[styles.cycleSub, { color: skyText }]}>
              {Math.round(cycleProgress * 100)}% OF CYCLE
            </Text>
          </View>
        </PixelBox>

        <PixelProgress value={cycleProgress} />

        {/* 컨트롤 */}
        <View style={styles.controls}>
          <PixelButton onPress={toggleTimer} style={{ flex: 1 }} boxStyle={styles.mainButton}>
            {isRunning ? (
              <Pause size={20} color={T.primaryFg} />
            ) : (
              <Play size={20} color={T.primaryFg} fill={T.primaryFg} />
            )}
            <Text style={styles.mainButtonText}>{isRunning ? 'PAUSE' : 'START'}</Text>
          </PixelButton>
          <PixelButton
            onPress={reset}
            color={T.secondary}
            accessibilityLabel="Reset timer"
            boxStyle={styles.iconButton}
          >
            <RotateCcw size={20} color={T.ink} />
          </PixelButton>
        </View>

        {/* 브레이크 뱅크 */}
        <PixelBox shadow={0} boxStyle={styles.bankCard}>
          <View style={styles.bankHeader}>
            <Text style={[styles.label, { color: T.ink }]}>SHORT BREAK BANK</Text>
            <Text style={styles.bankValue}>{breakBank}M</Text>
          </View>
          <Text style={styles.bankDesc}>
            1 hour of focus adds 5 minutes. Spend them whenever you need.
          </Text>
          <View style={styles.bankButtons}>
            {[5, 10, 15].map((minutes) => (
              <PixelButton
                key={minutes}
                shadow={2}
                color={T.bg}
                disabled={breakBank < minutes}
                onPress={() => useBreak(minutes)}
                style={{ flex: 1 }}
                boxStyle={styles.bankButton}
              >
                <Text style={styles.bankButtonText}>USE {minutes}M</Text>
              </PixelButton>
            ))}
          </View>
          <Text style={[styles.bankStatus, streakBroken && { color: T.primary }]}>
            {streakBroken ? 'SESSION RECORD BROKEN — NO BREAK WAS BANKED.' : breakLabel}
          </Text>
        </PixelBox>
      </PixelBox>
    </View>
  )
}

// ---------- 스타일 ----------
const styles = StyleSheet.create({
  screen: {
    backgroundColor: T.bg,
    paddingHorizontal: 16,
  },
  pixelBorder: {
    borderWidth: 4,
    borderColor: T.ink,
    backgroundColor: T.bg,
  },
  frame: {
    padding: 0,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 4,
    borderBottomColor: T.ink,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: T.primary,
  },
  avatarText: { fontFamily: T.fontPixel, fontSize: 10, color: T.primaryFg },
  label: { fontFamily: T.fontPixel, fontSize: 9, color: T.muted },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  name: { fontFamily: T.fontPixel, fontSize: 13, color: T.ink },
  level: { fontFamily: T.fontPixel, fontSize: 9, color: T.primary },
  iconButtonSmall: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: T.secondary,
  },

  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 20,
  },
  statusText: { fontFamily: T.fontPixel, fontSize: 9, color: T.muted, marginTop: 8 },
  weeklyBox: {
    backgroundColor: T.secondary,
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignItems: 'flex-end',
  },
  weeklyValue: { fontFamily: T.fontPixel, fontSize: 13, color: T.ink, marginTop: 4 },

  dialWrap: { alignSelf: 'center', marginTop: 24 },
  dial: {
    width: 280,
    height: 280,
    borderRadius: 140,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dialShadow: { borderRadius: 140 },
  dialContent: { alignItems: 'center' },
  cycleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 18 },
  cycleText: { fontFamily: T.fontPixel, fontSize: 9 },
  time: { fontFamily: T.fontPixel, fontSize: 32, letterSpacing: -2 },
  cycleSub: { fontFamily: T.fontPixel, fontSize: 8, marginTop: 16, opacity: 0.75 },

  progressTrack: {
    height: 12,
    marginHorizontal: 16,
    marginTop: 16,
    borderWidth: 2,
    borderColor: T.ink,
    backgroundColor: T.secondary,
  },
  progressFill: { height: '100%', backgroundColor: T.primary },

  controls: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, marginTop: 24 },
  mainButton: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  mainButtonText: { fontFamily: T.fontPixel, fontSize: 10, color: T.primaryFg },
  iconButton: { width: 56, height: 56, alignItems: 'center', justifyContent: 'center' },

  bankCard: {
    marginHorizontal: 16,
    marginTop: 20,
    marginBottom: 16,
    padding: 14,
    backgroundColor: T.secondary,
  },
  bankHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  bankValue: { fontFamily: T.fontPixel, fontSize: 13, color: T.primary },
  bankDesc: { fontFamily: T.fontPixel, fontSize: 8, lineHeight: 14, color: T.muted, marginTop: 8 },
  bankButtons: { flexDirection: 'row', gap: 8, marginTop: 14 },
  bankButton: { height: 40, alignItems: 'center', justifyContent: 'center' },
  bankButtonText: { fontFamily: T.fontPixel, fontSize: 8, color: T.ink },
  bankStatus: { fontFamily: T.fontPixel, fontSize: 8, color: T.muted, marginTop: 12 },
})

export default StudyTimer