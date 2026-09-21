import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import Svg, { G, Line, Polygon, Text as SvgText } from 'react-native-svg'
import { PixelButton, T } from '@/components/pixel'
import { QUOTES } from '@/components/quotes'

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
//
// 처음엔 책장이다. ROLL 을 누르면 꽂힌 책 하나가 골라져 앞으로 뽑혀 나오고,
// 책등만 보이던 것이 돌아 눕는 표지가 되면서 덮인 책 자리에 놓인다. 그 뒤는
// 위의 3D 책이 이어받아 펼친다.
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

// ---------- 책장 ----------
// 책장은 3D 가 아니라 화면에 바로 그리는 픽셀 그림이다. 뽑히는 책만 여섯 면을
// 가진 상자로 따로 그린다. 책등을 축으로 돌려 표지가 앞을 보게 하고, 눕히고,
// 키워서 덮인 3D 책 자리에 정확히 포갠다.
// 책장은 무대(viewBox)를 위아래·좌우로 꽉 채운다. 무대는 화면 비율을 따라가므로
// 폰에서는 길쭉하게, 단 수도 그에 맞춰 늘어난다. 칸마다 책이 빈틈없이 꽂힌다.
const BOARD = 14           // 선반·기둥 두께
const CASE_IN = 2          // 테두리 선이 화면에 잘리지 않게 안으로 들이는 만큼
const ROW_TARGET = 135     // 선반 사이 빈 높이로 삼고 싶은 값. 단 수는 이걸로 정한다.
const BOOK_GAP = 4
const PULL_DROP = 16       // 뽑힐 때 앞으로(화면 아래로) 나오는 거리
const PULL_GROW = 0.18     // 뽑히며 가까워져 커지는 비율
const SHELF_LIFT = -10     // 마우스가 올라간 책이 위로 빠져나오는 만큼

type VBox = { x: number; y: number; w: number; h: number }
type Book = { row: number; x0: number; w: number; h: number; y: number; c: string }
type Shelf = { L: number; R: number; T: number; B: number; boards: number[]; books: Book[] }
const BOOK_COLORS = [T.bg, T.muted, T.secondary, T.bg, T.secondary, T.muted, T.bg]

// 꽂힌 책들. 높이와 색을 고정 씨앗으로 흩뿌려 단마다 왼쪽부터 채운다. 책등 너비는 3D 책의
// 두께 비율(BLOCK/H)로 맞춘다. 그래야 뽑힌 책이 상자로 바뀌어도 책등 폭이 그대로다.
// 마지막 남는 자투리는 그 단 책들 사이에 나눠 넣어 오른쪽 기둥까지 빈틈이 없게 한다.
function buildShelf(vb: VBox): Shelf {
  const L = vb.x + CASE_IN
  const R = vb.x + vb.w - CASE_IN
  const T0 = vb.y + CASE_IN
  const B = vb.y + vb.h - CASE_IN
  const rows = Math.max(1, Math.round((B - T0 - BOARD) / (ROW_TARGET + BOARD)))
  const rowIn = (B - T0 - BOARD * (rows + 1)) / rows
  const shelfY = (row: number) => T0 + BOARD + (row + 1) * rowIn + row * BOARD   // 그 단 선반 윗면
  const hMin = Math.round(rowIn * 0.7)
  const hMax = Math.round(rowIn - 6)

  const books: Book[] = []
  let seed = 7
  const rnd = () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296
  const x0 = L + BOARD + BOOK_GAP
  const x1 = R - BOARD - BOOK_GAP
  for (let row = 0; row < rows; row++) {
    const rowBooks: Book[] = []
    let x = x0
    let k = 0
    while (true) {
      const h = hMin + Math.round(rnd() * (hMax - hMin))
      const w = Math.round((BLOCK * h) / H)
      if (x + w > x1) break
      rowBooks.push({ row, x0: x, w, h, y: shelfY(row), c: BOOK_COLORS[(k + row * 3) % BOOK_COLORS.length] })
      x += w + BOOK_GAP
      k += 1
    }
    const spare = x1 - (x - BOOK_GAP)
    rowBooks.forEach((b, i) => { b.x0 += Math.round((spare * i) / Math.max(1, rowBooks.length - 1)) })
    books.push(...rowBooks)
  }
  // 선반: 맨 위 천장부터 맨 아래 바닥까지 rows+1 장
  const boards = Array.from({ length: rows + 1 }, (_, k) => (k === 0 ? T0 : shelfY(k - 1)))
  return { L, R, T: T0, B, boards, books }
}

// 뽑기 프레임. 깜빡이며 고르고 → 앞으로 빼고 → 표지로 돌아 눕는다.
const BLINK_F = 6
const SLIDE_F = 12
const PULL_F = 22

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

const clamp01 = (t: number) => Math.max(0, Math.min(1, t))
const lerpPt = (a: Pt, b: Pt, t: number): Pt => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t })

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

// SVG viewBox 의 기준 크기. 책은 이 안에 들어온다.
// 실제 viewBox 는 무대의 화면 비율을 따라 한쪽으로 늘린다. 그래야 letterbox 여백이 안 생기고
// 책장이 무대를 꽉 채울 수 있다. 책 크기는 meet 로 맞출 때와 똑같다.
const VB: VBox = { x: -300, y: -215, w: 600, h: 430 }
function stageVB(w: number, h: number): VBox {
  if (!w || !h) return VB
  const tall = w / h < VB.w / VB.h
  const vw = tall ? VB.w : (VB.h * w) / h
  const vh = tall ? (VB.w * h) / w : VB.h
  return { x: -vw / 2, y: -vh / 2, w: vw, h: vh }
}

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

// ---------- 뽑히는 책(상자) ----------
// 책 좌표계: x 책등(0)→배(W), y 위(-H/2)→아래(H/2), z 뒤표지(-BLOCK)→앞표지(0).
// phi 는 책등을 축으로 도는 각. 90 이면 책등이 앞을 보고(꽂힌 상태), 0 이면 표지가 앞을 본다.
// 그 뒤 project 가 tilt 만큼 눕히고 투시를 넣는다. s 와 off 는 화면에서 키우고 옮기는 값.
type BoxView = { phi: number; tilt: number; panX: number; s: number; off: Pt }

function boxPt(x: number, y: number, z: number, v: BoxView): Pt {
  const r = (v.phi * Math.PI) / 180
  const p = project(x * Math.cos(r) + z * Math.sin(r), y, -x * Math.sin(r) + z * Math.cos(r), v.tilt, v.panX)
  return { x: p.x * v.s + v.off.x, y: p.y * v.s + v.off.y }
}

// 여섯 면. 바깥쪽 법선으로 앞뒤를 가려 보이는 면만 그린다.
type Face = { n: [number, number, number]; pts: Array<[number, number, number]>; paper: boolean }
const BOX_FACES: Face[] = [
  { n: [0, 0, 1], paper: false, pts: [[0, -H / 2, 0], [W, -H / 2, 0], [W, H / 2, 0], [0, H / 2, 0]] },
  { n: [0, 0, -1], paper: false, pts: [[0, -H / 2, -BLOCK], [W, -H / 2, -BLOCK], [W, H / 2, -BLOCK], [0, H / 2, -BLOCK]] },
  { n: [-1, 0, 0], paper: false, pts: [[0, -H / 2, 0], [0, -H / 2, -BLOCK], [0, H / 2, -BLOCK], [0, H / 2, 0]] },
  { n: [1, 0, 0], paper: true, pts: [[W, -H / 2, 0], [W, -H / 2, -BLOCK], [W, H / 2, -BLOCK], [W, H / 2, 0]] },
  { n: [0, -1, 0], paper: true, pts: [[0, -H / 2, 0], [W, -H / 2, 0], [W, -H / 2, -BLOCK], [0, -H / 2, -BLOCK]] },
  { n: [0, 1, 0], paper: true, pts: [[0, H / 2, 0], [W, H / 2, 0], [W, H / 2, -BLOCK], [0, H / 2, -BLOCK]] },
]

// 법선을 같은 회전에 태워 z 가 앞(+)을 향하면 보이는 면이다. 투시는 무시한다.
function faceVisible(n: [number, number, number], v: BoxView): boolean {
  const r = (v.phi * Math.PI) / 180
  const t = (v.tilt * Math.PI) / 180
  const z1 = -n[0] * Math.sin(r) + n[2] * Math.cos(r)
  return n[1] * Math.sin(t) + z1 * Math.cos(t) > 0.001
}

// 책장에 꽂힌 채로 볼 때. 책등이 앞을 보고, 선반 위에 서고, 화면 크기로 줄인다.
// phi=90 이면 책등(x=0 면)이 화면 x 로 [-BLOCK, 0]·s 에 놓이므로 오른쪽 끝을 슬롯 끝에 맞춘다.
function shelvedView(b: Book): BoxView {
  const s = b.h / H
  return { phi: 90, tilt: 0, panX: 0, s, off: { x: b.x0 + b.w, y: b.y - (H / 2) * s } }
}

// 다 뽑혀 덮인 3D 책과 포개지는 자리.
const LANDED_VIEW: BoxView = { phi: 0, tilt: SHUT.tilt, panX: SHUT.panX, s: 1, off: { x: 0, y: 0 } }

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

// ---------- 펼친 쪽에 적히는 글 ----------
// SELECT 로 눕힌 두 쪽에만 읽히는 글이 찍힌다. 왼쪽은 명언 한 마디, 오른쪽은 보상 목록.
// 어느 글이 나올지는 펼친 쪽번호로 정해서, 같은 자리를 다시 펴면 같은 글이 나온다.

const REWARDS = [
  '10 MIN WALK',
  'ONE EPISODE',
  'ICED COFFEE',
  'A SQUARE OF CHOCOLATE',
  '15 MIN OF GAMES',
  'CALL A FRIEND',
  'FAVORITE SNACK',
  'A SHORT NAP',
  'NEW STICKER',
  'MUSIC BREAK',
  'STRETCH + WATER',
  'DOODLE TIME',
]
const REWARD_COUNT = 5

// 글이 놓이는 자리. u 는 바깥(왼쪽 화면 기준) 0.88 에서 책등 쪽 0.12 까지, 쪽 너비의 0.76.
const TEXT_U0 = 0.88
const TEXT_U1 = 0.12
const TEXT_W = (TEXT_U0 - TEXT_U1) * W    // 197.6
const TEXT_V0 = 0.12

// 픽셀 글꼴은 고정폭이라 글자 수로 줄을 나눈다.
const QUOTE_FONT = 14
const QUOTE_STEP = 0.07                   // 줄 간격(쪽 높이 비율) ≈ 24
const QUOTE_CHARS = Math.floor(TEXT_W / QUOTE_FONT)   // 14
const LIST_FONT = 10
const LIST_STEP = 0.055
const LIST_CHARS = Math.floor(TEXT_W / LIST_FONT)     // 19
const HEAD_FONT = 12
const BY_FONT = 9
const BY_CHARS = Math.floor(TEXT_W / BY_FONT)          // 21

// 쪽번호를 목록 자리로 바꾼다. 왼쪽 쪽은 늘 짝수라 그냥 나머지를 쓰면 절반은 영영 안 나온다.
// 반으로 접은 뒤 목록 길이와 서로소인 37 을 곱해 돌리면 160 자리가 100 개를 다 훑는다.
const mix = (n: number) => (n >> 1) * 37

// 글은 한 줄씩 차례로 찍힌다. 타자기처럼.
const REVEAL_MS = 90
const REVEAL_MAX = 16

function wrap(text: string, max: number): string[] {
  const out: string[] = []
  let line = ''
  for (const w of text.split(' ')) {
    if (line && (line + ' ' + w).length > max) { out.push(line); line = w }
    else line = line ? line + ' ' + w : w
  }
  if (line) out.push(line)
  return out
}

// 쪽번호를 씨앗으로 쓰는 간단한 난수. 결과가 뽑기마다 흔들리지 않게.
function pickRewards(seed: number): string[] {
  let x = seed * 2654435761 % 4294967296 || 1
  const pool = REWARDS.slice()
  const out: string[] = []
  while (out.length < REWARD_COUNT && pool.length) {
    x = (x * 1664525 + 1013904223) % 4294967296
    out.push(pool.splice(x % pool.length, 1)[0])
  }
  return out
}

type TextLine = { text: string; size: number; color: string; align: 'start' | 'end'; glow?: boolean }

// 왼쪽 쪽: 명언이 쪽을 다 차지하도록 크게, 맨 밑에 누가 한 말인지 작게.
function quoteLines(seed: number): TextLine[] {
  const [q, who] = QUOTES[mix(seed) % QUOTES.length]
  const body: TextLine[] = wrap(q, QUOTE_CHARS).map((t) => ({ text: t, size: QUOTE_FONT, color: T.ink, align: 'start', glow: true }))
  // 말한 이가 길면 접는다. 줄 간격은 명언과 같아 자리는 그대로 이어진다.
  const by: TextLine[] = wrap('- ' + who, BY_CHARS).map((t) => ({ text: t, size: BY_FONT, color: T.primary, align: 'end' }))
  return body.concat({ text: '', size: QUOTE_FONT, color: T.ink, align: 'start' }, by)
}

// 오른쪽 쪽: 보상 목록.
function rewardLines(seed: number): TextLine[] {
  const head: TextLine[] = [
    { text: '* REWARDS *', size: HEAD_FONT, color: T.primary, align: 'start', glow: true },
    { text: '', size: LIST_FONT, color: T.ink, align: 'start' },
  ]
  return head.concat(
    pickRewards(seed).flatMap((r, i) =>
      // 첫 줄엔 체크칸, 이어지는 줄은 그만큼 들여 쓴다.
      wrap(r, LIST_CHARS - 4).map((t, k) => ({
        text: (k === 0 ? '[ ] ' : '    ') + t, size: LIST_FONT, color: T.ink, align: 'start' as const,
      })),
    ),
  )
}

// onFocusChange: ROLL 로 책에 집중하는 동안 true. 바깥(탭 바)도 같이 치우라고 알린다.
export default function PageRoll({ onFocusChange }: { onFocusChange?: (focused: boolean) => void } = {}) {
  const [scene, setScene] = useState<Scene>(SHUT)
  // idle: 제목과 ROLL 이 보이는 첫 화면. 책장은 보이지만 만질 수 없다.
  // shelf: ROLL 을 눌러 책장만 남은 상태. 여기서만 책을 고를 수 있다.
  // pull: 뽑히는(또는 되꽂히는) 중. 나머지는 3D 책.
  const [mode, setMode] = useState<'idle' | 'shelf' | 'pull' | 'shut' | 'open' | 'flat'>('idle')
  const [busy, setBusy] = useState(false)
  const [stageSize, setStageSize] = useState({ w: 0, h: 0 })
  const vb = useMemo(() => stageVB(stageSize.w, stageSize.h), [stageSize.w, stageSize.h])
  const shelf = useMemo(() => buildShelf(vb), [vb])
  const [slot, setSlot] = useState(0)
  const [pf, setPf] = useState(0)       // 뽑기 프레임 0..PULL_F
  const [shelfHover, setShelfHover] = useState<number | null>(null)
  const [page, setPage] = useState(160)
  const [pages, setPages] = useState<number[]>(() => pagesFor(160, TOTAL))
  const [pick, setPick] = useState<{ lo: number; hi: number; a: number; b: number } | null>(null)
  const [hover, setHover] = useState<number | null>(null)

  const sceneRef = useRef(scene)
  sceneRef.current = scene
  const timer = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => () => { if (timer.current) clearInterval(timer.current) }, [])

  // 책이 다 눕고 나면 글이 한 줄씩 나타난다. 다시 들리면 바로 지운다.
  const [reveal, setReveal] = useState(0)
  const settled = mode === 'flat' && !busy
  useEffect(() => {
    setReveal(0)
    if (!settled) return
    const id = setInterval(() => {
      setReveal((n) => {
        if (n + 1 >= REVEAL_MAX) clearInterval(id)
        return n + 1
      })
    }, REVEAL_MS)
    return () => clearInterval(id)
  }, [settled])

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

  // 책장에서 빼거나(dir=1) 다시 꽂는다(dir=-1). 되꽂을 땐 고르는 깜빡임은 건너뛴다.
  const runPull = useCallback((dir: 1 | -1, done?: () => void) => {
    if (timer.current) clearInterval(timer.current)
    const end = dir > 0 ? PULL_F : BLINK_F
    let f = dir > 0 ? 0 : PULL_F
    setBusy(true)
    setMode('pull')
    setPf(f)
    timer.current = setInterval(() => {
      f += dir
      setPf(f)
      if (f === end) {
        if (timer.current) clearInterval(timer.current)
        timer.current = null
        setBusy(false)
        done?.()
      }
    }, STEP_MS)
  }, [])

  // 책장에서 i 번 책을 뽑아 아무 데나 펼친다. ROLL 로 책장을 연 뒤에만 된다.
  const pullFrom = useCallback((i: number) => {
    if (busy || mode !== 'shelf') return
    setPick(null)
    setHover(null)
    setShelfHover(null)
    setSlot(i)
    sceneRef.current = SHUT
    setScene(SHUT)
    const p = Math.floor(Math.random() * TOTAL) + 1
    runPull(1, () => {
      setPage(p)
      setPages(pagesFor(p, TOTAL))
      setMode('open')
      animate(OPEN)
    })
  }, [busy, mode, animate, runPull])

  // ROLL = 책장만 남기고 책을 고르게 한다.
  const roll = useCallback(() => {
    if (busy || mode !== 'idle') return
    setMode('shelf')
  }, [busy, mode])

  // 책을 덮고 책장에 도로 꽂은 뒤 첫 화면으로. 책장만 보던 중이면 바로 첫 화면.
  const reset = useCallback(() => {
    if (busy || mode === 'idle') return
    setPick(null)
    setHover(null)
    setShelfHover(null)
    setPage(1)
    setPages(pagesFor(1, TOTAL))
    if (mode === 'shelf') { setMode('idle'); return }
    const shelve = () => runPull(-1, () => setMode('idle'))
    if (mode === 'shut' || mode === 'pull') shelve()
    else {
      setMode('shut')
      animate(SHUT, shelve)
    }
  }, [busy, mode, animate, runPull])

  // 부채꼴에서 바로 옆에 붙어 있는 장까지 함께 잡는다.
  const tapSheet = useCallback((i: number) => {
    if (busy || mode !== 'open') return
    const j = i < SHEETS - 1 ? i + 1 : i - 1
    const [a, b] = spreadOf(pages[i], TOTAL)
    setPick({ lo: Math.min(i, j), hi: Math.max(i, j), a, b })
  }, [busy, mode, pages])

  // SELECT: 책이 땅에 붙게 눕고, 고른 두 쪽만 위로 올라온다. 다 읽고 BACK 을 누르면 책장으로.
  const toggleFlat = useCallback(() => {
    if (busy || !pick) return
    if (mode === 'flat') reset()
    else {
      setHover(null)
      setMode('flat')
      animate(flatScene(pick.lo, pick.hi))
    }
  }, [busy, pick, mode, animate, reset])

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

  // 눕힌 쪽에 글을 찍는다. 책이 완전히 펴진 뒤에만 부른다.
  const pageText = (th: number, lines: TextLine[], step: number) => {
    const left = th < 90
    return lines.map((l, r) => {
      if (!l.text || r >= reveal) return null
      const v = TEXT_V0 + r * step
      // 왼쪽 쪽은 바깥이 화면 왼쪽이라 u 를 뒤집어 잰다.
      const u = l.align === 'start' ? (left ? TEXT_U0 : TEXT_U1) : (left ? TEXT_U1 : TEXT_U0)
      const at = leafPt(th, u, v, tilt, panX)
      const y = at.y + l.size / 2
      // 방금 찍힌 줄은 커서가 붙는다.
      const last = r === reveal - 1 && reveal < lines.length
      const text = last ? l.text + '_' : l.text
      return (
        <G key={r}>
          {l.glow && (
            // 줄과 같은 발광. 글 뒤에 주황 빛이 번진다.
            <SvgText x={at.x} y={y} fontFamily={T.fontPixel} fontSize={l.size}
              fill={T.primary} stroke={T.primary} strokeWidth={6} opacity={0.18} textAnchor={l.align}>
              {l.text}
            </SvgText>
          )}
          <SvgText x={at.x} y={y} fontFamily={T.fontPixel} fontSize={l.size}
            fill={l.color} textAnchor={l.align}>
            {text}
          </SvgText>
        </G>
      )
    })
  }

  const leaf = (i: number) => {
    const th = drawTheta(i)
    const isPick = !!pick && (i === pick.lo || i === pick.hi)
    // 글은 다 눕고 나서야 보인다. 움직이는 동안은 골라 둔 장 표시(잉크 줄)를 유지한다.
    const showText = isPick && flat && !busy
    const marked = isPick && !showText
    return (
      <G key={'leaf-' + i} onPress={() => tapSheet(i)}>
        {/* 골라 둔 장은 쪽 전체를 주황으로 칠해 한눈에 띄게 한다. 테두리는 잉크 그대로. */}
        <Polygon points={quad(th, tilt, panX)}
          fill={marked ? T.primary : T.bg} stroke={T.ink} strokeWidth={4} />
        {showText
          ? i === pick!.lo
            ? pageText(th, quoteLines(pick!.a), QUOTE_STEP)
            : pageText(th, rewardLines(pick!.b), LIST_STEP)
          : Array.from({ length: RULES }, (_, r) => {
          const v = 0.1 + r * 0.045
          // u 는 책등에서 바깥으로 재는 값이다. 왼쪽 쪽은 글이 바깥에서
          // 시작하므로 거기 붙여야 들쭉날쭉한 끝이 책등 쪽으로 온다.
          const len = 0.76 * ruleWidth(i, r)
          const left = th < 90
          const a = leafPt(th, left ? 0.88 - len : 0.12, v, tilt, panX)
          const b = leafPt(th, left ? 0.88 : 0.12 + len, v, tilt, panX)
          if (marked) {
            // 골라 둔 장은 발광 없이 또렷한 줄. 바탕이 주황이라 밝은 종이색으로 긋는다.
            return (
              <Line key={r} x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                stroke={T.primaryFg} strokeWidth={4} />
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

  // ---------- 책장 ----------
  // f 는 뽑기 프레임. 책장에 그냥 꽂혀 있을 땐 -1.
  const shelfNode = (f: number) => {
    const lit = f >= BLINK_F || (f >= 0 && f % 2 === 1)
    const slide = clamp01((f - BLINK_F) / (SLIDE_F - BLINK_F))
    const morph = clamp01((f - SLIDE_F) / (PULL_F - SLIDE_F))

    // 골라진 책. 앞으로 나올수록 조금 커지고 아래로 내려온다. 그 뒤 돌아서 눕는다.
    // 돌기(phi)는 먼저 끝내고 눕기(tilt)는 늦게 시작해 두 움직임이 읽히게 한다.
    // 화면이 돌아가 책장이 다시 짜이면 slot 이 넘칠 수 있다. 첫 책으로 받는다.
    const b = shelf.books[slot] ?? shelf.books[0]
    const at = shelvedView(b)
    const g = 1 + PULL_GROW * slide
    const bottom = b.y + PULL_DROP * slide + (f < 0 && shelfHover === slot ? SHELF_LIFT : 0)
    const pulled: BoxView = { ...at, s: at.s * g, off: { x: at.off.x + (b.w * (g - 1)) / 2, y: bottom - (H / 2) * at.s * g } }
    const turn = clamp01(morph / 0.75)
    const lay = clamp01((morph - 0.25) / 0.75)
    const view: BoxView = {
      phi: lerp(pulled.phi, LANDED_VIEW.phi, turn),
      tilt: lerp(pulled.tilt, LANDED_VIEW.tilt, lay),
      panX: lerp(pulled.panX, LANDED_VIEW.panX, lay),
      s: lerp(pulled.s, LANDED_VIEW.s, lay),
      off: lerpPt(pulled.off, LANDED_VIEW.off, lay),
    }
    const boxFill = lit ? T.primary : b.c

    return (
      <G>
        {/* 책장. 책이 돌아누우면서 같이 사라진다. */}
        <G opacity={1 - morph}>
          <Polygon points={fmt([
            { x: shelf.L, y: shelf.T }, { x: shelf.R, y: shelf.T }, { x: shelf.R, y: shelf.B }, { x: shelf.L, y: shelf.B },
          ])} fill={T.ink} opacity={0.14} />
          {shelf.books.map((bk, i) => {
            if (i === slot) return null
            const bx = bk.x0
            // 마우스가 올라간 책은 살짝 빠져나와 있다. 누르면 그 책이 뽑힌다.
            const by = bk.y + (f < 0 && shelfHover === i ? SHELF_LIFT : 0)
            return (
              <G key={'bk' + i} onPress={() => pullFrom(i)}>
                <Polygon points={fmt([
                  { x: bx, y: by - bk.h }, { x: bx + bk.w, y: by - bk.h },
                  { x: bx + bk.w, y: by }, { x: bx, y: by },
                ])} fill={bk.c} stroke={T.ink} strokeWidth={4} />
                {/* 책등의 띠 두 줄 */}
                {[0.18, 0.3].map((v) => (
                  <Line key={v} x1={bx + 6} y1={by - bk.h * (1 - v)} x2={bx + bk.w - 6} y2={by - bk.h * (1 - v)}
                    stroke={T.ink} strokeWidth={3} opacity={0.5} />
                ))}
              </G>
            )
          })}
          {shelf.boards.map((y) => (
            <Polygon key={'board' + y} points={fmt([
              { x: shelf.L, y }, { x: shelf.R, y }, { x: shelf.R, y: y + BOARD }, { x: shelf.L, y: y + BOARD },
            ])} fill={T.muted} stroke={T.ink} strokeWidth={4} />
          ))}
          {[shelf.L, shelf.R - BOARD].map((x) => (
            <Polygon key={'post' + x} points={fmt([
              { x, y: shelf.T }, { x: x + BOARD, y: shelf.T }, { x: x + BOARD, y: shelf.B }, { x, y: shelf.B },
            ])} fill={T.muted} stroke={T.ink} strokeWidth={4} />
          ))}
        </G>

        {/* 골라진 책. 깜빡이며 고른 뒤 앞으로 뽑혀 나와, 책등을 축으로 돌고 눕는다. */}
        <G onPress={() => pullFrom(slot)}>
          {BOX_FACES.filter((fc) => faceVisible(fc.n, view)).map((fc, i) => (
            <Polygon key={'face' + i} points={fmt(fc.pts.map(([x, y, z]) => boxPt(x, y, z, view)))}
              fill={fc.paper ? T.bg : boxFill} stroke={T.ink} strokeWidth={4} />
          ))}
          {/* 책등의 띠. 책등 면(x=0) 위 z 방향으로 긋는다. 돌아누우면서 함께 접힌다. */}
          {faceVisible([-1, 0, 0], view) && [0.18, 0.3].map((v) => {
            const y = -H / 2 + H * v
            const a = boxPt(0, y, -BLOCK * 0.18, view)
            const c = boxPt(0, y, -BLOCK * 0.82, view)
            return <Line key={v} x1={a.x} y1={a.y} x2={c.x} y2={c.y} stroke={T.ink} strokeWidth={3} opacity={0.5} />
          })}
        </G>
      </G>
    )
  }

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
  // 화면 좌표 → viewBox 좌표. viewBox 가 무대 비율을 따르니 여백은 거의 없지만, 측정 전 한 프레임을
  // 위해 meet 규칙(남는 쪽에 여백 반씩)대로 계산해 둔다.
  const toVB = (px: number, py: number, w: number, h: number): Pt => {
    const s = Math.min(w / vb.w, h / vb.h)
    return { x: (px - (w - vb.w * s) / 2) / s + vb.x, y: (py - (h - vb.h * s) / 2) / s + vb.y }
  }

  const pickAt = (px: number, py: number, w: number, h: number): number | null => {
    if (!w || !h) return null
    const { x, y } = toVB(px, py, w, h)
    // 판정은 들리기 전 각도로 한다. 들린 각도로 재면 낱장이 커서 밑에서
    // 빠져나가며 hover 가 껐다 켜졌다 한다.
    const rest = (i: number) => depthOf(theta[i]) + BIAS_LEAF(i)
    const front = Array.from({ length: SHEETS }, (_, i) => i).sort((a, b) => rest(b) - rest(a))
    for (const i of front) {
      if (inside(quadPts(theta[i], tilt, panX), x, y)) return i
    }
    return null
  }

  // 책장에서 마우스가 올라간 책. 선반 위에 선 사각형으로 판정한다.
  const shelfAt = (px: number, py: number, w: number, h: number): number | null => {
    if (!w || !h) return null
    const { x, y } = toVB(px, py, w, h)
    const i = shelf.books.findIndex((b) => x >= b.x0 && x <= b.x0 + b.w && y >= b.y - b.h && y <= b.y)
    return i < 0 ? null : i
  }

  // RN 에는 없는 웹 전용 prop 이라 캐스팅해 넘긴다. 터치 기기에는 hover 가 없다.
  // 이벤트 대상이 안쪽 도형일 수 있어 offsetX 는 기준이 흔들린다. 컨테이너를 직접 잰다.
  type WebMouse = { clientX: number; clientY: number }
  const stageMouse = {
    onMouseMove: (e: { nativeEvent: WebMouse; currentTarget: Element }) => {
      if (mode !== 'open' && mode !== 'shelf') return   // idle 의 책장은 만질 수 없다
      const r = e.currentTarget.getBoundingClientRect()
      const px = e.nativeEvent.clientX - r.left
      const py = e.nativeEvent.clientY - r.top
      if (mode === 'shelf') {
        const hit = shelfAt(px, py, r.width, r.height)
        setShelfHover((h) => (h === hit ? h : hit))
        return
      }
      const hit = pickAt(px, py, r.width, r.height)
      setHover((h) => (h === hit ? h : hit))
    },
    onMouseLeave: () => { setHover(null); setShelfHover(null) },
  }

  // ROLL 뒤에는 책장(그리고 책)만 남긴다. 제목·쪽수·ROLL 은 치운다.
  const focused = mode !== 'idle'
  useEffect(() => { onFocusChange?.(focused) }, [focused, onFocusChange])

  return (
    <View style={styles.screen}>
      {focused ? (
        // 책장이 화면을 다 쓰도록 CLOSE 는 무대 위에 띄운다.
        <View style={styles.focusBar} pointerEvents="box-none">
          <Text style={styles.closeText} onPress={reset} accessibilityRole="button"
            accessibilityLabel="CLOSE THE BOOK">
            {busy ? '' : '< CLOSE'}
          </Text>
        </View>
      ) : (
        <>
          <View style={styles.head}>
            <Text style={styles.title} accessibilityRole="header">PAGE ROLL</Text>
            <Text style={styles.sub}>ROLL, THEN PICK A BOOK OFF THE SHELF.{'\n'}IT OPENS SOMEWHERE. TAP A LEAF, THEN SELECT.</Text>
          </View>

          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>TOTAL PAGES</Text>
            <Text style={styles.metaValue}>{TOTAL}</Text>
          </View>

          <View style={styles.keys}>
            <PixelButton onPress={roll} disabled={busy} style={styles.grow2} boxStyle={styles.keyBox}>
              <Text style={styles.keyLabel}>ROLL</Text>
            </PixelButton>
          </View>
        </>
      )}

      {/* ROLL 뒤에는 화면 여백까지 밀어내고 무대가 가장자리에 붙는다. */}
      <View style={[styles.stage, focused && styles.stageFull]} {...(stageMouse as object)}
        onLayout={(e) => {
          const { width, height } = e.nativeEvent.layout
          setStageSize((s) => (s.w === width && s.h === height ? s : { w: width, h: height }))
        }}>
        <Svg width="100%" height="100%" viewBox={vb.x + ' ' + vb.y + ' ' + vb.w + ' ' + vb.h}>
          {mode === 'idle' || mode === 'shelf' ? shelfNode(-1) : mode === 'pull' ? shelfNode(pf) : parts.map((p) => p.node)}
        </Svg>
      </View>

      {/* SELECT/BACK 은 책이 펴진 뒤에만. 그전엔 자리만 비워 둬 책장이 튀지 않게 한다. */}
      {mode === 'open' || mode === 'flat' ? (
        <PixelButton
          onPress={toggleFlat}
          disabled={busy || !pick}
          boxStyle={styles.keyBox}
          accessibilityLabel={flat ? 'BACK TO THE SHELF' : 'SELECT THESE TWO PAGES'}
        >
          <Text style={styles.keyLabel}>{flat ? 'BACK' : 'SELECT'}</Text>
        </PixelButton>
      ) : focused ? null : (
        <View style={styles.keySpacer} />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, width: '100%', backgroundColor: T.bg, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12 },
  head: { marginBottom: 16 },
  title: { fontFamily: T.fontPixel, fontSize: 13, color: T.ink },
  sub: { fontFamily: T.fontPixel, fontSize: 8, lineHeight: 15, color: T.muted, marginTop: 10 },

  metaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  metaLabel: { fontFamily: T.fontPixel, fontSize: 8, color: T.muted },
  metaValue: { fontFamily: T.fontPixel, fontSize: 10, color: T.ink },

  keys: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  focusBar: { position: 'absolute', top: 8, left: 16, zIndex: 1 },
  closeText: { fontFamily: T.fontPixel, fontSize: 8, color: T.ink, backgroundColor: T.bg, paddingVertical: 6, paddingHorizontal: 8, alignSelf: 'flex-start' },
  grow2: { flex: 2 },
  keyBox: { height: 44, alignItems: 'center', justifyContent: 'center' },
  keySpacer: { height: 48 },
  keyLabel: { fontFamily: T.fontPixel, fontSize: 9, color: T.primaryFg },

  stage: { flex: 1, marginTop: 8, marginBottom: 12 },
  stageFull: { marginTop: -8, marginBottom: -12, marginHorizontal: -16 },
})
