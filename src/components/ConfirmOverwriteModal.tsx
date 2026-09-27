import { Modal, StyleSheet, Text, View } from 'react-native';

import { colors } from '../theme/colors';
import { PrimaryButton } from './PrimaryButton';

type Props = {
  visible: boolean;
  content: string;
  onConfirm: () => void;
  onCancel: () => void;
};

export function ConfirmOverwriteModal({ visible, content, onConfirm, onCancel }: Props) {
  return (
    <Modal animationType="fade" transparent visible={visible} onRequestClose={onCancel}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.body}>
            Este NFC ya contiene información:{'\n'}
            <Text style={styles.content}>{content}</Text>
            {'\n'}
            ¿Deseas sobrescribirlo?
          </Text>
          <View style={styles.actions}>
            <PrimaryButton label="Cancelar" onPress={onCancel} variant="secondary" />
            <PrimaryButton label="Sobrescribir" onPress={onConfirm} variant="danger" />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(26, 35, 50, 0.55)',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 20,
    gap: 16,
  },
  body: {
    color: colors.ink,
    fontSize: 16,
    lineHeight: 24,
  },
  content: {
    fontWeight: '600',
    color: colors.accent,
  },
  actions: {
    gap: 10,
  },
});
