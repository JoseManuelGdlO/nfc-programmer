import { useCallback, useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { ConfirmOverwriteModal } from '@/components/ConfirmOverwriteModal';
import { NfcStatusBanner } from '@/components/NfcStatusBanner';
import { PrimaryButton } from '@/components/PrimaryButton';
import { useNfcOperation } from '@/hooks/useNfcOperation';
import { countLotOutcomes, createLot, isLotFinished } from '@/services/batchLot';
import { init, readTag, writeUriAndVerify } from '@/services/nfcService';
import {
  appendHistory,
  getReservedCodes,
  saveBatchLot,
  updateBatchLot,
} from '@/services/storageService';
import { colors } from '@/theme/colors';
import type { BatchLot } from '@/types/history';

type BatchPhase = 'setup' | 'running' | 'summary';

export default function BatchScreen() {
  const { status, error, setStatus, run, reset } = useNfcOperation();
  const [baseUrl, setBaseUrl] = useState('https://midominio.com/nfc/');
  const [quantityText, setQuantityText] = useState('10');
  const [lot, setLot] = useState<BatchLot | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [phase, setPhase] = useState<BatchPhase>('setup');
  const [showFailureActions, setShowFailureActions] = useState(false);

  const [modalVisible, setModalVisible] = useState(false);
  const [overwriteContent, setOverwriteContent] = useState('');
  const overwriteResolverRef = useRef<((confirmed: boolean) => void) | null>(null);
  const initDone = useRef(false);
  const lotRef = useRef<BatchLot | null>(null);
  const indexRef = useRef(0);

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

  const trimmedBase = baseUrl.trim();
  const quantity = Number.parseInt(quantityText, 10);
  const validQuantity = Number.isFinite(quantity) && quantity > 0;
  const canStart = trimmedBase.length > 0 && validQuantity && phase === 'setup' && !busy;

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

  const finishIfDone = useCallback(async (updatedLot: BatchLot) => {
    if (!isLotFinished(updatedLot)) {
      return false;
    }
    const completed: BatchLot = {
      ...updatedLot,
      completedAt: new Date().toISOString(),
    };
    await updateBatchLot(completed);
    lotRef.current = completed;
    setLot(completed);
    setPhase('summary');
    setShowFailureActions(false);
    setStatus('COMPLETED');
    return true;
  }, [setStatus]);

  useEffect(() => {
    if (phase === 'running' && status === 'ERROR') {
      setShowFailureActions(true);
    }
  }, [phase, status]);

  const programCurrentTag = useCallback(() => {
    const activeLot = lotRef.current;
    if (!activeLot) {
      return;
    }

    const index = indexRef.current;
    const item = activeLot.items[index];
    if (!item || item.status !== 'pending') {
      return;
    }

    setShowFailureActions(false);
    reset();

    void run(async ({ setStatus: setOpStatus }) => {
      await ensureInit();

      const probe = await readTag(() => {
        setOpStatus('DETECTED');
        setOpStatus('READING');
      });

      let allowOverwrite = false;
      if (!probe.isEmpty) {
        const confirmed = await askOverwrite(probe.content);
        if (!confirmed) {
          setOpStatus('IDLE');
          void programCurrentTag();
          return;
        }
        allowOverwrite = true;
      }

      setOpStatus('WAITING');
      const writeResult = await writeUriAndVerify(item.uri, {
        onDetected: () => setOpStatus('DETECTED'),
        onWriting: () => setOpStatus('WRITING'),
        onVerifying: () => setOpStatus('VERIFYING'),
        allowOverwrite,
      });

      await appendHistory({
        uid: writeResult.uid,
        content: item.uri,
        operation: 'WRITE',
        verified: writeResult.verified,
      });

      const nextItems = activeLot.items.map((entry, i) =>
        i === index ? { ...entry, status: 'used' as const } : entry,
      );
      const updatedLot: BatchLot = { ...activeLot, items: nextItems };
      await updateBatchLot(updatedLot);
      lotRef.current = updatedLot;
      setLot(updatedLot);

      const finished = await finishIfDone(updatedLot);
      if (finished) {
        return;
      }

      const nextIndex = index + 1;
      indexRef.current = nextIndex;
      setCurrentIndex(nextIndex);
      setOpStatus('COMPLETED');
      void programCurrentTag();
    });
  }, [ensureInit, finishIfDone, reset, run]);

  const handleStart = async () => {
    if (!canStart) {
      return;
    }

    const reserved = await getReservedCodes();
    const newLot = createLot(trimmedBase, quantity, reserved);
    await saveBatchLot(newLot);

    lotRef.current = newLot;
    setLot(newLot);
    indexRef.current = 0;
    setCurrentIndex(0);
    setPhase('running');
    setShowFailureActions(false);
    programCurrentTag();
  };

  const handleRetry = () => {
    setShowFailureActions(false);
    reset();
    programCurrentTag();
  };

  const handleSkip = async () => {
    const activeLot = lotRef.current;
    if (!activeLot) {
      return;
    }

    const index = indexRef.current;
    const nextItems = activeLot.items.map((entry, i) =>
      i === index ? { ...entry, status: 'skipped_reserved' as const } : entry,
    );
    const updatedLot: BatchLot = { ...activeLot, items: nextItems };
    await updateBatchLot(updatedLot);
    lotRef.current = updatedLot;
    setLot(updatedLot);
    setShowFailureActions(false);
    reset();

    const finished = await finishIfDone(updatedLot);
    if (finished) {
      return;
    }

    const nextIndex = index + 1;
    indexRef.current = nextIndex;
    setCurrentIndex(nextIndex);
    programCurrentTag();
  };

  const handleAbort = async () => {
    const activeLot = lotRef.current;
    if (!activeLot) {
      return;
    }

    const aborted: BatchLot = {
      ...activeLot,
      completedAt: new Date().toISOString(),
    };
    await updateBatchLot(aborted);
    lotRef.current = aborted;
    setLot(aborted);
    setPhase('summary');
    setShowFailureActions(false);
    reset();
  };

  const handleNewSeries = () => {
    lotRef.current = null;
    setLot(null);
    indexRef.current = 0;
    setCurrentIndex(0);
    setPhase('setup');
    setShowFailureActions(false);
    reset();
  };

  const tagNumber = currentIndex + 1;
  const totalTags = lot?.quantity ?? 0;
  const outcomes = lot ? countLotOutcomes(lot) : null;

  return (
    <View style={styles.container}>
      <NfcStatusBanner status={status} message={error ?? undefined} />

      {phase === 'setup' ? (
        <>
          <Text style={styles.heading}>Grabación en serie</Text>
          <Text style={styles.hint}>URL base y cantidad de etiquetas</Text>

          <TextInput
            style={styles.input}
            value={baseUrl}
            onChangeText={setBaseUrl}
            placeholder="https://midominio.com/nfc/"
            placeholderTextColor={colors.muted}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            editable={!busy}
          />

          <TextInput
            style={styles.input}
            value={quantityText}
            onChangeText={setQuantityText}
            placeholder="Cantidad"
            placeholderTextColor={colors.muted}
            keyboardType="number-pad"
            editable={!busy}
          />

          <PrimaryButton
            label="INICIAR SERIE"
            fullWidth
            disabled={!canStart}
            onPress={() => void handleStart()}
          />
        </>
      ) : null}

      {phase === 'running' && lot ? (
        <View style={styles.progressCard}>
          <Text style={styles.tagProgress}>
            TAG {tagNumber} / {totalTags}
          </Text>
          <Text style={styles.uriPreview} selectable>
            {lot.items[currentIndex]?.uri ?? '—'}
          </Text>
          <Text style={styles.waitingHint}>Acerca el NFC</Text>
        </View>
      ) : null}

      {showFailureActions && phase === 'running' ? (
        <View style={styles.failureActions}>
          <PrimaryButton label="REINTENTAR" fullWidth onPress={handleRetry} />
          <PrimaryButton
            label="SALTAR"
            variant="secondary"
            fullWidth
            onPress={() => void handleSkip()}
          />
          <PrimaryButton
            label="ABORTAR"
            variant="danger"
            fullWidth
            onPress={() => void handleAbort()}
          />
        </View>
      ) : null}

      {phase === 'summary' && lot && outcomes ? (
        <ScrollView style={styles.summary} contentContainerStyle={styles.summaryContent}>
          <Text style={styles.heading}>Resumen del lote</Text>
          <Text style={styles.summaryLine}>Exitosas: {outcomes.success}</Text>
          <Text style={styles.summaryLine}>Omitidas (reservadas): {outcomes.skipped}</Text>
          <Text style={styles.summaryLine}>Pendientes / canceladas: {outcomes.pending}</Text>
          <PrimaryButton label="NUEVA SERIE" fullWidth onPress={handleNewSeries} />
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
  heading: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.ink,
  },
  hint: {
    fontSize: 14,
    color: colors.muted,
    marginTop: -8,
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
  progressCard: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 6,
    backgroundColor: colors.surface,
    paddingHorizontal: 16,
    paddingVertical: 20,
    gap: 8,
    alignItems: 'center',
  },
  tagProgress: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.ink,
  },
  uriPreview: {
    fontSize: 14,
    color: colors.muted,
    textAlign: 'center',
  },
  waitingHint: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.accent,
    marginTop: 8,
  },
  failureActions: {
    gap: 12,
  },
  summary: {
    flex: 1,
  },
  summaryContent: {
    gap: 12,
    paddingBottom: 16,
  },
  summaryLine: {
    fontSize: 16,
    color: colors.ink,
    fontWeight: '500',
  },
});
