export type NfcUiStatus =
  | 'IDLE'
  | 'WAITING'
  | 'DETECTED'
  | 'READING'
  | 'WRITING'
  | 'VERIFYING'
  | 'COMPLETED'
  | 'ERROR';

export type NdefRecordType = 'URI' | 'TEXT' | 'EMPTY' | 'UNKNOWN';

export interface NdefRecordSummary {
  type: NdefRecordType;
  content: string;
}

export interface TagReadResult {
  uid: string | null;
  records: NdefRecordSummary[];
  content: string;
  isEmpty: boolean;
  isWritable: boolean | null;
  maxSize: number | null;
}

export interface WriteVerifyResult {
  uid: string | null;
  writtenContent: string;
  readBackContent: string;
  verified: boolean;
  detected: boolean;
  written: boolean;
}

export type NfcServiceErrorCode =
  | 'NFC_UNAVAILABLE'
  | 'NFC_DISABLED'
  | 'SESSION_CANCELLED'
  | 'TAG_NOT_WRITABLE'
  | 'WRITE_FAILED'
  | 'VERIFY_MISMATCH'
  | 'UNSUPPORTED_TAG'
  | 'UNKNOWN';

export class NfcServiceError extends Error {
  code: NfcServiceErrorCode;
  constructor(code: NfcServiceErrorCode, message: string) {
    super(message);
    this.code = code;
    this.name = 'NfcServiceError';
  }
}
