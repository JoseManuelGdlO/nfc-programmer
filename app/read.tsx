import { useCallback, useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { NfcStatusBanner } from '@/components/NfcStatusBanner';
import { PrimaryButton } from '@/components/PrimaryButton';
import { useNfcOperation } from '@/hooks/useNfcOperation';
import { cancel, ensureNfcReady, init, readTag } from '@/services/nfcService';
import { colors } from '@/theme/colors';
import type { NdefRecordSummary, TagReadResult } from '@/types/nfc';

function formatWritable(isWritable: boolean | null): string {
  if (isWritable === true) {
    return 'sí';
  }
  if (isWritable === false) {
    return 'no';
  }
  return 'desconocido';
}

function formatCapacity(maxSize: number | null): string {
  if (maxSize == null) {
    return '—';
  }
  return `${maxSize} bytes`;
}

function formatRecordTypes(records: NdefRecordSummary[]): string {
  if (records.length === 0) {
    return '—';
  }
  return records.map((record) => record.type).join(', ');
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

export default function ReadScreen() {
  const { status, error, run } = useNfcOperation();
  const [result, setResult] = useState<TagReadResult | null>(null);
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

  const handleRead = () => {
    void run(async ({ setStatus }) => {
      await ensureInit();
      const data = await readTag(() => {
        setStatus('DETECTED');
        setStatus('READING');
      });
      setResult(data);
      setStatus('COMPLETED');
    });
  };

  return (
    <View style={styles.container}>
      <NfcStatusBanner status={status} message={error ?? undefined} />

      <PrimaryButton
        label="Leer NFC"
        fullWidth
        disabled={busy}
        onPress={handleRead}
      />

      {result && status === 'COMPLETED' ? (
        <ScrollView style={styles.results} contentContainerStyle={styles.resultsContent}>
          <FieldRow label="UID" value={result.uid ?? '—'} />
          <FieldRow label="Tipo de registro" value={formatRecordTypes(result.records)} />
          <FieldRow
            label="Contenido"
            value={result.content.length > 0 ? result.content : '—'}
          />
          <FieldRow label="Vacío" value={result.isEmpty ? 'sí' : 'no'} />
          <FieldRow label="Escritura" value={formatWritable(result.isWritable)} />
          <FieldRow label="Capacidad" value={formatCapacity(result.maxSize)} />
        </ScrollView>
      ) : null}
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
  results: {
    flex: 1,
  },
  resultsContent: {
    gap: 12,
    paddingBottom: 16,
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
