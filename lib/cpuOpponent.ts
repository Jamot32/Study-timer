// ============================================================
// CPU 상대
// 사람 상대가 안 잡히면 이 파일이 한 명을 지어낸다.
// 외형(프로필) · 공부 습관 · 유저에 대한 반응, 셋 다 여기서 굴린다.
// react-native 를 끌어오지 않는 순수 로직이라 노드에서도 돌릴 수 있다.
// ============================================================

/** 주입 가능한 난수. 테스트에서 고정된 값을 넣을 수 있게 열어 둔다. */
export type Rng = () => number;

const MIN = 60;

const pick = <T,>(list: readonly T[], rng: Rng): T => list[Math.floor(rng() * list.length)];

/** [min, max] 사이 정수 하나. 양 끝 포함. */
const between = (min: number, max: number, rng: Rng) => Math.floor(min + rng() * (max - min + 1));

// ---------- 1. 외형 & 프로필 ----------

// 닉네임 조합 1: [목표] + [동물/단어]
const GOALS = ['SNU27', 'PreMed', 'BarExam', 'TOEFL110', 'MITorBust', 'Retaker', 'TopOfClass', 'GradSchool'];
const CREATURES = ['Lion', 'Dino', 'Cat', 'Owl', 'Raccoon', 'Fox', 'Mole', 'Penguin'];

// 닉네임 조합 2: [상태] + [이름]
const STATES = ['Sleepy', 'Grinding', 'Caffeinated', 'FiveAM', 'TearStained', 'FacePlanted', 'LockedIn', 'Rebooting'];
const NAMES = ['Dave', 'Nora', 'Hannah', 'Leo', 'Mina', 'Otis', 'Priya', 'Sam'];

const TITLES = [
  '새벽 4시의 파수꾼',
  '벼락치기 마스터',
  '독서실 터줏대감',
  '형광펜 사냥꾼',
  '도서관 유령',
  '기출문제 수집가',
  '카페인 연금술사',
  '오답노트 장인',
];

/** 티어 순으로 늘어놓은 아바타. 낮은 티어가 앞. */
const AVATAR_TIERS = ['🐸', '🐧', '🐱', '🦊', '🦉', '👾', '🌙', '⭐'];

/** 트로피를 아바타 티어 눈금으로 옮긴다. */
const tierOf = (trophies: number) =>
  Math.max(0, Math.min(AVATAR_TIERS.length - 1, Math.floor(trophies / 400)));

const makeNickname = (rng: Rng) =>
  rng() < 0.5
    ? `${pick(GOALS, rng)}${pick(CREATURES, rng)}`
    : `${pick(STATES, rng)}${pick(NAMES, rng)}`;

/** 유저 점수 ±5~10% 안에서. 너무 딱 맞으면 오히려 티가 난다. */
const nearbyTrophies = (userTrophies: number, rng: Rng) => {
  const spread = 0.05 + rng() * 0.05;
  const delta = Math.round(userTrophies * spread) * (rng() < 0.5 ? -1 : 1);
  return Math.max(0, userTrophies + delta);
};

// ---------- 2. 공부 행동 ----------

export type Competitiveness = 'aggressive' | 'casual';

export type CpuOpponent = {
  /** 보여지는 프로필 */
  name: string;
  title: string;
  avatar: string;
  trophies: number;

  /** 이 판에서 채우려는 공부 시간(초). aggressive 면 도중에 늘어난다. */
  targetSeconds: number;
  /** 쉬지 않고 버티는 한계(초). 넘기면 쉴 확률이 확 뛴다. */
  focusStreakLimitSeconds: number;
  /** 평소 분당 일시정지 확률 (0~1). 화장실, 물 한 잔. */
  pausePerMinute: number;
  /** 한계를 넘긴 뒤의 분당 일시정지 확률 (0~1). */
  pausePerMinuteTired: number;
  /** 한 번 쉴 때의 길이 범위(초). */
  restRangeSeconds: readonly [number, number];
  /** START! 이후 실제로 타이머를 누르기까지의 지연(초). 0초 출발은 봇 티가 난다. */
  startDelaySeconds: number;

  /** 승부욕. aggressive 는 쫓기면 목표를 늘리고, casual 은 목표만 채우면 끝낸다. */
  competitiveness: Competitiveness;
  /** 유저에게 이만큼(초) 뒤처지면 기권을 저울질하기 시작한다. */
  giveUpGapSeconds: number;
  /** 그 상태에서의 분당 기권 확률 (0~1). */
  giveUpChancePerMinute: number;
  /** "집중하고 계신가요?" 팝업에 답하는 데 걸리는 시간(초). */
  skillCheckResponseSeconds: number;
  /** 이 상대가 뛰는 판의 길이(초). 목표는 절대 이 시간을 넘지 않는다. */
  matchSeconds: number;
};

/** aggressive 가 한 번에 늘리는 양. 무한정 늘리지는 않는다. */
const EXTENSION_RANGE = [15 * MIN, 30 * MIN] as const;
const MAX_EXTENSIONS = 3;
/** 유저가 이 안쪽까지 따라붙으면 "쫓기고 있다"고 본다. */
const CLOSE_CHASE_SECONDS = 10 * MIN;

export function createCpuOpponent({
  userTrophies,
  matchSeconds = 5 * 3600,
  rng = Math.random,
}: {
  userTrophies: number;
  /** 이 리그의 판 길이(초). 목표·기권 기준이 여기에 맞춰 줄고 늘어난다. */
  matchSeconds?: number;
  rng?: Rng;
}): CpuOpponent {
  const trophies = nearbyTrophies(userTrophies, rng);
  // 아바타는 유저 티어에서 한 칸 위아래까지만. 비슷한 상대로 보여야 한다.
  const tier = tierOf(userTrophies) + between(-1, 1, rng);
  const avatar = AVATAR_TIERS[Math.max(0, Math.min(AVATAR_TIERS.length - 1, tier))];

  return {
    name: makeNickname(rng),
    title: pick(TITLES, rng),
    avatar,
    trophies,

    // 판 길이의 45~100%. 1시간 판이면 27~60분, 5시간 판이면 2시간 15분~5시간.
    targetSeconds: between(Math.round(matchSeconds * 0.45), matchSeconds, rng),
    focusStreakLimitSeconds: between(25, 50, rng) * MIN,
    pausePerMinute: 0.01 + rng() * 0.02,
    pausePerMinuteTired: 0.3 + rng() * 0.2,
    restRangeSeconds: [3 * MIN, 8 * MIN],
    startDelaySeconds: 1 + rng() * 3,

    competitiveness: rng() < 0.5 ? 'aggressive' : 'casual',
    // 짧은 판에서 40분 격차를 기다리면 영영 안 접는다. 판 길이의 40%를 상한으로.
    giveUpGapSeconds: Math.min(between(35, 50, rng) * MIN, Math.round(matchSeconds * 0.4)),
    giveUpChancePerMinute: 0.08 + rng() * 0.12,
    skillCheckResponseSeconds: 2.5 + rng() * 4.7,
    matchSeconds,
  };
}

// ---------- 3. 매초 굴러가는 상태 ----------

export type CpuPhase =
  /** START! 를 보고도 아직 안 누른 상태. */
  | 'waiting'
  | 'studying'
  /** 일시정지하고 쉬는 중. */
  | 'resting'
  /** 목표를 채우고 스스로 끝냈다. */
  | 'done'
  /** 너무 벌어져서 기권했다. */
  | 'resigned';

export type CpuState = {
  phase: CpuPhase;
  /** 실제로 쌓은 공부 시간(초). 쉬는 동안은 늘지 않는다. */
  studiedSeconds: number;
  /** 지금 이어서 집중한 시간(초). 쉬면 0으로 돌아간다. */
  streakSeconds: number;
  /** waiting/resting 이 끝나기까지 남은 초. */
  phaseLeftSeconds: number;
  /** 연장까지 반영한 현재 목표(초). */
  targetSeconds: number;
  /** 목표를 늘린 횟수. */
  extensions: number;
};

export function initialCpuState(cpu: CpuOpponent): CpuState {
  return {
    phase: 'waiting',
    studiedSeconds: 0,
    streakSeconds: 0,
    phaseLeftSeconds: cpu.startDelaySeconds,
    targetSeconds: cpu.targetSeconds,
    extensions: 0,
  };
}

/** 분당 확률을 1초짜리로 환산. */
const perSecond = (perMinute: number) => 1 - Math.pow(1 - perMinute, 1 / 60);

/**
 * CPU 를 1초 진행시킨다. 순수 함수 — 같은 입력과 같은 rng 면 같은 결과.
 *
 * @param userSeconds 유저가 지금까지 쌓은 공부 시간(초). 반응형 파라미터에 쓰인다.
 */
export function tickCpu(
  state: CpuState,
  cpu: CpuOpponent,
  { userSeconds, rng = Math.random }: { userSeconds: number; rng?: Rng }
): CpuState {
  if (state.phase === 'done' || state.phase === 'resigned') return state;

  // 아직 시작 전이거나 쉬는 중. 시계만 흘려보낸다.
  if (state.phase === 'waiting' || state.phase === 'resting') {
    const left = state.phaseLeftSeconds - 1;
    if (left > 0) return { ...state, phaseLeftSeconds: left };
    return { ...state, phase: 'studying', phaseLeftSeconds: 0, streakSeconds: 0 };
  }

  const studiedSeconds = state.studiedSeconds + 1;
  const streakSeconds = state.streakSeconds + 1;
  const next: CpuState = { ...state, studiedSeconds, streakSeconds };

  // 목표를 채웠다. 성향에 따라 여기서 끝내거나 더 간다.
  if (studiedSeconds >= next.targetSeconds) {
    const chased = userSeconds > studiedSeconds - CLOSE_CHASE_SECONDS;
    if (
      cpu.competitiveness === 'aggressive' &&
      chased &&
      next.extensions < MAX_EXTENSIONS &&
      next.targetSeconds < cpu.matchSeconds
    ) {
      return {
        ...next,
        // 판 길이를 넘겨서까지 늘리지는 않는다. 그 끝은 무승부다.
        targetSeconds: Math.min(
          next.targetSeconds + between(EXTENSION_RANGE[0], EXTENSION_RANGE[1], rng),
          cpu.matchSeconds
        ),
        extensions: next.extensions + 1,
      };
    }
    // casual 은 유저가 쫓아오든 말든 미련이 없다.
    return { ...next, phase: 'done' };
  }

  // 너무 벌어지면 판을 접는다.
  if (userSeconds - studiedSeconds >= cpu.giveUpGapSeconds) {
    if (rng() < perSecond(cpu.giveUpChancePerMinute)) return { ...next, phase: 'resigned' };
  }

  // 한계를 넘긴 뒤로는 쉴 확률이 크게 오른다.
  const tired = streakSeconds >= cpu.focusStreakLimitSeconds;
  const pause = perSecond(tired ? cpu.pausePerMinuteTired : cpu.pausePerMinute);
  if (rng() < pause) {
    const [min, max] = cpu.restRangeSeconds;
    return { ...next, phase: 'resting', phaseLeftSeconds: between(min, max, rng) };
  }

  return next;
}

/** 화면에 띄울 한 줄. 상대가 지금 뭘 하고 있는지. */
export function cpuStatusLabel(state: CpuState): string {
  switch (state.phase) {
    case 'waiting':
      return 'getting ready';
    case 'resting':
      return 'on a break';
    case 'done':
      return 'finished';
    case 'resigned':
      return 'gave up';
    default:
      return 'studying';
  }
}
