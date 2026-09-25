import React from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';

// ============================================================
// NOVA — SECRET GARDEN
// shadcn "nova" 를 React Native 로 옮긴 디자인 시스템.
// 색은 앰버(햇빛)와 올리브 그린(잎), 바탕은 따뜻한 종이.
// 픽셀 시절의 4px 잉크 테두리 + 하드 오프셋 그림자는 버리고,
// 부드러운 라운드 · 얕은 그림자 · 한 겹의 옅은 선으로 깊이를 낸다.
// ============================================================

export const T = {
  // 바탕
  bg: '#FAF8F2',
  bgSunk: '#F1EEE3',
  card: '#FFFFFF',
  cardAlt: '#F6F4EA',

  // 글자
  ink: '#22261C',
  inkSoft: '#474D3C',
  muted: '#7E8471',

  // 선
  border: '#E5E1D3',
  borderStrong: '#D2CDBA',

  // 앰버 — 주 강조. 햇빛, 진행, 선택.
  primary: '#B5822B',
  primaryDeep: '#8F6520',
  primarySoft: '#F7E9CB',
  primaryFg: '#FFFCF4',

  // 올리브 그린 — 보조 강조. 잎, 성공, 휴식.
  accent: '#5F7448',
  accentDeep: '#465834',
  accentSoft: '#E5EBD9',
  accentFg: '#FAFCF6',

  // 상태
  danger: '#A2492F',
  dangerSoft: '#F6E2DA',

  // 글꼴
  font: 'DMSans_400Regular',
  fontMedium: 'DMSans_500Medium',
  fontBold: 'DMSans_700Bold',
  /** 숫자·제목에 쓰는 세리프. 정원 문패 같은 인상. */
  fontDisplay: 'Fraunces_600SemiBold',
} as const;

export const RADIUS = { sm: 8, md: 12, lg: 16, xl: 22, full: 999 } as const;

export const SPACE = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 } as const;

/** 얕게 뜬 그림자. level 0 은 그림자 없음. */
export function elevation(level: 0 | 1 | 2 | 3 = 1): ViewStyle {
  if (level === 0) return {};
  const map = {
    1: { radius: 8, y: 2, opacity: 0.06, elev: 1 },
    2: { radius: 16, y: 6, opacity: 0.09, elev: 3 },
    3: { radius: 28, y: 12, opacity: 0.12, elev: 6 },
  }[level];
  return {
    shadowColor: '#3B3320',
    shadowOpacity: map.opacity,
    shadowRadius: map.radius,
    shadowOffset: { width: 0, height: map.y },
    elevation: map.elev,
  };
}

export const ABS_FILL = {
  position: 'absolute',
  left: 0,
  right: 0,
  top: 0,
  bottom: 0,
} as const;

// ---------- Card ----------

type CardProps = {
  /** 0–3. 클수록 더 떠 보인다. */
  level?: 0 | 1 | 2 | 3;
  /** 테두리선을 뺀다. 카드 위에 겹쳐 놓는 작은 면에 쓴다. */
  flat?: boolean;
  tone?: 'card' | 'alt' | 'primary' | 'accent' | 'sunk';
  radius?: number;
  style?: StyleProp<ViewStyle>;
  boxStyle?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
};

const TONE_BG: Record<NonNullable<CardProps['tone']>, string> = {
  card: T.card,
  alt: T.cardAlt,
  primary: T.primarySoft,
  accent: T.accentSoft,
  sunk: T.bgSunk,
};

export function Card({
  level = 1,
  flat = false,
  tone = 'card',
  radius = RADIUS.lg,
  style,
  boxStyle,
  children,
}: CardProps) {
  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: TONE_BG[tone],
          borderRadius: radius,
          borderWidth: flat ? 0 : StyleSheet.hairlineWidth * 2,
        },
        elevation(level),
        style,
        boxStyle,
      ]}
    >
      {children}
    </View>
  );
}

// ---------- Button ----------

type ButtonVariant = 'primary' | 'accent' | 'soft' | 'outline' | 'ghost' | 'danger';
type ButtonSize = 'sm' | 'md' | 'lg' | 'icon';

type ButtonProps = {
  onPress?: () => void;
  disabled?: boolean;
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** 부모 폭을 꽉 채운다. */
  block?: boolean;
  style?: StyleProp<ViewStyle>;
  boxStyle?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  accessibilityState?: { selected?: boolean; disabled?: boolean };
  children?: React.ReactNode;
};

const VARIANT: Record<ButtonVariant, { bg: string; fg: string; border?: string; level: 0 | 1 | 2 }> = {
  primary: { bg: T.primary, fg: T.primaryFg, level: 2 },
  accent: { bg: T.accent, fg: T.accentFg, level: 2 },
  soft: { bg: T.primarySoft, fg: T.primaryDeep, level: 0 },
  outline: { bg: 'transparent', fg: T.ink, border: T.borderStrong, level: 0 },
  ghost: { bg: 'transparent', fg: T.inkSoft, level: 0 },
  danger: { bg: T.danger, fg: '#FFF7F4', level: 2 },
};

const SIZE: Record<ButtonSize, { h: number; px: number; fs: number; radius: number }> = {
  sm: { h: 36, px: 14, fs: 13, radius: RADIUS.md },
  md: { h: 46, px: 20, fs: 15, radius: RADIUS.md },
  lg: { h: 56, px: 26, fs: 17, radius: RADIUS.lg },
  icon: { h: 42, px: 0, fs: 15, radius: RADIUS.md },
};

/** children 이 글자(문자열·숫자)로만 이뤄졌는지. 섞여 있으면 false. */
function isTextual(children: React.ReactNode) {
  const parts = React.Children.toArray(children);
  return parts.length > 0 && parts.every((c) => typeof c === 'string' || typeof c === 'number');
}

/** 버튼 글자색을 자식 Text 에 물려주기 위한 컨텍스트. */
const ButtonTone = React.createContext<string>(T.ink);

export function useButtonTone() {
  return React.useContext(ButtonTone);
}

export function Button({
  onPress,
  disabled,
  variant = 'primary',
  size = 'md',
  block,
  style,
  boxStyle,
  accessibilityLabel,
  accessibilityState,
  children,
}: ButtonProps) {
  const v = VARIANT[variant];
  const s = SIZE[size];
  const [pressed, setPressed] = React.useState(false);
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={accessibilityState}
      // 스타일은 배열 한 벌로 고정한다. style 을 함수로 넘기면 iOS 에서
      // 배경과 정렬이 통째로 빠지는 일이 있었다 (웹에선 멀쩡했다).
      style={[
        styles.button,
        {
          height: s.h,
          paddingHorizontal: size === 'icon' ? 0 : s.px,
          alignSelf: block ? 'stretch' : 'flex-start',
          borderRadius: s.radius,
          backgroundColor: v.bg,
          borderWidth: v.border ? 1 : 0,
          borderColor: v.border ?? 'transparent',
          opacity: disabled ? 0.45 : 1,
          transform: [{ scale: pressed && !disabled ? 0.975 : 1 }],
        },
        size === 'icon' ? { width: s.h } : null,
        elevation(disabled ? 0 : v.level),
        style,
        boxStyle,
      ]}
    >
      <ButtonTone.Provider value={v.fg}>
        {/* 'Use {n}m' 처럼 조각난 글자도 하나의 Text 로 감싼다.
            날것의 문자열을 그대로 두면 RN 이 "Text strings must be rendered
            within a <Text> component" 로 터진다. */}
        {isTextual(children) ? (
          <Text style={[styles.buttonLabel, { color: v.fg, fontSize: s.fs }]}>{children}</Text>
        ) : (
          children
        )}
      </ButtonTone.Provider>
    </Pressable>
  );
}

/** 버튼 안에 넣는 글자. 버튼 변형에 맞는 색을 자동으로 받는다. */
export function ButtonText({ style, children }: { style?: StyleProp<TextStyle>; children?: React.ReactNode }) {
  const color = useButtonTone();
  return <Text style={[styles.buttonLabel, { color }, style]}>{children}</Text>;
}

// ---------- Progress ----------

export function ProgressBar({
  value,
  tone = 'primary',
  height = 10,
  color,
}: {
  /** 0–1 */
  value: number;
  tone?: 'primary' | 'accent';
  height?: number;
  /** tone 을 무시하고 이 색으로 채운다. 단계마다 색이 바뀌는 게이지용. */
  color?: string;
}) {
  const pct = Math.max(0, Math.min(1, value));
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(pct * 100) }}
      style={[styles.progressTrack, { height, borderRadius: height / 2 }]}
    >
      <View
        style={{
          height: '100%',
          width: `${pct * 100}%`,
          borderRadius: height / 2,
          backgroundColor: color ?? (tone === 'accent' ? T.accent : T.primary),
        }}
      />
    </View>
  );
}

// ---------- 타이포 ----------

export function Title({ style, children }: { style?: StyleProp<TextStyle>; children?: React.ReactNode }) {
  return <Text style={[styles.title, style]}>{children}</Text>;
}

export function Subtitle({ style, children }: { style?: StyleProp<TextStyle>; children?: React.ReactNode }) {
  return <Text style={[styles.subtitle, style]}>{children}</Text>;
}

/** 섹션 위에 붙는 작은 대문자 라벨. */
export function Label({ style, children }: { style?: StyleProp<TextStyle>; children?: React.ReactNode }) {
  return <Text style={[styles.label, style]}>{children}</Text>;
}

/** 작은 알약 배지. */
export function Chip({
  tone = 'primary',
  style,
  children,
}: {
  tone?: 'primary' | 'accent' | 'neutral';
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
}) {
  const bg = tone === 'accent' ? T.accentSoft : tone === 'neutral' ? T.bgSunk : T.primarySoft;
  const fg = tone === 'accent' ? T.accentDeep : tone === 'neutral' ? T.muted : T.primaryDeep;
  return (
    <View style={[styles.chip, { backgroundColor: bg }, style]}>
      {isTextual(children) ? <Text style={[styles.chipText, { color: fg }]}>{children}</Text> : children}
    </View>
  );
}

export function Divider({ style }: { style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.divider, style]} />;
}

const styles = StyleSheet.create({
  card: {
    borderColor: T.border,
    overflow: 'hidden',
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  buttonLabel: {
    fontFamily: T.fontMedium,
    letterSpacing: 0.2,
  },
  progressTrack: {
    width: '100%',
    backgroundColor: T.bgSunk,
    overflow: 'hidden',
  },
  title: {
    fontFamily: T.fontDisplay,
    fontSize: 22,
    color: T.ink,
    letterSpacing: -0.2,
  },
  subtitle: {
    fontFamily: T.font,
    fontSize: 14,
    color: T.muted,
    lineHeight: 20,
  },
  label: {
    fontFamily: T.fontMedium,
    fontSize: 11,
    letterSpacing: 1.1,
    textTransform: 'uppercase',
    color: T.muted,
  },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: RADIUS.full,
    alignSelf: 'flex-start',
  },
  chipText: {
    fontFamily: T.fontMedium,
    fontSize: 12,
    letterSpacing: 0.2,
  },
  divider: {
    height: StyleSheet.hairlineWidth * 2,
    backgroundColor: T.border,
    alignSelf: 'stretch',
  },
});
