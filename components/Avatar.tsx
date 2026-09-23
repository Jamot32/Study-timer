import React, { useRef } from 'react';
import { Image, PanResponder, StyleSheet, Text, View } from 'react-native';
import { ABS_FILL, elevation, T } from '@/components/nova';
import { clamp01, isImageAvatar, type Profile, type Sticker } from '@/lib/profile';

/** Sticker box as a fraction of the picture. */
const STICKER_RATIO = 0.28;

/** 아바타 테두리 두께. 스티커는 이 안쪽에 얹힌다. */
const BORDER = 2;

export type StickerDrag = {
  onMove: (index: number, x: number, y: number) => void;
  onStart?: () => void;
  onEnd?: () => void;
  /** A tap that never moved — used to remove the sticker. */
  onTap?: (index: number) => void;
};

/** Fixed-size box centring the glyph: emoji metrics differ per platform, box size doesn't. */
function StickerView({
  sticker,
  size,
  range,
  responder,
}: {
  sticker: Sticker;
  size: number;
  range: number;
  responder?: ReturnType<typeof PanResponder.create>;
}) {
  return (
    <View
      {...(responder?.panHandlers ?? {})}
      style={[
        styles.sticker,
        { width: size, height: size, left: sticker.x * range, top: sticker.y * range },
      ]}
    >
      <Text style={{ fontSize: size * 0.8 }}>{sticker.glyph}</Text>
    </View>
  );
}

function DraggableSticker({
  sticker,
  index,
  size,
  range,
  drag,
}: {
  sticker: Sticker;
  index: number;
  size: number;
  range: number;
  drag: StickerDrag;
}) {
  // the responder is created once, so it reads live values through refs
  const latest = useRef(sticker);
  latest.current = sticker;
  const rangeRef = useRef(range);
  rangeRef.current = range || 1;
  const live = useRef({ index, drag });
  live.current = { index, drag };
  // the drag is relative to where the sticker sat when it was grabbed
  const start = useRef({ x: sticker.x, y: sticker.y, moved: false });
  const responder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        start.current = { x: latest.current.x, y: latest.current.y, moved: false };
        live.current.drag.onStart?.();
      },
      onPanResponderMove: (_event, gesture) => {
        if (Math.abs(gesture.dx) > 2 || Math.abs(gesture.dy) > 2) start.current.moved = true;
        live.current.drag.onMove(
          live.current.index,
          clamp01(start.current.x + gesture.dx / rangeRef.current),
          clamp01(start.current.y + gesture.dy / rangeRef.current)
        );
      },
      onPanResponderRelease: () => {
        if (!start.current.moved) live.current.drag.onTap?.(live.current.index);
        live.current.drag.onEnd?.();
      },
      onPanResponderTerminate: () => live.current.drag.onEnd?.(),
    })
  ).current;

  return <StickerView sticker={sticker} size={size} range={range} responder={responder} />;
}

export function Avatar({
  profile,
  size = 40,
  shadow = 1,
  background = T.primarySoft,
  drag,
}: {
  profile?: Profile;
  size?: number;
  /** 0–3. 카드 위에 얹을 땐 낮게. */
  shadow?: 0 | 1 | 2 | 3;
  background?: string;
  /** Supply to make the stickers draggable; omit for a static picture. */
  drag?: StickerDrag;
}) {
  const initials = (profile?.name.trim() || 'Guest').slice(0, 2).toUpperCase();
  // the sticker layer is the box INSIDE the border, so the border comes off first —
  // measuring against the full size pushed every sticker past the edge, and by a
  // bigger fraction the smaller the avatar got.
  const inner = size - 2 * BORDER;
  const stickerSize = inner * STICKER_RATIO;
  const range = inner - stickerSize;

  return (
    <View
      style={[
        {
          width: size,
          height: size,
          // 완전한 원이 아니라 살짝 눌린 라운드 사각 — nova 의 아바타 모양.
          borderRadius: size * 0.34,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: background,
          borderWidth: BORDER,
          borderColor: profile?.frame ?? T.border,
          overflow: 'hidden',
        },
        elevation(shadow),
      ]}
    >
      {isImageAvatar(profile?.avatar) ? (
        <Image source={{ uri: profile!.avatar }} style={styles.image} />
      ) : profile?.avatar ? (
        <Text style={{ fontSize: size * 0.5 }}>{profile.avatar}</Text>
      ) : (
        <Text style={{ fontFamily: T.fontBold, fontSize: size * 0.34, color: T.primaryDeep }}>
          {initials}
        </Text>
      )}
      <View pointerEvents={drag ? 'box-none' : 'none'} style={styles.layer}>
        {profile?.stickers?.map((sticker, index) =>
          drag ? (
            <DraggableSticker
              key={index}
              sticker={sticker}
              index={index}
              size={stickerSize}
              range={range}
              drag={drag}
            />
          ) : (
            <StickerView key={index} sticker={sticker} size={stickerSize} range={range} />
          )
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  image: { width: '100%', height: '100%' },
  layer: { ...ABS_FILL },
  sticker: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
});
