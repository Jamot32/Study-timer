import React from 'react';
import { Modal, StyleSheet, Text, View } from 'react-native';
import { PixelBox, PixelButton, T } from './pixel';

type PixelConfirmProps = {
  visible: boolean;
  title: string;
  message: string;
  /** 빨간 쪽 버튼 글자. 되돌릴 수 없는 쪽이다. */
  confirmLabel: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
};

/** OS 기본 Alert 대신 쓰는 픽셀 확인창. 웹에서도 같은 모양으로 뜬다. */
export default function PixelConfirm({
  visible,
  title,
  message,
  confirmLabel,
  cancelLabel = 'KEEP GOING',
  onConfirm,
  onCancel,
}: PixelConfirmProps) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.backdrop}>
        <PixelBox shadow={6} style={styles.cardFrame} boxStyle={styles.card}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.message}>{message}</Text>
          <View style={styles.buttons}>
            <PixelButton
              onPress={onCancel}
              color={T.secondary}
              shadow={3}
              accessibilityLabel={cancelLabel}
              style={styles.buttonSlot}
              boxStyle={styles.button}
            >
              <Text style={[styles.buttonText, { color: T.ink }]}>{cancelLabel}</Text>
            </PixelButton>
            <PixelButton
              onPress={onConfirm}
              color="#6b3f42"
              shadow={3}
              accessibilityLabel={confirmLabel}
              style={styles.buttonSlot}
              boxStyle={styles.button}
            >
              <Text style={[styles.buttonText, { color: T.primaryFg }]}>{confirmLabel}</Text>
            </PixelButton>
          </View>
        </PixelBox>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(46,34,24,0.55)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  cardFrame: { width: '100%', maxWidth: 340 },
  card: { backgroundColor: T.bg, borderColor: T.ink, padding: 20 },
  title: { fontFamily: T.fontPixel, fontSize: 11, color: T.ink },
  message: { fontFamily: T.fontPixel, fontSize: 8, color: T.muted, lineHeight: 15, marginTop: 14 },
  // 여백은 바깥에, 모양은 안쪽 박스에 — 그림자가 여백까지 덮지 않도록.
  buttons: { flexDirection: 'row', gap: 10, marginTop: 22 },
  buttonSlot: { flex: 1 },
  button: { height: 46, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 },
  buttonText: { fontFamily: T.fontPixel, fontSize: 8, textAlign: 'center' },
});
