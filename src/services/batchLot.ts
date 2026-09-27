import type { BatchLot } from '../types/history';
import { buildUri, generateUniqueCodes } from './idService';

function generateLotId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function createLot(baseUrl: string, quantity: number, reserved: Set<string>): BatchLot {
  const trimmedBase = baseUrl.trim();
  const codes = generateUniqueCodes(quantity, reserved);
  const items = codes.map((code) => ({
    code,
    uri: buildUri(trimmedBase, code),
    status: 'pending' as const,
  }));

  return {
    id: generateLotId(),
    baseUrl: trimmedBase,
    quantity,
    items,
    createdAt: new Date().toISOString(),
    completedAt: null,
  };
}

export function countLotOutcomes(lot: BatchLot): {
  success: number;
  skipped: number;
  pending: number;
} {
  let success = 0;
  let skipped = 0;
  let pending = 0;
  for (const item of lot.items) {
    if (item.status === 'used') {
      success += 1;
    } else if (item.status === 'skipped_reserved') {
      skipped += 1;
    } else {
      pending += 1;
    }
  }
  return { success, skipped, pending };
}

export function isLotFinished(lot: BatchLot): boolean {
  return lot.items.every((item) => item.status !== 'pending');
}
