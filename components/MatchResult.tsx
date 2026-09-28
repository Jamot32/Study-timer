import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Coins, Flag, Minus, TrendingDown, TrendingUp } from 'lucide-react-native';
import { Button, Card, RADIUS, T } from '@/components/nova';
import type { Arena } from '@/lib/arena';
import type { MatchOutcome, Settlement } from '@/lib/match';

export type MatchResultData = {
  arena: Arena;
  outcome: MatchOutcome;
  /** 솔로 매치였는지. 상대도 참가비도 ELO 도 없는 판. */
  solo: boolean;
  resigned: boolean;
  mySeconds: number;
  theirSeconds: number;
  myFp: number;
  theirFp: number;
  settlement: Settlement;
  eloBefore: number;
  eloAfter: number;
  /** 오늘 기록에 쌓인 총 공부 분. 화면 맨 아래에서 마지막으로 읽히는 숫자. */
  studiedTodayMinutes: number;
};

const span = (seconds: number) => {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
};

const signed = (n: number) => (n > 0 ? `+${n}` : `${n}`);

/** 정산 한 줄. 계산 과정을 감추지 않는다 — 감추면 참가비만 기억에 남는다. */
function Line({
  label,
  value,
  tone = 'plain',
  strong,
}: {
  label: string;
  value: string;
  tone?: 'plain' | 'good' | 'bad';
  strong?: boolean;
}) {
  const color = tone === 'good' ? T.accentDeep : tone === 'bad' ? T.danger : T.ink;
  return (
    <View style={styles.line}>
      <Text style={[styles.lineLabel, strong && styles.lineLabelStrong]}>{label}</Text>
      <Text style={[styles.lineValue, { color }, strong && styles.lineValueStrong]}>{value}</Text>
    </View>
  );
}

export default function MatchResult({
  data,
  onDone,
}: {
  data: MatchResultData;
  onDone: () => void;
}) {
  const { arena, outcome, settlement, resigned, solo } = data;
  const won = outcome === 'win';
  const drew = outcome === 'draw';

  const Icon = won ? TrendingUp : drew ? Minus : resigned ? Flag : TrendingDown;
  const headline = won ? 'You win' : drew ? 'Dead even' : resigned ? 'Resigned' : 'You lose';
  const tone = won ? T.accentDeep : drew ? T.inkSoft : T.danger;

  const eloMove = data.eloAfter - data.eloBefore;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.head}>
        <Icon size={26} color={tone} strokeWidth={2.2} />
        <Text style={[styles.headline, { color: tone }]}>{headline}</Text>
      </View>
      <Text style={styles.sub}>
        {solo ? 'Solo' : arena.name} · you {span(data.mySeconds)} · rival{' '}
        {span(data.theirSeconds)}
      </Text>

      <Card level={1} boxStyle={styles.card}>
        <Text style={styles.cardTitle}>Focus points</Text>
        <Line label="You" value={`${data.myFp} FP`} tone={won ? 'good' : 'plain'} />
        <Line label="Rival" value={`${data.theirFp} FP`} tone={!won && !drew ? 'good' : 'plain'} />
      </Card>

      {/* 참가비만 기억에 남지 않도록 환급과 실손실을 계산 과정째로 편다. */}
      <Card level={1} boxStyle={styles.card}>
        <View style={styles.cardHead}>
          <Coins size={17} color={T.primaryDeep} strokeWidth={2.2} />
          <Text style={styles.cardTitle}>Coins</Text>
        </View>
        {solo ? (
          <Line label="Solo — nothing staked" value="0" />
        ) : (
          <Line label="Entry paid" value={`−${arena.entryFee}`} tone="bad" />
        )}
        {settlement.myRefund > 0 && (
          <Line
            label={`Time refund (${span(data.mySeconds)} of ${arena.matchSeconds ? span(arena.matchSeconds) : span(Math.max(data.mySeconds, data.theirSeconds))})`}
            value={`+${settlement.myRefund}`}
            tone="good"
          />
        )}
        {won && (
          <Line
            label={solo ? 'Practice win' : "Winner's share"}
            value={`+${settlement.winnerTake}`}
            tone="good"
          />
        )}
        <View style={styles.rule} />
        <Line
          label="Net"
          value={signed(settlement.myNet)}
          tone={settlement.myNet >= 0 ? 'good' : 'bad'}
          strong
        />
      </Card>

      <Card level={1} boxStyle={styles.card}>
        <Text style={styles.cardTitle}>Rating</Text>
        {solo ? (
          <Line label="Practice match" value="untouched" />
        ) : null}
        {solo ? null : <Line
          label={`${data.eloBefore} → ${data.eloAfter}`}
          value={eloMove === 0 ? 'no change' : signed(eloMove)}
          tone={eloMove > 0 ? 'good' : eloMove < 0 ? 'bad' : 'plain'}
        />}
      </Card>

      {/* 패배 직후 가장 마지막으로 읽는 문장이 "잃지 않은 것"이 되게 한다. */}
      <Card level={0} tone="accent" boxStyle={styles.keepBox}>
        <Text style={styles.keepTitle}>
          {span(data.studiedTodayMinutes * 60)} studied today
        </Text>
        <Text style={styles.keepBody}>Your record keeps every second of it.</Text>
      </Card>

      <Button block size="lg" onPress={onDone} style={styles.done}>
        Back to the arena
      </Button>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, width: '100%', backgroundColor: T.bg, paddingHorizontal: 16 },
  content: { paddingTop: 16, paddingBottom: 28, gap: 12 },

  head: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  headline: { fontFamily: T.fontDisplay, fontSize: 32, letterSpacing: -0.4 },
  sub: { fontFamily: T.font, fontSize: 15, color: T.muted, marginTop: -6, marginBottom: 4 },

  card: { padding: 16, gap: 6 },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardTitle: { fontFamily: T.fontMedium, fontSize: 17, color: T.ink, marginBottom: 2 },

  line: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 },
  lineLabel: { flex: 1, fontFamily: T.font, fontSize: 15, color: T.muted },
  lineLabelStrong: { fontFamily: T.fontMedium, color: T.ink },
  lineValue: { fontFamily: T.fontMedium, fontSize: 16 },
  lineValueStrong: { fontFamily: T.fontDisplay, fontSize: 21 },
  rule: { height: StyleSheet.hairlineWidth * 2, backgroundColor: T.border, marginVertical: 6 },

  keepBox: { padding: 18, borderRadius: RADIUS.lg },
  keepTitle: { fontFamily: T.fontDisplay, fontSize: 22, color: T.accentDeep },
  keepBody: { fontFamily: T.font, fontSize: 15, color: T.accentDeep, marginTop: 4, opacity: 0.85 },

  done: { marginTop: 4 },
});
