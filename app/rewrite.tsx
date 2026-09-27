import { useCallback, useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { ConfirmOverwriteModal } from '@/components/ConfirmOverwriteModal';
import { NfcStatusBanner } from '@/components/NfcStatusBanner';
import { PrimaryButton } from '@/components/PrimaryButton';
import { useNfcOperation } from '@/hooks/useNfcOperation';
import { cancel, ensureNfcReady, init, readTag, writeUriAndVerify } from '@/services/nfcService';
import { appendHistory } from '@/services/storageService';
import { colors } from '@/theme/colors';
import { NfcServiceError } from '@/types/nfc';
import type { TagReadResult, WriteVerifyResult } from '@/types/nfc';

function ChecklistRow({ ok, label }: { ok: boolean; label: string }) {
  return (
    <Text style={styles.checkItem}>
      <Text style={ok ? styles.checkOk : styles.checkFail}>{ok ? '✓' : '✗'}</Text>
      {' '}
      {label}
    </Text>
  );
}

function formatWritable(isWritable: boolean | null): string {
  if (isWritable === true) {
    return 'sí';
  }
  if (isWritable === false) {
    return 'no';
  }
  return 'desconocido';
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

export default function RewriteScreen() {
  const { status, error, run } = useNfcOperation();
  const [readResult, setReadResult] = useState<TagReadResult | null>(null);
  const [uri, setUri] = useState('');
  const [writeResult, setWriteResult] = useState<WriteVerifyResult | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [overwriteContent, setOverwriteContent] = useState('');
  const overwriteResolverRef = useRef<((confirmed: boolean) => void) | null>(null);
  const initDone = useRef(false);

  const ensureInit = useCallback(async () => {
    if (!initDone.current) {
      await init();
      initDone.current = true;
    }
    await ensureNfcReady();
  }, []);

  useEffect(() => {
    return () => {
      void cancel().catch(() => undefined);
    };
  }, []);

  const busy =
    status === 'WAITING' ||
    status === 'DETECTED' ||
    status === 'READING' ||
    status === 'WRITING' ||
    status === 'VERIFYING';

  const trimmedUri = uri.trim();
  const tagWritable = readResult?.isWritable !== false;
  const canRewrite =
    readResult != null &&
    tagWritable &&
    trimmedUri.length > 0 &&
    !busy &&
    status !== 'ERROR';

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

  const handleRead = () => {
    void run(async ({ setStatus }) => {
      setWriteResult(null);
      await ensureInit();
      const data = await readTag(() => {
        setStatus('DETECTED');
        setStatus('READING');
      });
      setReadResult(data);
      setStatus('COMPLETED');
    });
  };

  const handleRewrite = () => {
    if (!canRewrite) {
      return;
    }

    void run(async ({ setStatus }) => {
      setWriteResult(null);
      await ensureInit();

      const probe = await readTag(() => {
        setStatus('DETECTED');
        setStatus('READING');
      });

      if (probe.isWritable === false) {
        setReadResult(probe);
        throw new NfcServiceError('TAG_NOT_WRITABLE', 'Tag is not writable');
      }

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
      const result = await writeUriAndVerify(trimmedUri, {
        onDetected: () => setStatus('DETECTED'),
        onWriting: () => setStatus('WRITING'),
        onVerifying: () => setStatus('VERIFYING'),
        allowOverwrite,
        expectedPreviousContent: probe.content,
      });

      await appendHistory({
        uid: result.uid,
        content: trimmedUri,
        operation: 'REWRITE',
        verified: result.verified,
      });

      if (!result.verified) {
        setWriteResult(result);
        setReadResult(probe);
        throw new NfcServiceError(
          'VERIFY_MISMATCH',
          'Read-back URI does not match',
        );
      }

      setWriteResult(result);
      setReadResult(probe);
      setStatus('COMPLETED');
    });
  };

  const showReadPanel = readResult != null && writeResult == null && status !== 'ERROR';

  return (
    <View style={styles.container}>
      <NfcStatusBanner status={status} message={error ?? undefined} />

      <PrimaryButton
        label="Leer NFC"
        fullWidth
        disabled={busy}
        onPress={handleRead}
      />

      {showReadPanel ? (
        <ScrollView style={styles.results} contentContainerStyle={styles.resultsContent}>
          <FieldRow label="UID" value={readResult.uid ?? '—'} />
          <FieldRow
            label="Contenido actual"
            value={readResult.content.length > 0 ? readResult.content : '—'}
          />
          <FieldRow label="Escritura" value={formatWritable(readResult.isWritable)} />

          {readResult.isWritable === false ? (
            <Text style={styles.blocked}>
              No se puede reescribir: la etiqueta no permite escritura.
            </Text>
          ) : (
            <>
              <TextInput
                style={styles.input}
                value={uri}
                onChangeText={setUri}
                placeholder="Nueva URI (https://...)"
                placeholderTextColor={colors.muted}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
                editable={!busy}
              />
              <PrimaryButton
                label="REESCRIBIR NFC"
                fullWidth
                disabled={!canRewrite}
                onPress={handleRewrite}
              />
            </>
          )}
        </ScrollView>
      ) : null}

      {writeResult && status === 'COMPLETED' ? (
        <ScrollView style={styles.results} contentContainerStyle={styles.resultsContent}>
          <View style={styles.checklist}>
            <ChecklistRow ok={writeResult.detected} label="NFC detectado" />
            <ChecklistRow ok={writeResult.written} label="Escritura completada" />
            <ChecklistRow ok={writeResult.verified} label="Contenido verificado" />
          </View>
          <FieldRow label="UID" value={writeResult.uid ?? '—'} />
          <FieldRow label="Contenido" value={writeResult.writtenContent} />
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
  blocked: {
    color: colors.danger,
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 22,
  },
});
