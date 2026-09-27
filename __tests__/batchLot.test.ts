import { buildUri } from '../src/services/idService';
import { createLot, countLotOutcomes, isLotFinished } from '../src/services/batchLot';
import type { BatchLot } from '../src/types/history';

describe('createLot', () => {
  test('builds pending items with unique codes and URIs', () => {
    const reserved = new Set(['TAKEN1']);
    const lot = createLot('https://midominio.com/nfc/', 3, reserved);

    expect(lot.quantity).toBe(3);
    expect(lot.items).toHaveLength(3);
    expect(lot.completedAt).toBeNull();
    expect(lot.baseUrl).toBe('https://midominio.com/nfc/');

    const codes = lot.items.map((item) => item.code);
    expect(new Set(codes).size).toBe(3);
    expect(codes).not.toContain('TAKEN1');

    for (const item of lot.items) {
      expect(item.status).toBe('pending');
      expect(item.uri).toBe(buildUri('https://midominio.com/nfc/', item.code));
    }
  });
});

describe('countLotOutcomes', () => {
  const lot: BatchLot = {
    id: 'lot-1',
    baseUrl: 'https://example.com/',
    quantity: 4,
    createdAt: '2026-01-01T00:00:00.000Z',
    completedAt: null,
    items: [
      { code: 'A', uri: 'https://example.com/A', status: 'used' },
      { code: 'B', uri: 'https://example.com/B', status: 'used' },
      { code: 'C', uri: 'https://example.com/C', status: 'skipped_reserved' },
      { code: 'D', uri: 'https://example.com/D', status: 'pending' },
    ],
  };

  test('counts success, skipped, and pending', () => {
    expect(countLotOutcomes(lot)).toEqual({ success: 2, skipped: 1, pending: 1 });
  });

  test('isLotFinished when no pending items', () => {
    expect(isLotFinished(lot)).toBe(false);
    const done: BatchLot = {
      ...lot,
      items: lot.items.map((item) =>
        item.status === 'pending' ? { ...item, status: 'skipped_reserved' } : item,
      ),
    };
    expect(isLotFinished(done)).toBe(true);
  });
});
