import { ArrowLeft, Lock, Redo2, RotateCcw, Undo2 } from 'lucide-react-native';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Avatar, type StickerDrag } from '@/components/Avatar';
import BadgeShelf from '@/components/BadgeShelf';
import { PixelBox, PixelButton, PixelProgress, T } from '@/components/pixel';
import { confirmDestructive } from '@/lib/confirm';
import { formatDuration, loadSessions, type StudySession } from '@/lib/sessions';
import {
  FRAME_UNLOCKS,
  MAX_LEVEL,
  STICKER_UNLOCKS,
  studyStats,
  unlockFor,
  type Unlock,
} from '@/lib/progress';
import {
  AVATARS,
  FRAMES,
  MAX_STICKERS,
  NAME_MAX,
  STICKERS,
  TITLE_MAX,
  bringStickerToFront,
  nameError,
  normalizeProfile,
  saveProfile,
  type Profile,
} from '@/lib/auth';
import {
  canRedo,
  canUndo,
  commit,
  commitFrom,
  initHistory,
  redo,
  replace,
  undo,
  type History,
} from '@/lib/history';

const CANVAS = 220;

export interface ProfileEditProps {
  profile: Profile;
  onProfileChanged: (profile: Profile) => void;
  onBack?: () => void;
}

export default function ProfileEdit({ profile, onProfileChanged, onBack }: ProfileEditProps) {
  // There is no Save button and no Cancel — every change is written through, so
  // undo is the only way back. The stack lives here because this screen is the
  // only writer while it is mounted.
  const [history, setHistory] = useState<History<Profile>>(() => initHistory(profile));
  // mirrored so the drag callbacks — created once per gesture, not per frame —
  // can read the value the current render has, and the one a frame just wrote
  const historyRef = useRef(history);
  historyRef.current = history;

  const [name, setName] = useState(profile.name);
  const [nameProblem, setNameProblem] = useState<string | null>(null);
  const [title, setTitle] = useState(profile.title ?? '');
  // a drag would otherwise be stolen by the surrounding scroll view
  const [dragging, setDragging] = useState(false);
  // where the profile sat when the current sticker gesture began
  const gestureStart = useRef<Profile | null>(null);
  // null until the history loads, so the level never flashes a wrong number
  const [sessions, setSessions] = useState<StudySession[] | null>(null);
  // which grid was tapped, and why that cosmetic is still out of reach
  const [lockedNote, setLockedNote] = useState<{ grid: 'frame' | 'sticker'; text: string } | null>(
    null
  );

  useEffect(() => {
    loadSessions().then(setSessions);
  }, []);

  const present = history.present;
  const stats = useMemo(() => (sessions ? studyStats(sessions) : null), [sessions]);

  /**
   * The unlock still standing between the user and a cosmetic, or null when it is
   * free, already earned, or the stats have not loaded yet. Selecting an equipped
   * item skips this check, so a saved look is never locked out from under it.
   */
  const lockedBy = (unlocks: Record<string, Unlock>, value: string): Unlock | null => {
    if (!stats) return null;
    const unlock = unlockFor(unlocks, value);
    return unlock && !unlock.earned(stats) ? unlock : null;
  };

  // The present profile owns both text fields, so undo, a trimmed commit, and a
  // cleared field all land in the input. A missing key blanks the field.
  useEffect(() => {
    setTitle(present.title ?? '');
  }, [present.title]);
  useEffect(() => {
    setName(present.name);
    setNameProblem(null);
  }, [present.name]);

  /**
   * Publishes a snapshot before the write lands, so a fast second edit sees the
   * fresh profile. A no-op commit (commit/replace/undo return the same history
   * object) publishes nothing, which keeps taps and re-submits from re-writing.
   */
  const publish = useCallback(
    (next: History<Profile>, persist = true) => {
      if (next === historyRef.current) return;
      historyRef.current = next;
      setHistory(next);
      onProfileChanged(next.present);
      if (persist) void saveProfile(next.present);
    },
    [onProfileChanged]
  );

  /** A plain edit — the snapshot it replaces becomes one undo step. */
  const edit = useCallback(
    (patch: Partial<Profile>) => {
      const current = historyRef.current;
      publish(commit(current, normalizeProfile({ ...current.present, ...patch })));
    },
    [publish]
  );

  const step = (transform: (current: History<Profile>) => History<Profile>) =>
    publish(transform(historyRef.current));

  const commitName = () => {
    const problem = nameError(name);
    setNameProblem(problem);
    const trimmed = name.trim();
    if (problem) return;
    // same name, different whitespace — tidy the field without a write
    if (trimmed === present.name) {
      setName(present.name);
      return;
    }
    edit({ name: trimmed });
  };

  const resetLook = () => {
    confirmDestructive(
      'Reset profile?',
      'Picture, title, frame, and stickers go back to their defaults. Your name and your study history are kept.',
      'Reset',
      // blank values are dropped by normalizeProfile, which is what clears a field
      () => edit({ avatar: '', title: '', frame: '', stickers: [] })
    );
  };

  const stickers = present.stickers ?? [];

  const drag: StickerDrag = {
    onStart: () => {
      gestureStart.current = historyRef.current.present;
      setDragging(true);
    },
    // Frames update in memory only. One undo step per gesture, not sixty, and
    // AsyncStorage is not a 60Hz sink.
    onMove: (index, x, y) => {
      const current = historyRef.current;
      publish(
        replace(
          current,
          normalizeProfile({
            ...current.present,
            stickers: (current.present.stickers ?? []).map((sticker, i) =>
              i === index ? { ...sticker, x, y } : sticker
            ),
          })
        ),
        false
      );
    },
    onTap: (index) => {
      const current = historyRef.current;
      const base = gestureStart.current ?? current.present;
      gestureStart.current = null;
      publish(
        commitFrom(
          current,
          base,
          normalizeProfile({
            ...current.present,
            stickers: (current.present.stickers ?? []).filter((_, i) => i !== index),
          })
        )
      );
    },
    onEnd: (index, moved) => {
      setDragging(false);
      const base = gestureStart.current;
      gestureStart.current = null;
      // a tap committed in onTap and cleared the base; a terminated gesture has not
      if (!base) return;
      const current = historyRef.current;
      // a real drag lifts the sticker above its neighbours, since the last one
      // drawn sits on top — otherwise a fresh sticker stays hidden behind an old one
      publish(
        commitFrom(current, base, moved ? bringStickerToFront(current.present, index) : current.present)
      );
    },
  };

  const addSticker = (glyph: string) => {
    if (stickers.length >= MAX_STICKERS) return;
    // lands in the middle; the user drags it where they want it
    edit({ stickers: [...stickers, { glyph, x: 0.5, y: 0.5 }] });
  };

  const miniStat = (label: string, value: string) => (
    <View style={styles.miniStat}>
      <Text style={styles.miniLabel}>{label}</Text>
      <Text style={styles.miniValue} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
    </View>
  );

  const noteFor = (grid: 'frame' | 'sticker') =>
    lockedNote?.grid === grid ? <Text style={styles.lockedNote}>{lockedNote.text}</Text> : null;

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
              <Text style={styles.subtitle}>{present.name.toUpperCase()}</Text>
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
            <Avatar profile={present} size={CANVAS} shadow={6} drag={drag} />
          </View>
          <Text style={styles.hint}>DRAG A STICKER TO MOVE IT. TAP ONE TO REMOVE IT.</Text>
          <Text style={styles.hint}>EVERY CHANGE SAVES AS YOU GO — UNDO IF YOU CHANGE YOUR MIND.</Text>

          <View style={styles.historyRow}>
            <PixelButton
              shadow={2}
              color={T.bg}
              disabled={!canUndo(history)}
              onPress={() => step(undo)}
              accessibilityLabel="Undo"
              accessibilityState={{ disabled: !canUndo(history) }}
              style={styles.historyButton}
              boxStyle={styles.historyBox}
            >
              <Undo2 size={14} color={T.ink} />
              <Text style={styles.historyLabel}>UNDO</Text>
            </PixelButton>
            <PixelButton
              shadow={2}
              color={T.bg}
              disabled={!canRedo(history)}
              onPress={() => step(redo)}
              accessibilityLabel="Redo"
              accessibilityState={{ disabled: !canRedo(history) }}
              style={styles.historyButton}
              boxStyle={styles.historyBox}
            >
              <Redo2 size={14} color={T.ink} />
              <Text style={styles.historyLabel}>REDO</Text>
            </PixelButton>
          </View>

          {stats ? (
            <PixelBox shadow={0} boxStyle={styles.levelCard}>
              <View style={styles.levelHeader}>
                <Text style={styles.levelTitle} accessibilityRole="header">
                  LEVEL {stats.level}
                </Text>
                <Text style={styles.levelCaption}>
                  {stats.level >= MAX_LEVEL
                    ? 'MAX LEVEL'
                    : `${formatDuration(stats.remainingMs).toUpperCase()} TO ${
                        stats.level + 1
                      }`}
                </Text>
              </View>
              <View style={styles.levelBar}>
                <PixelProgress value={stats.progress} />
              </View>
              <View style={styles.statRow}>
                {miniStat('TOTAL', formatDuration(stats.totalMs).toUpperCase())}
                {miniStat('STREAK', `${stats.current}D`)}
                {miniStat('SESSIONS', String(stats.sessionCount))}
              </View>
            </PixelBox>
          ) : null}

          <Text style={styles.fieldLabel}>NAME</Text>
          <TextInput
            value={name}
            onChangeText={(value) => {
              setName(value);
              if (nameProblem) setNameProblem(null);
            }}
            onBlur={commitName}
            onSubmitEditing={commitName}
            placeholder="ADA"
            placeholderTextColor={T.muted}
            maxLength={NAME_MAX}
            returnKeyType="done"
            accessibilityLabel="Your name"
            accessibilityHint="Shown on the timer and in config"
            style={styles.input}
          />
          {nameProblem ? (
            <Text style={styles.error}>{nameProblem}</Text>
          ) : (
            <Text style={styles.fieldHint}>SHOWN ON THE TIMER AND IN CONFIG.</Text>
          )}

          <Text style={styles.fieldLabel}>PICTURE</Text>
          <View style={styles.grid}>
            {AVATARS.map((glyph) => (
              <PixelButton
                key={glyph}
                shadow={2}
                color={present.avatar === glyph ? T.primary : T.bg}
                accessibilityLabel={`Picture ${glyph}`}
                accessibilityState={{ selected: present.avatar === glyph }}
                onPress={() => edit({ avatar: glyph })}
                boxStyle={styles.cell}
              >
                <Text style={styles.cellGlyph}>{glyph}</Text>
              </PixelButton>
            ))}
          </View>

          <Text style={styles.fieldLabel}>STICKERS</Text>
          <Text style={styles.fieldHint}>
            TAP TO ADD ({stickers.length}/{MAX_STICKERS}), THEN DRAG IT INTO PLACE.{
              ' '
            }{Object.keys(STICKER_UNLOCKS).length} MORE ARE EARNED BY STUDYING.
          </Text>
          <View style={styles.grid}>
            {STICKERS.map((glyph) => {
              const unlock = lockedBy(STICKER_UNLOCKS, glyph);
              return (
                <PixelButton
                  key={glyph}
                  shadow={2}
                  color={unlock ? T.secondary : T.bg}
                  disabled={stickers.length >= MAX_STICKERS}
                  accessibilityLabel={unlock ? `Sticker ${glyph}, locked` : `Add sticker ${glyph}`}
                  accessibilityHint={unlock?.label}
                  onPress={() =>
                    unlock
                      ? setLockedNote({ grid: 'sticker', text: `${glyph} IS EARNED — ${unlock.label}` })
                      : addSticker(glyph)
                  }
                  boxStyle={styles.cell}
                >
                  <Text style={[styles.cellGlyph, !!unlock && styles.cellLockedGlyph]}>{glyph}</Text>
                </PixelButton>
              );
            })}
          </View>
          {noteFor('sticker')}

          <Text style={styles.fieldLabel}>TITLE</Text>
          <TextInput
            value={title}
            onChangeText={setTitle}
            onBlur={() => edit({ title: title.trim() })}
            onSubmitEditing={() => edit({ title: title.trim() })}
            placeholder="NIGHT OWL"
            placeholderTextColor={T.muted}
            maxLength={TITLE_MAX}
            returnKeyType="done"
            accessibilityLabel="Profile title"
            style={styles.input}
          />
          <Text style={styles.fieldHint}>
            {title.length}/{TITLE_MAX} — A SHORT TAG UNDER YOUR NAME. LEAVE IT BLANK TO CLEAR IT.
          </Text>

          <Text style={styles.fieldLabel}>OUTER LINE</Text>
          <Text style={styles.fieldHint}>
            {Object.keys(FRAME_UNLOCKS).length} MORE COLOURS UNLOCK AS YOU STUDY.
          </Text>
          <View style={styles.grid}>
            {FRAMES.map((frame) => {
              const selected = (present.frame ?? T.ink) === frame.value;
              // an equipped frame stays usable even if its unlock is no longer earned
              const unlock = selected ? null : lockedBy(FRAME_UNLOCKS, frame.value);
              return (
                <PixelButton
                  key={frame.value}
                  shadow={2}
                  color={unlock ? T.secondary : frame.value}
                  accessibilityLabel={`Outer line ${frame.label}${unlock ? ', locked' : ''}`}
                  accessibilityHint={unlock?.label}
                  accessibilityState={{ selected }}
                  onPress={() =>
                    unlock
                      ? setLockedNote({ grid: 'frame', text: `${frame.label} IS EARNED — ${unlock.label}` })
                      : edit({ frame: frame.value })
                  }
                  boxStyle={[styles.cell, selected && styles.cellSelected]}
                >
                  {unlock ? <Lock size={14} color={T.ink} /> : <View />}
                </PixelButton>
              );
            })}
          </View>
          {noteFor('frame')}

          {sessions && stats ? (
            <>
              <Text style={styles.fieldLabel}>TROPHY CASE</Text>
              <View style={styles.badgeWrap}>
                <BadgeShelf sessions={sessions} stats={stats} />
              </View>
            </>
          ) : null}

          <Text style={styles.fieldLabel}>START OVER</Text>
          <Text style={styles.fieldHint}>
            CLEARS THE PICTURE, TITLE, OUTER LINE, AND STICKERS. YOUR NAME STAYS.
          </Text>
          <PixelButton
            shadow={2}
            color={T.bg}
            onPress={resetLook}
            accessibilityLabel="Reset look"
            style={styles.resetWrap}
            boxStyle={styles.resetBox}
          >
            <RotateCcw size={14} color={T.ink} />
            <Text style={styles.resetLabel}>RESET LOOK</Text>
          </PixelButton>
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

  historyRow: { flexDirection: 'row', gap: 8, marginTop: 14 },
  historyButton: { flex: 1 },
  historyBox: {
    height: 36,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  historyLabel: { fontFamily: T.fontPixel, fontSize: 8, color: T.ink },

  fieldLabel: { fontFamily: T.fontPixel, fontSize: 8, color: T.muted, marginTop: 18 },
  fieldHint: { fontFamily: T.fontPixel, fontSize: 7, lineHeight: 12, color: T.muted, marginTop: 6 },
  error: { fontFamily: T.fontPixel, fontSize: 7, lineHeight: 12, color: T.primary, marginTop: 6 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  cell: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  cellSelected: { borderColor: T.primaryFg },
  cellGlyph: { fontSize: 18, textAlign: 'center' },
  cellLockedGlyph: { opacity: 0.3 },
  lockedNote: { fontFamily: T.fontPixel, fontSize: 7, lineHeight: 12, color: T.primary, marginTop: 10 },

  levelCard: { padding: 14, backgroundColor: T.secondary, marginTop: 18 },
  levelHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  levelTitle: { fontFamily: T.fontPixel, fontSize: 12, color: T.ink },
  levelCaption: { fontFamily: T.fontPixel, fontSize: 8, color: T.muted },
  levelBar: { marginVertical: 12 },
  statRow: { flexDirection: 'row', gap: 8 },
  miniStat: {
    flex: 1,
    borderWidth: 2,
    borderColor: T.ink,
    backgroundColor: T.bg,
    paddingVertical: 8,
    paddingHorizontal: 4,
    alignItems: 'center',
  },
  miniLabel: { fontFamily: T.fontPixel, fontSize: 7, color: T.muted },
  miniValue: { fontFamily: T.fontPixel, fontSize: 10, color: T.ink, marginTop: 8 },

  badgeWrap: { marginTop: 12 },
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
  resetWrap: { marginTop: 10, alignSelf: 'flex-start' },
  resetBox: {
    height: 36,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 12,
  },
  resetLabel: { fontFamily: T.fontPixel, fontSize: 8, color: T.ink },
});
