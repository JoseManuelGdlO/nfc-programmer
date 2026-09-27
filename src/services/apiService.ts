import type { ProductionRecord } from '../types/history';

export const apiService = {
  async listHistory(): Promise<ProductionRecord[]> {
    throw new Error('API REST no configurada todavía');
  },
  async appendHistory(
    _input: Omit<ProductionRecord, 'id' | 'createdAt'>,
  ): Promise<ProductionRecord> {
    throw new Error('API REST no configurada todavía');
  },
};
