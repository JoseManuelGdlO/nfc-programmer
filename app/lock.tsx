import { useState } from 'react';
import { Modal, ScrollView, StyleSheet, Text, View } from 'react-native';

import { PrimaryButton } from '@/components/PrimaryButton';
import { colors } from '@/theme/colors';

export default function LockScreen() {
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [blockedMessage, setBlockedMessage] = useState<string | null>(null);

  const handleSecondConfirm = () => {
    setConfirmVisible(false);
    setBlockedMessage('Función no habilitada — pendiente de autorización');
  };

  return (
    <ScrollView contentContainerStyle={styles.scroll} style={styles.root}>
      <View style={styles.warningBox}>
        <Text style={styles.warningTitle}>ADVERTENCIA</Text>
        <Text style={styles.warningBody}>
          El bloqueo permanente convierte la etiqueta NTAG213 en{' '}
          <Text style={styles.emphasis}>SOLO LECTURA</Text>. Esta operación es{' '}
          <Text style={styles.emphasis}>irreversible</Text>: no podrás volver a escribir ni
          corregir el contenido NDEF en software.
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Mecanismo NTAG213 (referencia)</Text>
        <Text style={styles.body}>
          • <Text style={styles.mono}>Bloqueo estático</Text> — página{' '}
          <Text style={styles.mono}>02h</Text>, bytes 2–3 (bits OTP; pasan de 0→1 con OR
          bitwise; no se revierten).
        </Text>
        <Text style={styles.body}>
          • <Text style={styles.mono}>Bloqueo dinámico</Text> — página{' '}
          <Text style={styles.mono}>28h</Text> en NTAG213; protege la memoria de usuario desde
          la página <Text style={styles.mono}>10h</Text> en adelante.
        </Text>
        <Text style={styles.muted}>
          En esta versión no se envían comandos de bloqueo al chip (sin escritura en páginas de
          lock, sin <Text style={styles.mono}>makeReadOnly</Text> ni{' '}
          <Text style={styles.mono}>NfcA.transceive</Text>).
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Estado</Text>
        <Text style={styles.muted}>
          Bloqueo irreversible: <Text style={styles.notAuthorized}>No autorizado aún</Text>
        </Text>
      </View>

      {blockedMessage ? (
        <View style={styles.blockedBox}>
          <Text style={styles.blockedText}>{blockedMessage}</Text>
        </View>
      ) : null}

      <PrimaryButton
        fullWidth
        label="Continuar"
        onPress={() => setConfirmVisible(true)}
        variant="danger"
      />

      <Modal
        animationType="fade"
        transparent
        visible={confirmVisible}
        onRequestClose={() => setConfirmVisible(false)}
      >
        <View style={styles.backdrop}>
          <View style={styles.card}>
            <Text style={styles.confirmTitle}>Confirmación final</Text>
            <Text style={styles.body}>
              Estás a punto de solicitar un bloqueo permanente (solo lectura). En producción esto
              modificaría bits de lock en el NTAG213 y no tiene deshacer.
            </Text>
            <Text style={styles.confirmNote}>
              La función real de bloqueo no está habilitada en esta compilación.
            </Text>
            <View style={styles.actions}>
              <PrimaryButton
                fullWidth
                label="Cancelar"
                onPress={() => setConfirmVisible(false)}
                variant="secondary"
              />
              <PrimaryButton
                fullWidth
                disabled
                label="Bloquear permanentemente (No autorizado aún)"
                onPress={handleSecondConfirm}
                variant="danger"
              />
              <PrimaryButton
                fullWidth
                label="Continuar"
                onPress={handleSecondConfirm}
                variant="primary"
              />
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scroll: {
    padding: 20,
    gap: 16,
    paddingBottom: 32,
  },
  warningBox: {
    backgroundColor: colors.surface,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: colors.danger,
    padding: 16,
    gap: 8,
  },
  warningTitle: {
    color: colors.danger,
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  warningBody: {
    color: colors.ink,
    fontSize: 16,
    lineHeight: 24,
  },
  emphasis: {
    fontWeight: '700',
    color: colors.danger,
  },
  section: {
    gap: 8,
  },
  sectionTitle: {
    color: colors.ink,
    fontSize: 15,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  body: {
    color: colors.ink,
    fontSize: 15,
    lineHeight: 22,
  },
  muted: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 21,
  },
  mono: {
    fontFamily: 'monospace',
    fontWeight: '600',
  },
  notAuthorized: {
    color: colors.danger,
    fontWeight: '700',
  },
  blockedBox: {
    backgroundColor: colors.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
  },
  blockedText: {
    color: colors.ink,
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
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
    gap: 12,
  },
  confirmTitle: {
    color: colors.ink,
    fontSize: 18,
    fontWeight: '700',
  },
  confirmNote: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 20,
    fontStyle: 'italic',
  },
  actions: {
    gap: 10,
    marginTop: 4,
  },
});
