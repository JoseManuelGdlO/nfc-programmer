import { useCallback, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';

import { listHistory } from '@/services/storageService';
import { colors } from '@/theme/colors';
import type { HistoryOperation, ProductionRecord } from '@/types/history';

const OPERATION_LABEL: Record<HistoryOperation, string> = {
  WRITE: 'Grabación',
  REWRITE: 'Reescritura',
  LOCK: 'Bloqueo',
};

function formatDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return iso;
  }
  return date.toLocaleString('es-ES', {
    dateStyle: 'short',
    timeStyle: 'short',
  });
}

function VerifiedBadge({ verified }: { verified: boolean }) {
  return (
    <View style={[styles.badge, verified ? styles.badgeVerified : styles.badgeUnverified]}>
      <Text style={[styles.badgeText, verified ? styles.badgeTextVerified : styles.badgeTextUnverified]}>
        {verified ? 'Verificado' : 'Sin verificar'}
      </Text>
    </View>
  );
}

function HistoryRow({ item }: { item: ProductionRecord }) {
  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.operation}>{OPERATION_LABEL[item.operation]}</Text>
        <VerifiedBadge verified={item.verified} />
      </View>
      <View style={styles.field}>
        <Text style={styles.fieldLabel}>UID</Text>
        <Text style={styles.fieldValue} selectable>
          {item.uid ?? '—'}
        </Text>
      </View>
      <View style={styles.field}>
        <Text style={styles.fieldLabel}>Contenido</Text>
        <Text style={styles.fieldValue} selectable>
          {item.content}
        </Text>
      </View>
      <View style={styles.field}>
        <Text style={styles.fieldLabel}>Fecha</Text>
        <Text style={styles.fieldValue}>{formatDate(item.createdAt)}</Text>
      </View>
    </View>
  );
}

export default function HistoryScreen() {
  const [records, setRecords] = useState<ProductionRecord[]>([]);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      void listHistory().then((items) => {
        if (active) {
          setRecords(items);
        }
      });
      return () => {
        active = false;
      };
    }, []),
  );

  return (
    <FlatList
      style={styles.list}
      contentContainerStyle={records.length === 0 ? styles.emptyContainer : styles.listContent}
      data={records}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => <HistoryRow item={item} />}
      ItemSeparatorComponent={() => <View style={styles.separator} />}
      ListEmptyComponent={<Text style={styles.emptyText}>Sin registros aún</Text>}
    />
  );
}

const styles = StyleSheet.create({
  list: {
    flex: 1,
    backgroundColor: colors.background,
  },
  listContent: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 24,
  },
  separator: {
    height: 12,
  },
  emptyContainer: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  emptyText: {
    color: colors.muted,
    fontSize: 16,
    fontWeight: '500',
  },
  card: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 6,
    backgroundColor: colors.surface,
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 10,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  operation: {
    color: colors.ink,
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 0.3,
    flex: 1,
  },
  badge: {
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
  },
  badgeVerified: {
    backgroundColor: '#E6F4ED',
    borderColor: colors.success,
  },
  badgeUnverified: {
    backgroundColor: colors.background,
    borderColor: colors.border,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  badgeTextVerified: {
    color: colors.success,
  },
  badgeTextUnverified: {
    color: colors.muted,
  },
  field: {
    gap: 4,
  },
  fieldLabel: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  fieldValue: {
    color: colors.ink,
    fontSize: 15,
    fontWeight: '500',
  },
});
