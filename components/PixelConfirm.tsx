import React from 'react';
import { Modal, StyleSheet, Text, View } from 'react-native';
import { Button, Card, RADIUS, T } from './nova';

type ConfirmProps = {
  visible: boolean;
  title: string;
  message: string;
  /** 되돌릴 수 없는 쪽 버튼 글자. */
  confirmLabel: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
};

/** OS 기본 Alert 대신 쓰는 확인창. 웹에서도 같은 모양으로 뜬다. */
export default function ConfirmDialog({
  visible,
  title,
  message,
  confirmLabel,
  cancelLabel = 'Keep going',
  onConfirm,
  onCancel,
}: ConfirmProps) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.backdrop}>
        <Card level={3} radius={RADIUS.xl} style={styles.cardFrame} boxStyle={styles.card}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.message}>{message}</Text>
          <View style={styles.buttons}>
            <Button
              variant="outline"
              onPress={onCancel}
              accessibilityLabel={cancelLabel}
              style={styles.buttonSlot}
            >
              {cancelLabel}
            </Button>
            <Button
              variant="danger"
              onPress={onConfirm}
              accessibilityLabel={confirmLabel}
              style={styles.buttonSlot}
            >
              {confirmLabel}
            </Button>
          </View>
        </Card>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(34,38,28,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  cardFrame: { width: '100%', maxWidth: 360 },
  card: { padding: 24 },
  title: { fontFamily: T.fontDisplay, fontSize: 20, color: T.ink },
  message: { fontFamily: T.font, fontSize: 14, color: T.muted, lineHeight: 21, marginTop: 8 },
  buttons: { flexDirection: 'row', gap: 10, marginTop: 22 },
  buttonSlot: { flex: 1, alignSelf: 'stretch' },
});
