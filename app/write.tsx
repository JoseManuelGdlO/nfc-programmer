import { useCallback, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { ConfirmOverwriteModal } from '@/components/ConfirmOverwriteModal';
import { NfcStatusBanner } from '@/components/NfcStatusBanner';
import { PrimaryButton } from '@/components/PrimaryButton';
import { useNfcOperation } from '@/hooks/useNfcOperation';
import { init, readTag, writeUriAndVerify } from '@/services/nfcService';
import { appendHistory } from '@/services/storageService';
import { colors } from '@/theme/colors';
import type { WriteVerifyResult } from '@/types/nfc';

function ChecklistRow({ ok, label }: { ok: boolean; label: string }) {
  return (
    <Text style={styles.checkItem}>
      <Text style={ok ? styles.checkOk : styles.checkFail}>{ok ? '✓' : '✗'}</Text>
      {' '}
      {label}
    </Text>
  );
}

function FieldRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text style={styles.fieldValue} selectable>
        {value}
      </Text>
    </View>
  );
}

export default function WriteScreen() {
  const { status, error, run } = useNfcOperation();
  const [uri, setUri] = useState('');
  const [result, setResult] = useState<WriteVerifyResult | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [overwriteContent, setOverwriteContent] = useState('');
  const overwriteResolverRef = useRef<((confirmed: boolean) => void) | null>(null);
  const initDone = useRef(false);

  const ensureInit = useCallback(async () => {
    if (!initDone.current) {
      await init();
      initDone.current = true;
    }
  }, []);

  const busy =
    status === 'WAITING' ||
    status === 'DETECTED' ||
    status === 'READING' ||
    status === 'WRITING' ||
    status === 'VERIFYING';

  const trimmedUri = uri.trim();
  const canSubmit = trimmedUri.length > 0 && !busy;

  const resolveOverwrite = (confirmed: boolean) => {
    setModalVisible(false);
    overwriteResolverRef.current?.(confirmed);
    overwriteResolverRef.current = null;
  };

  const askOverwrite = (existing: string) =>
    new Promise<boolean>((resolve) => {
      setOverwriteContent(existing);
      setModalVisible(true);
      overwriteResolverRef.current = resolve;
    });

  const handleWrite = () => {
    if (!canSubmit) {
      return;
    }

    void run(async ({ setStatus }) => {
      setResult(null);
      await ensureInit();

      const probe = await readTag(() => {
        setStatus('DETECTED');
        setStatus('READING');
      });

      let allowOverwrite = false;
      if (!probe.isEmpty) {
        const confirmed = await askOverwrite(probe.content);
        if (!confirmed) {
          setStatus('IDLE');
          return;
        }
        allowOverwrite = true;
      }

      setStatus('WAITING');
      const writeResult = await writeUriAndVerify(trimmedUri, {
        onDetected: () => setStatus('DETECTED'),
        onWriting: () => setStatus('WRITING'),
        onVerifying: () => setStatus('VERIFYING'),
        allowOverwrite,
      });

      await appendHistory({
        uid: writeResult.uid,
        content: trimmedUri,
        operation: 'WRITE',
        verified: writeResult.verified,
      });

      setResult(writeResult);
      setStatus('COMPLETED');
    });
  };

  return (
    <View style={styles.container}>
      <NfcStatusBanner status={status} message={error ?? undefined} />

      <TextInput
        style={styles.input}
        value={uri}
        onChangeText={setUri}
        placeholder="https://midominio.com/nfc/"
        placeholderTextColor={colors.muted}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="url"
        editable={!busy}
      />

      <PrimaryButton
        label="GRABAR NFC"
        fullWidth
        disabled={!canSubmit}
        onPress={handleWrite}
      />

      {result && status === 'COMPLETED' ? (
        <ScrollView style={styles.results} contentContainerStyle={styles.resultsContent}>
          <View style={styles.checklist}>
            <ChecklistRow ok={result.detected} label="NFC detectado" />
            <ChecklistRow ok={result.written} label="Escritura completada" />
            <ChecklistRow ok={result.verified} label="Contenido verificado" />
          </View>
          <FieldRow label="UID" value={result.uid ?? '—'} />
          <FieldRow label="Contenido" value={result.writtenContent} />
        </ScrollView>
      ) : null}

      <ConfirmOverwriteModal
        visible={modalVisible}
        content={overwriteContent}
        onConfirm={() => resolveOverwrite(true)}
        onCancel={() => resolveOverwrite(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 24,
    gap: 16,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 6,
    backgroundColor: colors.surface,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: colors.ink,
  },
  results: {
    flex: 1,
  },
  resultsContent: {
    gap: 12,
    paddingBottom: 16,
  },
  checklist: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 6,
    backgroundColor: colors.surface,
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  checkItem: {
    fontSize: 16,
    color: colors.ink,
    fontWeight: '500',
  },
  checkOk: {
    color: colors.success,
    fontWeight: '700',
  },
  checkFail: {
    color: colors.danger,
    fontWeight: '700',
  },
  field: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 6,
    backgroundColor: colors.surface,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  fieldLabel: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  fieldValue: {
    color: colors.ink,
    fontSize: 16,
    fontWeight: '500',
  },
});
