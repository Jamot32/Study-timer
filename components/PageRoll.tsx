import React, { useCallback, useEffect, useRef, useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import Svg, { G, Line, Polygon } from 'react-native-svg'
import { PixelButton, T } from '@/components/pixel'

// ============================================================
// PAGE ROLL — 무작위 페이지 뽑기
// 덮인 책을 아무 데나 펼치고, 마주 붙은 두 쪽을 골라 눕혀 본다.
//
// RN 에는 CSS 의 transform-style: preserve-3d 가 없어서 뷰를 겹쳐
// 3D 를 만들 수 없다. 그래서 책의 3D 좌표를 직접 투영해 SVG 로 그린다.
//
// 책은 책등(x=0)을 축으로 도는 판의 모음이다. 표지도 판 하나다.
//   theta 0   = 왼쪽에 납작하게 누움
//   theta 90  = 곧게 섬
//   theta 180 = 오른쪽에 납작하게 누움
// 덮인 책은 전부 180 에 쌓여 있다. 펼치면 앞표지가 먼저 0 까지 넘어가
// 왼쪽 더미의 맨 밑이 되고, 페이지가 그 위에 얹힌다.
// ============================================================

const TOTAL = 320          // 책 두께는 고정
const SHEETS = 8           // 부채꼴로 세우는 낱장 수
const W = 260              // 한 쪽 너비(책 좌표계)
const H = 340              // 한 쪽 높이
const PERSP = 1300         // 투시 거리
const FAN_LOW = 22         // 가장 눕는 낱장의 각. 이보다 낮으면 표지에 붙어 버린다.
const FAN_GAP = 13         // 낱장 사이 간격
const TILT_BOOK = 30       // 세워 둔 책을 내려다보는 각
const RULES = 12           // 한 쪽에 적힌 줄 수
const HOVER = 4            // 마우스가 올라간 낱장이 더 들리는 각
const BLOCK = 62           // 책 전체 두께. 펼치면 좌우로 나눠 갖는다.
const EDGES = 26           // 종이 뭉치 단면에 긋는 줄 수

const STEP_MS = 45         // 한 프레임. 픽셀 느낌을 살려 계단식으로 움직인다.
const STEPS = 9

// ---------- 3D → 2D ----------
type Pt = { x: number; y: number }

function project(x: number, y: number, z: number, tilt: number, panX: number): Pt {
  const t = (tilt * Math.PI) / 180
  const y2 = y * Math.cos(t) - z * Math.sin(t)
  const z2 = y * Math.sin(t) + z * Math.cos(t)
  const k = PERSP / (PERSP - z2)
  return { x: (x + panX) * k, y: y2 * k }
}

// 판 위의 한 점. u = 책등(0)에서 바깥(1), v = 위(0)에서 아래(1).
// zOff 는 그 판이 뭉치의 어느 높이에 놓였는지. 표지를 뭉치 위아래에 앉힐 때 쓴다.
function leafPt(theta: number, u: number, v: number, tilt: number, panX: number, zOff = 0): Pt {
  const r = (theta * Math.PI) / 180
  return project(-W * Math.cos(r) * u, -H / 2 + H * v, W * Math.sin(r) * u + zOff, tilt, panX)
}

// padV 는 판이 종이보다 위아래로 더 나온 양(비율). 표지가 종이를 덮는 턱이다.
function quadPts(theta: number, tilt: number, panX: number, grow = 1, zOff = 0, padV = 0): Pt[] {
  return ([[0, -padV], [grow, -padV], [grow, 1 + padV], [0, 1 + padV]] as Array<[number, number]>)
    .map(([u, v]) => leafPt(theta, u, v, tilt, panX, zOff))
}

const fmt = (pts: Pt[]) => pts.map((p) => p.x.toFixed(1) + ',' + p.y.toFixed(1)).join(' ')

const quad = (theta: number, tilt: number, panX: number, grow = 1, zOff = 0, padV = 0) =>
  fmt(quadPts(theta, tilt, panX, grow, zOff, padV))

const BOARD_OUT = 1.04     // 표지가 종이보다 옆으로 더 나온 비율
const BOARD_PAD = 0.045    // 위아래로 더 나온 비율

// 광선 쏘기. 마우스가 어느 낱장 위에 있는지 판정하는 데 쓴다.
function inside(pts: Pt[], x: number, y: number): boolean {
  let hit = false
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const a = pts[i]
    const b = pts[j]
    if (a.y > y !== b.y > y && x < ((b.x - a.x) * (y - a.y)) / (b.y - a.y) + a.x) hit = !hit
  }
  return hit
}

// SVG viewBox. 화면 좌표를 여기 좌표로 되돌릴 때 쓴다.
const VB = { x: -300, y: -215, w: 600, h: 430 }

// 앞뒤는 판이 얼마나 섰는지로 정한다. 누운 판끼리 겹칠 때만 쌓인 순서가 갈라 준다.
const depthOf = (theta: number) => Math.sin((theta * Math.PI) / 180) * 100

// 덮인 책의 쌓임 순서(아래→위): 뒤표지, 마지막 장 … 첫 장, 앞표지.
const BIAS_BACK = 0
const BIAS_LEAF = (i: number) => (SHEETS - i) * 0.1
const BIAS_FRONT = 0.9

// ---------- 장면 ----------
type Scene = { tilt: number; panX: number; cover: number; back: number; theta: number[] }

const lerp = (a: number, b: number, t: number) => a + (b - a) * t

// 덮인 책: 전부 오른쪽에 쌓여 있다. 그 반쪽이 가운데 오도록 왼쪽으로 민다.
const SHUT: Scene = {
  tilt: TILT_BOOK,
  panX: -W / 2,
  cover: 180,
  back: 180,
  theta: Array(SHEETS).fill(180),
}

// 부채꼴: 화면 왼쪽부터 22, 35, 48, 61 / 119, 132, 145, 158 도.
const fanTheta = (i: number) =>
  i < SHEETS / 2 ? FAN_LOW + FAN_GAP * i : 180 - (FAN_LOW + FAN_GAP * (SHEETS - 1 - i))

const OPEN: Scene = {
  tilt: TILT_BOOK,
  panX: 0,
  cover: 0,
  back: 180,
  theta: Array.from({ length: SHEETS }, (_, i) => fanTheta(i)),
}

// 고른 두 장 사이를 갈라 편 상태. 그 앞은 왼쪽에, 뒤는 오른쪽에 깔린다.
function flatScene(lo: number, hi: number): Scene {
  return {
    tilt: 0,
    panX: 0,
    cover: 0,
    back: 180,
    theta: Array.from({ length: SHEETS }, (_, i) => (i <= lo ? 2 : i >= hi ? 178 : 90)),
  }
}

function tween(from: Scene, to: Scene, t: number): Scene {
  return {
    tilt: lerp(from.tilt, to.tilt, t),
    panX: lerp(from.panX, to.panX, t),
    cover: lerp(from.cover, to.cover, t),
    back: lerp(from.back, to.back, t),
    theta: to.theta.map((v, i) => lerp(from.theta[i], v, t)),
  }
}

// ---------- 쪽번호 ----------
// 지금 펼친 자리를 기준으로 여덟 장이 맡는 쪽을 나눈다. 화면에는 나오지 않는다.
// 배열은 화면 왼→오 순서. 왼쪽 더미는 바깥이 먼 쪽, 오른쪽 더미는 책등이 가까운 쪽.
function pagesFor(page: number, n: number): number[] {
  const half = SHEETS / 2
  const left: number[] = []
  const right: number[] = []
  for (let k = 0; k < half; k++) {
    left.push(Math.max(1, Math.round(page - (k + 1) * (page - 1) / (half + 1))))
    right.push(Math.min(n, Math.round(page + (k + 1) * (n - page) / (half + 1))))
  }
  return left.reverse().concat(right)
}

// 한 쪽을 고르면 마주 붙은 쪽까지 두 쪽이 잡힌다. 왼쪽이 짝수, 오른쪽이 홀수.
function spreadOf(p: number, n: number): [number, number] {
  const a = Math.max(1, p % 2 === 0 ? p : p - 1)
  return [a, Math.min(a + 1, n)]
}

// 줄 하나의 길이. 장마다 달라 보이도록 섞어 둔 값.
const ruleWidth = (i: number, r: number) => 0.6 + ((i * 7 + r * 13) % 34) / 100

export default function PageRoll() {
  const [scene, setScene] = useState<Scene>(SHUT)
  const [mode, setMode] = useState<'shut' | 'open' | 'flat'>('shut')
  const [busy, setBusy] = useState(false)
  const [page, setPage] = useState(160)
  const [pages, setPages] = useState<number[]>(() => pagesFor(160, TOTAL))
  const [pick, setPick] = useState<{ lo: number; hi: number; a: number; b: number } | null>(null)
  const [hover, setHover] = useState<number | null>(null)

  const sceneRef = useRef(scene)
  sceneRef.current = scene
  const timer = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => () => { if (timer.current) clearInterval(timer.current) }, [])

  const animate = useCallback((to: Scene, done?: () => void) => {
    if (timer.current) clearInterval(timer.current)
    const from = sceneRef.current
    let i = 0
    setBusy(true)
    timer.current = setInterval(() => {
      i += 1
      const next = i >= STEPS ? to : tween(from, to, i / STEPS)
      sceneRef.current = next
      setScene(next)
      if (i >= STEPS) {
        if (timer.current) clearInterval(timer.current)
        timer.current = null
        setBusy(false)
        done?.()
      }
    }, STEP_MS)
  }, [])

  // 뽑기 한 번 = 책을 덮었다가 아무 데나 펼치기
  const roll = useCallback(() => {
    if (busy) return
    setPick(null)
    setHover(null)
    const p = Math.floor(Math.random() * TOTAL) + 1
    const open = () => {
      setPage(p)
      setPages(pagesFor(p, TOTAL))
      setMode('open')
      animate(OPEN)
    }
    if (mode === 'shut') open()
    else {
      setMode('shut')
      animate(SHUT, open)
    }
  }, [busy, mode, animate])

  const reset = useCallback(() => {
    if (busy) return
    setPick(null)
    setHover(null)
    setPage(1)
    setPages(pagesFor(1, TOTAL))
    setMode('shut')
    animate(SHUT)
  }, [busy, animate])

  // 부채꼴에서 바로 옆에 붙어 있는 장까지 함께 잡는다.
  const tapSheet = useCallback((i: number) => {
    if (busy || mode !== 'open') return
    const j = i < SHEETS - 1 ? i + 1 : i - 1
    const [a, b] = spreadOf(pages[i], TOTAL)
    setPick({ lo: Math.min(i, j), hi: Math.max(i, j), a, b })
  }, [busy, mode, pages])

  // SELECT: 책이 땅에 붙게 눕고, 고른 두 쪽만 위로 올라온다.
  const toggleFlat = useCallback(() => {
    if (busy || !pick) return
    if (mode === 'flat') {
      setMode('open')
      animate(OPEN)
    } else {
      setHover(null)
      setMode('flat')
      animate(flatScene(pick.lo, pick.hi))
    }
  }, [busy, pick, mode, animate])

  const flat = mode === 'flat'
  const { tilt, panX, theta, cover, back } = scene

  // 마우스가 올라간 낱장만 조금 더 세운다. 왼쪽 더미는 키우고 오른쪽 더미는 줄여야 들린다.
  const drawTheta = (i: number) => {
    const th = theta[i]
    if (mode !== 'open' || hover !== i) return th
    return th < 90 ? th + HOVER : th - HOVER
  }

  // 두께는 앞표지가 넘어간 만큼 오른쪽에서 왼쪽으로 옮겨 간다.
  const ratio = Math.min(1, Math.max(0, page / TOTAL))
  const spread = 1 - cover / 180
  // 왼쪽 더미는 앞표지가 거의 내려앉은 뒤에야 생긴다. 그전에 그리면
  // 아무것도 없는 왼쪽 바닥에 종이 뭉치만 떠 있게 된다.
  const landed = Math.max(0, Math.min(1, (spread - 0.7) / 0.3))
  const thickL = landed * (4 + ratio * (BLOCK - 8))
  const thickR = BLOCK - thickL

  // 종이 뭉치의 밑면. 표지 뒤쪽(-z)으로 두께만큼 뻗어야 표지 아래로 삐져나온다.
  const footQuad = (side: -1 | 1, thick: number) =>
    [
      project(0, H / 2, 0, tilt, panX),
      project(side * W, H / 2, 0, tilt, panX),
      project(side * W, H / 2, -thick, tilt, panX),
      project(0, H / 2, -thick, tilt, panX),
    ]
      .map((p) => p.x.toFixed(1) + ',' + p.y.toFixed(1))
      .join(' ')

  // 단면에 그은 줄 하나가 종이 한 장이다.
  const footEdges = (side: -1 | 1, thick: number) =>
    Array.from({ length: EDGES - 1 }, (_, s) => {
      const x = side * W * ((s + 1) / EDGES)
      const a = project(x, H / 2, 0, tilt, panX)
      const b = project(x, H / 2, -thick, tilt, panX)
      return (
        <Line key={side + '-' + s} x1={a.x} y1={a.y} x2={b.x} y2={b.y}
          stroke={T.ink} strokeWidth={2} opacity={0.55} />
      )
    })

  // 앞표지는 제 뭉치 위(z=0), 뒤표지는 제 뭉치 밑(z=-두께)에 앉는다.
  // 그래야 덮인 책 맨 아래로 뒤표지가 한 겹 삐져나와 보인다.
  const board = (th: number, key: string, zOff: number) => (
    <Polygon key={key} points={quad(th, tilt, panX, BOARD_OUT, zOff, BOARD_PAD)}
      fill={T.primary} stroke={T.ink} strokeWidth={4} />
  )

  const leaf = (i: number) => {
    const th = drawTheta(i)
    const isPick = !!pick && (i === pick.lo || i === pick.hi)
    const marked = isPick && !flat
    return (
      <G key={'leaf-' + i} onPress={() => tapSheet(i)}>
        {/* 골라 둔 장도 표지가 아니라 종이다. 테두리 색만 바꿔 표시한다. */}
        <Polygon points={quad(th, tilt, panX)}
          fill={T.bg} stroke={marked ? T.primary : T.ink} strokeWidth={4} />
        {Array.from({ length: RULES }, (_, r) => {
          const v = 0.1 + r * 0.045
          // u 는 책등에서 바깥으로 재는 값이다. 왼쪽 쪽은 글이 바깥에서
          // 시작하므로 거기 붙여야 들쭉날쭉한 끝이 책등 쪽으로 온다.
          const len = 0.76 * ruleWidth(i, r)
          const left = th < 90
          const a = leafPt(th, left ? 0.88 - len : 0.12, v, tilt, panX)
          const b = leafPt(th, left ? 0.88 : 0.12 + len, v, tilt, panX)
          if (marked || (flat && isPick)) {
            // 골라 둔 장, 그리고 펼쳐서 보여 주는 자리는 발광 없이 또렷한 잉크 줄
            return (
              <Line key={r} x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                stroke={T.ink} strokeWidth={4} />
            )
          }
          // 고르기 전에는 읽히지 않는다. 두 겹으로 겹쳐 발광처럼 보이게.
          return (
            <G key={r}>
              <Line x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                stroke={T.primary} strokeWidth={11} opacity={0.16} />
              <Line x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                stroke={T.primary} strokeWidth={4} opacity={0.75} />
            </G>
          )
        })}
      </G>
    )
  }

  // 뭉치의 맨 윗장. 이게 없으면 뭉치 밑에 깔린 표지가 그대로 비쳐 보인다.
  const topSheet = (th: number) => {
    const left = th < 90
    return (
      <G>
        <Polygon points={quad(th, tilt, panX)} fill={T.bg} stroke={T.ink} strokeWidth={4} />
        {Array.from({ length: RULES }, (_, r) => {
          const v = 0.1 + r * 0.045
          const len = 0.76 * ruleWidth(SHEETS, r)
          const a = leafPt(th, left ? 0.88 - len : 0.12, v, tilt, panX)
          const b = leafPt(th, left ? 0.88 : 0.12 + len, v, tilt, panX)
          return (
            <Line key={r} x1={a.x} y1={a.y} x2={b.x} y2={b.y}
              stroke={T.ink} strokeWidth={4} />
          )
        })}
      </G>
    )
  }

  const footNode = (side: -1 | 1, thick: number, th: number) => (
    <G key={'foot' + side}>
      <Polygon points={footQuad(side, thick)} fill={T.bg} stroke={T.ink} strokeWidth={3} />
      {footEdges(side, thick)}
      {topSheet(th)}
    </G>
  )

  // 판을 전부 깊이순으로 세워 놓고 뒤에서 앞으로 그린다.
  // 종이 뭉치(=아직 안 펴진 페이지들)는 제 표지 바로 위에 얹힌다. 표지 뒤가 아니다.
  const parts: Array<{ k: number; node: React.ReactNode }> = [
    { k: depthOf(back) + BIAS_BACK, node: board(back, 'back', -thickR) },
    { k: depthOf(cover) + BIAS_FRONT, node: board(cover, 'front', -thickL) },
  ]
  if (thickR > 1) parts.push({ k: depthOf(back) + BIAS_BACK + 0.05, node: footNode(1, thickR, back) })
  if (thickL > 1) parts.push({ k: depthOf(cover) + BIAS_FRONT + 0.05, node: footNode(-1, thickL, cover) })

  const leafKey = (i: number) =>
    depthOf(drawTheta(i)) + BIAS_LEAF(i) +
    (flat && pick && (i === pick.lo || i === pick.hi) ? 20 : 0)

  for (let i = 0; i < SHEETS; i++) parts.push({ k: leafKey(i), node: leaf(i) })
  parts.sort((a, b) => a.k - b.k)

  // 마우스가 올라간 낱장 찾기. 앞에 있는 것부터 뒤로 훑는다.
  const pickAt = (px: number, py: number, w: number, h: number): number | null => {
    if (!w || !h) return null
    // viewBox 는 xMidYMid meet 로 맞춰지므로 남는 쪽에 여백이 반씩 생긴다.
    const s = Math.min(w / VB.w, h / VB.h)
    const x = (px - (w - VB.w * s) / 2) / s + VB.x
    const y = (py - (h - VB.h * s) / 2) / s + VB.y
    // 판정은 들리기 전 각도로 한다. 들린 각도로 재면 낱장이 커서 밑에서
    // 빠져나가며 hover 가 껐다 켜졌다 한다.
    const rest = (i: number) => depthOf(theta[i]) + BIAS_LEAF(i)
    const front = Array.from({ length: SHEETS }, (_, i) => i).sort((a, b) => rest(b) - rest(a))
    for (const i of front) {
      if (inside(quadPts(theta[i], tilt, panX), x, y)) return i
    }
    return null
  }

  // RN 에는 없는 웹 전용 prop 이라 캐스팅해 넘긴다. 터치 기기에는 hover 가 없다.
  // 이벤트 대상이 안쪽 도형일 수 있어 offsetX 는 기준이 흔들린다. 컨테이너를 직접 잰다.
  type WebMouse = { clientX: number; clientY: number }
  const stageMouse = {
    onMouseMove: (e: { nativeEvent: WebMouse; currentTarget: Element }) => {
      if (mode !== 'open') return
      const r = e.currentTarget.getBoundingClientRect()
      const hit = pickAt(e.nativeEvent.clientX - r.left, e.nativeEvent.clientY - r.top, r.width, r.height)
      setHover((h) => (h === hit ? h : hit))
    },
    onMouseLeave: () => setHover(null),
  }

  return (
    <View style={styles.screen}>
      <View style={styles.head}>
        <Text style={styles.title} accessibilityRole="header">PAGE ROLL</Text>
        <Text style={styles.sub}>ROLL OPENS THE CLOSED BOOK SOMEWHERE.{'\n'}TAP A LEAF, THEN SELECT.</Text>
      </View>

      <View style={styles.metaRow}>
        <Text style={styles.metaLabel}>TOTAL PAGES</Text>
        <Text style={styles.metaValue}>{TOTAL}</Text>
      </View>

      <View style={styles.keys}>
        <PixelButton onPress={roll} disabled={busy} style={styles.grow2} boxStyle={styles.keyBox}>
          <Text style={styles.keyLabel}>ROLL</Text>
        </PixelButton>
        <PixelButton
          onPress={reset}
          disabled={busy}
          color={T.secondary}
          style={styles.grow1}
          boxStyle={styles.keyBox}
        >
          <Text style={[styles.keyLabel, { color: T.ink }]}>RESET</Text>
        </PixelButton>
      </View>

      <PixelButton
        onPress={toggleFlat}
        disabled={busy || !pick}
        boxStyle={styles.keyBox}
        accessibilityLabel={flat ? 'BACK TO THE FANNED BOOK' : 'SELECT THESE TWO PAGES'}
      >
        <Text style={styles.keyLabel}>{flat ? 'BACK' : 'SELECT'}</Text>
      </PixelButton>

      <View style={styles.stage} {...(stageMouse as object)}>
        <Svg width="100%" height="100%" viewBox="-300 -215 600 430">
          {parts.map((p) => p.node)}
        </Svg>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, width: '100%', backgroundColor: T.bg, paddingHorizontal: 16, paddingTop: 8 },
  head: { marginBottom: 16 },
  title: { fontFamily: T.fontPixel, fontSize: 13, color: T.ink },
  sub: { fontFamily: T.fontPixel, fontSize: 8, lineHeight: 15, color: T.muted, marginTop: 10 },

  metaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  metaLabel: { fontFamily: T.fontPixel, fontSize: 8, color: T.muted },
  metaValue: { fontFamily: T.fontPixel, fontSize: 10, color: T.ink },

  keys: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  grow1: { flex: 1 },
  grow2: { flex: 2 },
  keyBox: { height: 44, alignItems: 'center', justifyContent: 'center' },
  keyLabel: { fontFamily: T.fontPixel, fontSize: 9, color: T.primaryFg },

  stage: { flex: 1, marginTop: 8 },
})
