import AsyncStorage from '@react-native-async-storage/async-storage';
import type { BatchLot, ProductionRecord } from '../types/history';

const HISTORY_KEY = '@nfc/history';
const BATCH_LOTS_KEY = '@nfc/batchLots';

function generateId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function codeFromContentUrl(content: string): string {
  const withoutTrailing = content.replace(/\/$/, '');
  const slash = withoutTrailing.lastIndexOf('/');
  return slash >= 0 ? withoutTrailing.slice(slash + 1) : withoutTrailing;
}

async function readJson<T>(key: string, fallback: T): Promise<T> {
  const raw = await AsyncStorage.getItem(key);
  if (raw == null) {
    return fallback;
  }
  return JSON.parse(raw) as T;
}

async function writeJson<T>(key: string, value: T): Promise<void> {
  await AsyncStorage.setItem(key, JSON.stringify(value));
}

export async function listHistory(): Promise<ProductionRecord[]> {
  return readJson(HISTORY_KEY, []);
}

export async function appendHistory(
  record: Omit<ProductionRecord, 'id' | 'createdAt'> & {
    id?: string;
    createdAt?: string;
  },
): Promise<ProductionRecord> {
  const full: ProductionRecord = {
    ...record,
    id: record.id ?? generateId(),
    createdAt: record.createdAt ?? new Date().toISOString(),
  };
  const history = await listHistory();
  history.unshift(full);
  await writeJson(HISTORY_KEY, history);
  return full;
}

export async function getReservedCodes(): Promise<Set<string>> {
  const codes = new Set<string>();
  const history = await listHistory();
  for (const entry of history) {
    codes.add(codeFromContentUrl(entry.content));
  }
  const lots = await listBatchLots();
  for (const lot of lots) {
    for (const item of lot.items) {
      codes.add(item.code);
    }
  }
  return codes;
}

export async function listBatchLots(): Promise<BatchLot[]> {
  return readJson(BATCH_LOTS_KEY, []);
}

export async function saveBatchLot(lot: BatchLot): Promise<void> {
  const lots = await listBatchLots();
  lots.push(lot);
  await writeJson(BATCH_LOTS_KEY, lots);
}

export async function updateBatchLot(lot: BatchLot): Promise<void> {
  const lots = await listBatchLots();
  const index = lots.findIndex((existing) => existing.id === lot.id);
  if (index === -1) {
    throw new Error(`Batch lot not found: ${lot.id}`);
  }
  lots[index] = lot;
  await writeJson(BATCH_LOTS_KEY, lots);
}
