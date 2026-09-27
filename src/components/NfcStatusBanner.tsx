import { StyleSheet, Text, View } from 'react-native';

import { colors } from '../theme/colors';
import type { NfcUiStatus } from '../types/nfc';

const LABELS: Record<NfcUiStatus, string> = {
  IDLE: 'Listo',
  WAITING: 'Esperando NFC...',
  DETECTED: 'NFC detectado',
  READING: 'Leyendo...',
  WRITING: 'Escribiendo...',
  VERIFYING: 'Verificando...',
  COMPLETED: 'Completado',
  ERROR: 'Error',
};

function bannerColors(status: NfcUiStatus): { background: string; foreground: string } {
  switch (status) {
    case 'COMPLETED':
      return { background: colors.success, foreground: colors.surface };
    case 'ERROR':
      return { background: colors.danger, foreground: colors.surface };
    case 'WAITING':
    case 'DETECTED':
    case 'READING':
    case 'WRITING':
    case 'VERIFYING':
      return { background: colors.waiting, foreground: colors.surface };
    case 'IDLE':
    default:
      return { background: colors.surface, foreground: colors.ink };
  }
}

type Props = {
  status: NfcUiStatus;
  message?: string;
};

export function NfcStatusBanner({ status, message }: Props) {
  const palette = bannerColors(status);
  const detail = message ?? (status === 'ERROR' ? undefined : null);

  return (
    <View style={[styles.banner, { backgroundColor: palette.background, borderColor: colors.border }]}>
      <Text style={[styles.label, { color: palette.foreground }]}>{LABELS[status]}</Text>
      {detail ? (
        <Text style={[styles.message, { color: palette.foreground }]}>{detail}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 16,
    paddingVertical: 12,
    minHeight: 48,
    justifyContent: 'center',
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
  },
  message: {
    fontSize: 14,
    marginTop: 4,
    fontWeight: '400',
  },
});
