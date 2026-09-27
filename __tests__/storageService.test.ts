import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  appendHistory,
  getReservedCodes,
  listBatchLots,
  listHistory,
  saveBatchLot,
  updateBatchLot,
} from '../src/services/storageService';
import type { BatchLot } from '../src/types/history';
import { buildUri } from '../src/services/idService';

beforeEach(async () => {
  await AsyncStorage.clear();
});

describe('history', () => {
  test('append then list returns newest first', async () => {
    const older = await appendHistory({
      uid: '04A1B2C3',
      content: 'https://midominio.com/nfc/OLD111',
      operation: 'WRITE',
      verified: true,
      createdAt: '2026-01-01T00:00:00.000Z',
      id: 'hist-old',
    });
    const newer = await appendHistory({
      uid: '04A1B2C4',
      content: 'https://midominio.com/nfc/NEW222',
      operation: 'REWRITE',
      verified: false,
      createdAt: '2026-01-02T00:00:00.000Z',
      id: 'hist-new',
    });

    const list = await listHistory();
    expect(list.map((r) => r.id)).toEqual([newer.id, older.id]);
  });

  test('appendHistory generates id and createdAt when omitted', async () => {
    const record = await appendHistory({
      uid: null,
      content: 'https://midominio.com/nfc/GEN999',
      operation: 'LOCK',
      verified: true,
    });
    expect(record.id).toBeTruthy();
    expect(record.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);

    const [stored] = await listHistory();
    expect(stored).toEqual(record);
  });
});

describe('getReservedCodes', () => {
  test('includes history URI suffixes and all batch item statuses', async () => {
    await appendHistory({
      uid: 'uid-h',
      content: buildUri('https://midominio.com/nfc/', 'HIST01'),
      operation: 'WRITE',
      verified: true,
      id: 'h1',
      createdAt: '2026-01-01T00:00:00.000Z',
    });

    const lot: BatchLot = {
      id: 'lot-1',
      baseUrl: 'https://midominio.com/nfc/',
      quantity: 3,
      createdAt: '2026-01-01T00:00:00.000Z',
      completedAt: null,
      items: [
        {
          code: 'PEND01',
          uri: buildUri('https://midominio.com/nfc/', 'PEND01'),
          status: 'pending',
        },
        {
          code: 'USED01',
          uri: buildUri('https://midominio.com/nfc/', 'USED01'),
          status: 'used',
        },
        {
          code: 'SKIP01',
          uri: buildUri('https://midominio.com/nfc/', 'SKIP01'),
          status: 'skipped_reserved',
        },
      ],
    };
    await saveBatchLot(lot);

    const reserved = await getReservedCodes();
    expect(reserved).toEqual(new Set(['HIST01', 'PEND01', 'USED01', 'SKIP01']));
  });
});

describe('batch lots', () => {
  const sampleLot = (): BatchLot => ({
    id: 'lot-a',
    baseUrl: 'https://midominio.com/nfc/',
    quantity: 2,
    createdAt: '2026-01-01T00:00:00.000Z',
    completedAt: null,
    items: [
      {
        code: 'LOT001',
        uri: buildUri('https://midominio.com/nfc/', 'LOT001'),
        status: 'pending',
      },
      {
        code: 'LOT002',
        uri: buildUri('https://midominio.com/nfc/', 'LOT002'),
        status: 'pending',
      },
    ],
  });

  test('saveBatchLot then listBatchLots', async () => {
    const lot = sampleLot();
    await saveBatchLot(lot);
    expect(await listBatchLots()).toEqual([lot]);
  });

  test('updateBatchLot replaces existing lot by id', async () => {
    await saveBatchLot(sampleLot());
    const updated: BatchLot = {
      ...sampleLot(),
      completedAt: '2026-01-02T00:00:00.000Z',
      items: [
        {
          code: 'LOT001',
          uri: buildUri('https://midominio.com/nfc/', 'LOT001'),
          status: 'used',
        },
        {
          code: 'LOT002',
          uri: buildUri('https://midominio.com/nfc/', 'LOT002'),
          status: 'skipped_reserved',
        },
      ],
    };
    await updateBatchLot(updated);

    const lots = await listBatchLots();
    expect(lots).toHaveLength(1);
    expect(lots[0]).toEqual(updated);
  });
});
