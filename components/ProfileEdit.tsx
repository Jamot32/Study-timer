import { ArrowLeft } from 'lucide-react-native';
import React, { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Avatar, type StickerDrag } from '@/components/Avatar';
import { PixelBox, PixelButton, T } from '@/components/pixel';
import {
  AVATARS,
  FRAMES,
  MAX_STICKERS,
  STICKERS,
  normalizeProfile,
  saveProfile,
  type Profile,
} from '@/lib/profile';

const CANVAS = 220;

export interface ProfileEditProps {
  profile: Profile;
  onProfileChanged: (profile: Profile) => void;
  onBack?: () => void;
}

export default function ProfileEdit({ profile, onProfileChanged, onBack }: ProfileEditProps) {
  const [title, setTitle] = useState(profile.title ?? '');
  // a drag would otherwise be stolen by the surrounding scroll view
  const [dragging, setDragging] = useState(false);

  /** Publishes before the write lands, so a fast second edit sees the fresh profile. */
  const edit = useCallback(
    (patch: Partial<Profile>, persist = true) => {
      const next = normalizeProfile({ ...profile, ...patch });
      onProfileChanged(next);
      if (persist) void saveProfile(next);
      return next;
    },
    [profile, onProfileChanged]
  );

  const stickers = profile.stickers ?? [];

  const drag: StickerDrag = {
    // dragging updates in memory only — AsyncStorage is not a 60Hz sink
    onMove: (index, x, y) =>
      edit(
        { stickers: stickers.map((sticker, i) => (i === index ? { ...sticker, x, y } : sticker)) },
        false
      ),
    onStart: () => setDragging(true),
    onEnd: () => {
      setDragging(false);
      void saveProfile(profile);
    },
    onTap: (index) => edit({ stickers: stickers.filter((_, i) => i !== index) }),
  };

  const addSticker = (glyph: string) => {
    if (stickers.length >= MAX_STICKERS) return;
    // lands in the middle; the user drags it where they want it
    edit({ stickers: [...stickers, { glyph, x: 0.5, y: 0.5 }] });
  };

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={{ paddingBottom: 40 }}
      showsVerticalScrollIndicator={false}
      scrollEnabled={!dragging}
    >
      <PixelBox shadow={6} boxStyle={styles.frame}>
        <View style={styles.body}>
          <View style={styles.headerRow}>
            <View style={styles.headerText}>
              <Text style={styles.title} accessibilityRole="header">
                PROFILE
              </Text>
              <Text style={styles.subtitle}>{profile.name.toUpperCase()}</Text>
            </View>
            <PixelButton
              shadow={0}
              color={T.secondary}
              onPress={onBack}
              accessibilityLabel="Back"
              boxStyle={styles.backBox}
            >
              <ArrowLeft size={20} color={T.ink} />
            </PixelButton>
          </View>

          <View style={styles.canvasWrap}>
            <Avatar profile={profile} size={CANVAS} shadow={6} drag={drag} />
          </View>
          <Text style={styles.hint}>
            DRAG A STICKER TO MOVE IT. TAP ONE TO REMOVE IT.
          </Text>

          <Text style={styles.fieldLabel}>PICTURE</Text>
          <View style={styles.grid}>
            {AVATARS.map((glyph) => (
              <PixelButton
                key={glyph}
                shadow={2}
                color={profile.avatar === glyph ? T.primary : T.bg}
                accessibilityLabel={`Picture ${glyph}`}
                accessibilityState={{ selected: profile.avatar === glyph }}
                onPress={() => edit({ avatar: glyph })}
                boxStyle={styles.cell}
              >
                <Text style={styles.cellGlyph}>{glyph}</Text>
              </PixelButton>
            ))}
          </View>

          <Text style={styles.fieldLabel}>STICKERS</Text>
          <Text style={styles.fieldHint}>
            TAP TO ADD ({stickers.length}/{MAX_STICKERS}), THEN DRAG IT INTO PLACE.
          </Text>
          <View style={styles.grid}>
            {STICKERS.map((glyph) => (
              <PixelButton
                key={glyph}
                shadow={2}
                color={T.bg}
                disabled={stickers.length >= MAX_STICKERS}
                accessibilityLabel={`Add sticker ${glyph}`}
                onPress={() => addSticker(glyph)}
                boxStyle={styles.cell}
              >
                <Text style={styles.cellGlyph}>{glyph}</Text>
              </PixelButton>
            ))}
          </View>

          <Text style={styles.fieldLabel}>TITLE</Text>
          <TextInput
            value={title}
            onChangeText={setTitle}
            onBlur={() => edit({ title: title.trim() })}
            onSubmitEditing={() => edit({ title: title.trim() })}
            placeholder="NIGHT OWL"
            placeholderTextColor={T.muted}
            maxLength={20}
            returnKeyType="done"
            accessibilityLabel="Profile title"
            style={styles.input}
          />

          <Text style={styles.fieldLabel}>OUTER LINE</Text>
          <View style={styles.grid}>
            {FRAMES.map((frame) => (
              <PixelButton
                key={frame.value}
                shadow={2}
                color={frame.value}
                accessibilityLabel={`Outer line ${frame.label}`}
                accessibilityState={{ selected: (profile.frame ?? T.ink) === frame.value }}
                onPress={() => edit({ frame: frame.value })}
                boxStyle={[
                  styles.cell,
                  (profile.frame ?? T.ink) === frame.value && styles.cellSelected,
                ]}
              >
                <View />
              </PixelButton>
            ))}
          </View>
        </View>
      </PixelBox>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, width: '100%', backgroundColor: T.bg, paddingHorizontal: 16, paddingTop: 4 },
  frame: { padding: 14 },
  body: { gap: 4 },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  headerText: { flex: 1 },
  backBox: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: T.fontPixel, fontSize: 13, color: T.ink },
  subtitle: { fontFamily: T.fontPixel, fontSize: 8, color: T.muted, marginTop: 10 },

  canvasWrap: { alignItems: 'center', marginTop: 18 },
  hint: { fontFamily: T.fontPixel, fontSize: 7, lineHeight: 12, color: T.muted, textAlign: 'center', marginTop: 12 },

  fieldLabel: { fontFamily: T.fontPixel, fontSize: 8, color: T.muted, marginTop: 18 },
  fieldHint: { fontFamily: T.fontPixel, fontSize: 7, lineHeight: 12, color: T.muted, marginTop: 6 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  cell: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  cellSelected: { borderColor: T.primaryFg },
  cellGlyph: { fontSize: 18, textAlign: 'center' },
  input: {
    fontFamily: T.fontPixel,
    fontSize: 9,
    color: T.ink,
    borderWidth: 4,
    borderColor: T.ink,
    backgroundColor: T.bg,
    paddingHorizontal: 10,
    paddingVertical: 12,
    marginTop: 10,
  },
});
