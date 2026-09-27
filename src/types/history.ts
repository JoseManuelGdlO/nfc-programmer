export type HistoryOperation = 'WRITE' | 'REWRITE' | 'LOCK';

export interface ProductionRecord {
  id: string;
  uid: string | null;
  content: string;
  operation: HistoryOperation;
  createdAt: string;
  verified: boolean;
}

export type BatchItemStatus = 'pending' | 'used' | 'skipped_reserved';

export interface BatchLotItem {
  code: string;
  uri: string;
  status: BatchItemStatus;
}

export interface BatchLot {
  id: string;
  baseUrl: string;
  quantity: number;
  items: BatchLotItem[];
  createdAt: string;
  completedAt: string | null;
}
