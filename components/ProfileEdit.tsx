import { ArrowLeft } from 'lucide-react-native';
import React, { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Avatar, type StickerDrag } from '@/components/Avatar';
import { Button, Card, RADIUS, T } from '@/components/nova';
import {
  AVATARS,
  FRAMES,
  MAX_STICKERS,
  STICKERS,
  normalizeProfile,
  saveProfile,
  type Profile,
} from '@/lib/auth';

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
      <View style={styles.body}>
          <View style={styles.headerRow}>
            <Button
              size="icon"
              variant="ghost"
              onPress={onBack}
              accessibilityLabel="Back"
              style={styles.backBtn}
            >
              <ArrowLeft size={20} color={T.inkSoft} />
            </Button>
            <View style={styles.headerText}>
              <Text style={styles.title} accessibilityRole="header">
                Profile
              </Text>
              <Text style={styles.subtitle}>{profile.name}</Text>
            </View>
          </View>

          <View style={styles.canvasWrap}>
            <Avatar profile={profile} size={CANVAS} shadow={3} drag={drag} />
          </View>
          <Text style={styles.hint}>Drag a sticker to move it. Tap one to remove it.</Text>

          <Text style={styles.fieldLabel}>Picture</Text>
          <View style={styles.grid}>
            {AVATARS.map((glyph) => (
              <Pressable
                key={glyph}
                accessibilityRole="button"
                accessibilityLabel={`Picture ${glyph}`}
                accessibilityState={{ selected: profile.avatar === glyph }}
                onPress={() => edit({ avatar: glyph })}
                style={({ pressed }) => [
                  styles.cell,
                  profile.avatar === glyph && styles.cellSelected,
                  pressed && { opacity: 0.6 },
                ]}
              >
                <Text style={styles.cellGlyph}>{glyph}</Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.fieldLabel}>Stickers</Text>
          <Text style={styles.fieldHint}>
            Tap to add ({stickers.length}/{MAX_STICKERS}), then drag it into place.
          </Text>
          <View style={styles.grid}>
            {STICKERS.map((glyph) => {
              const full = stickers.length >= MAX_STICKERS;
              return (
                <Pressable
                  key={glyph}
                  disabled={full}
                  accessibilityRole="button"
                  accessibilityLabel={`Add sticker ${glyph}`}
                  onPress={() => addSticker(glyph)}
                  style={({ pressed }) => [
                    styles.cell,
                    full && { opacity: 0.35 },
                    pressed && { opacity: 0.6 },
                  ]}
                >
                  <Text style={styles.cellGlyph}>{glyph}</Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={styles.fieldLabel}>Title</Text>
          <TextInput
            value={title}
            onChangeText={setTitle}
            onBlur={() => edit({ title: title.trim() })}
            onSubmitEditing={() => edit({ title: title.trim() })}
            placeholder="Night owl"
            placeholderTextColor={T.muted}
            maxLength={20}
            returnKeyType="done"
            accessibilityLabel="Profile title"
            style={styles.input}
          />

          <Text style={styles.fieldLabel}>Frame color</Text>
          <View style={styles.grid}>
            {FRAMES.map((frame) => {
              const selected = (profile.frame ?? T.border) === frame.value;
              return (
                <Pressable
                  key={frame.value}
                  accessibilityRole="button"
                  accessibilityLabel={`Frame ${frame.label}`}
                  accessibilityState={{ selected }}
                  onPress={() => edit({ frame: frame.value })}
                  style={({ pressed }) => [
                    styles.swatch,
                    { backgroundColor: frame.value },
                    selected && styles.swatchSelected,
                    pressed && { opacity: 0.6 },
                  ]}
                />
              );
            })}
          </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, width: '100%', backgroundColor: T.bg, paddingHorizontal: 16, paddingTop: 8 },
  body: { gap: 2 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  headerText: { flex: 1 },
  backBtn: { marginLeft: -10 },
  title: { fontFamily: T.fontDisplay, fontSize: 26, color: T.ink, letterSpacing: -0.3 },
  subtitle: { fontFamily: T.font, fontSize: 14, color: T.muted, marginTop: 2 },

  canvasWrap: { alignItems: 'center', marginTop: 20 },
  hint: { fontFamily: T.font, fontSize: 13, lineHeight: 19, color: T.muted, textAlign: 'center', marginTop: 14 },

  fieldLabel: {
    fontFamily: T.fontMedium,
    fontSize: 11,
    letterSpacing: 1.1,
    textTransform: 'uppercase',
    color: T.muted,
    marginTop: 22,
  },
  fieldHint: { fontFamily: T.font, fontSize: 13, lineHeight: 19, color: T.muted, marginTop: 6 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 12 },
  cell: {
    width: 46,
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: T.border,
    backgroundColor: T.card,
  },
  cellSelected: { borderColor: T.primary, backgroundColor: T.primarySoft, borderWidth: 2 },
  cellGlyph: { fontSize: 22, textAlign: 'center' },
  swatch: {
    width: 46,
    height: 46,
    borderRadius: RADIUS.full,
    borderWidth: 2,
    borderColor: T.border,
  },
  swatchSelected: { borderColor: T.ink, borderWidth: 3 },
  input: {
    fontFamily: T.font,
    fontSize: 16,
    color: T.ink,
    borderWidth: 1,
    borderColor: T.border,
    borderRadius: RADIUS.md,
    backgroundColor: T.cardAlt,
    paddingHorizontal: 14,
    paddingVertical: 13,
    marginTop: 12,
  },
});
