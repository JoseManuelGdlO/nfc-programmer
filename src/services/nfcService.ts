import NfcManager, { Ndef, NfcTech } from 'react-native-nfc-manager';
import type { NdefRecord } from 'react-native-nfc-manager';
import type { NdefRecordSummary, TagReadResult, WriteVerifyResult } from '../types/nfc';
import { NfcServiceError } from '../types/nfc';

export function formatUid(id: unknown): string | null {
  if (id == null) {
    return null;
  }
  if (Array.isArray(id) || id instanceof Uint8Array) {
    return Array.from(id as ArrayLike<number>)
      .map((byte) => byte.toString(16).padStart(2, '0').toUpperCase())
      .join(':');
  }
  if (typeof id === 'string') {
    const hex = id.replace(/[^0-9a-fA-F]/g, '');
    if (!hex) {
      return null;
    }
    return hex
      .match(/.{1,2}/g)!
      .map((pair) => pair.toUpperCase())
      .join(':');
  }
  return null;
}

function payloadBytes(payload: NdefRecord['payload']): number[] {
  if (Array.isArray(payload)) {
    return payload;
  }
  if (payload != null && typeof payload === 'object' && 'length' in payload) {
    return Array.from(payload as ArrayLike<number>);
  }
  return [];
}

function summarizeRecord(record: NdefRecord): NdefRecordSummary {
  if (record.tnf === Ndef.TNF_EMPTY) {
    return { type: 'EMPTY', content: '' };
  }
  if (Ndef.isType(record, Ndef.TNF_WELL_KNOWN, Ndef.RTD_URI)) {
    const content = Ndef.uri.decodePayload(new Uint8Array(payloadBytes(record.payload)));
    return { type: 'URI', content };
  }
  if (Ndef.isType(record, Ndef.TNF_WELL_KNOWN, Ndef.RTD_TEXT)) {
    const content = Ndef.text.decodePayload(new Uint8Array(payloadBytes(record.payload)));
    return { type: 'TEXT', content };
  }
  return { type: 'UNKNOWN', content: '' };
}

export function summarizeNdefMessage(records: NdefRecord[]): {
  records: NdefRecordSummary[];
  content: string;
  isEmpty: boolean;
} {
  const summaries = records.map(summarizeRecord);
  const meaningful = summaries
    .map((r) => r.content)
    .filter((text) => text.length > 0);
  const content = meaningful.join('\n');
  // Blank decoded text is still a real record. Only a missing message or TNF EMPTY is empty.
  const isEmpty =
    records.length === 0 || summaries.every((record) => record.type === 'EMPTY');
  return { records: summaries, content, isEmpty };
}

function errorIdentity(error: unknown): { name: string; message: string } {
  if (typeof error === 'string') {
    return { name: '', message: error };
  }
  if (error instanceof Error) {
    const ctorName = error.constructor?.name ?? '';
    const name = error.name !== 'Error' ? error.name : ctorName;
    return { name, message: error.message ?? '' };
  }
  return { name: '', message: 'Unknown NFC error' };
}

function mapError(error: unknown): NfcServiceError {
  if (error instanceof NfcServiceError) {
    return error;
  }
  const { name, message } = errorIdentity(error);
  const normalized = `${name} ${message}`.toLowerCase();

  if (
    name === 'UserCancel' ||
    name === 'SessionInvalidated' ||
    normalized.includes('cancelled') ||
    normalized.includes('canceled') ||
    normalized.includes('user cancel')
  ) {
    return new NfcServiceError('SESSION_CANCELLED', 'NFC session cancelled');
  }
  if (
    name === 'RadioDisabled' ||
    normalized.includes('nfc is disabled') ||
    normalized.includes('nfc disabled') ||
    normalized.includes('radio disabled')
  ) {
    return new NfcServiceError('NFC_DISABLED', 'NFC is disabled');
  }
  if (
    name === 'UnsupportedFeature' ||
    normalized.includes('no nfc support') ||
    normalized.includes('nfc is not available')
  ) {
    return new NfcServiceError('NFC_UNAVAILABLE', 'NFC is not available');
  }
  if (
    name === 'TagNotWritable' ||
    normalized.includes('not writeable') ||
    normalized.includes('not writable')
  ) {
    return new NfcServiceError('TAG_NOT_WRITABLE', 'Tag is not writable');
  }
  if (normalized.includes('unsupported tag')) {
    return new NfcServiceError('UNSUPPORTED_TAG', message || 'Unsupported tag');
  }
  return new NfcServiceError('UNKNOWN', message || 'Unknown NFC error');
}

type TagLike = {
  id?: unknown;
  ndefMessage?: NdefRecord[];
  isWritable?: boolean;
  maxSize?: number;
};

function tagMeta(tag: TagLike | null, msg: TagLike | null) {
  const uid = formatUid(tag?.id ?? msg?.id ?? null);
  const isWritable =
    typeof tag?.isWritable === 'boolean'
      ? tag.isWritable
      : typeof (msg as TagLike | null)?.isWritable === 'boolean'
        ? (msg as TagLike).isWritable!
        : null;
  const maxSize = tag?.maxSize ?? msg?.maxSize ?? null;
  return { uid, isWritable, maxSize };
}

export async function init(): Promise<void> {
  try {
    await NfcManager.start();
  } catch (error) {
    throw mapError(error);
  }
}

/** Reject before a technology request when the radio is missing or switched off. */
export async function ensureNfcReady(): Promise<void> {
  try {
    const supported = await NfcManager.isSupported();
    if (!supported) {
      throw new NfcServiceError('NFC_UNAVAILABLE', 'NFC is not available');
    }
    const enabled = await NfcManager.isEnabled();
    if (!enabled) {
      throw new NfcServiceError('NFC_DISABLED', 'NFC is disabled');
    }
  } catch (error) {
    throw mapError(error);
  }
}

export async function isSupported(): Promise<boolean> {
  return NfcManager.isSupported();
}

export async function isEnabled(): Promise<boolean> {
  return NfcManager.isEnabled();
}

export async function cancel(): Promise<void> {
  await NfcManager.cancelTechnologyRequest();
}

export async function readTag(onDetected?: () => void): Promise<TagReadResult> {
  try {
    await NfcManager.requestTechnology(NfcTech.Ndef);
    onDetected?.();
    const tag = (await NfcManager.getTag()) as TagLike | null;
    const msg = (await NfcManager.ndefHandler.getNdefMessage()) as TagLike | null;
    const ndefRecords = msg?.ndefMessage ?? tag?.ndefMessage ?? [];
    const { records, content, isEmpty } = summarizeNdefMessage(ndefRecords);
    const { uid, isWritable, maxSize } = tagMeta(tag, msg);
    return { uid, records, content, isEmpty, isWritable, maxSize };
  } catch (error) {
    throw mapError(error);
  } finally {
    await NfcManager.cancelTechnologyRequest().catch(() => undefined);
  }
}

export async function writeUri(
  uri: string,
  opts?: {
    onDetected?: () => void;
    onWriting?: () => void;
    allowOverwrite?: boolean;
    expectedPreviousContent?: string;
  },
): Promise<{ uid: string | null; previousContent: string; wrote: boolean }> {
  try {
    await NfcManager.requestTechnology(NfcTech.Ndef);
    opts?.onDetected?.();
    const tag = (await NfcManager.getTag()) as TagLike | null;
    const msg = (await NfcManager.ndefHandler.getNdefMessage()) as TagLike | null;
    const ndefRecords = msg?.ndefMessage ?? tag?.ndefMessage ?? [];
    const { content, isEmpty } = summarizeNdefMessage(ndefRecords);
    const { uid, isWritable } = tagMeta(tag, msg);

    if (isWritable === false) {
      throw new NfcServiceError('TAG_NOT_WRITABLE', 'Tag is not writable');
    }
    if (!isEmpty && opts?.allowOverwrite !== true) {
      throw new NfcServiceError('WRITE_FAILED', 'Tag already contains data');
    }
    if (
      opts?.allowOverwrite === true &&
      opts.expectedPreviousContent !== undefined &&
      !isEmpty &&
      content !== opts.expectedPreviousContent
    ) {
      throw new NfcServiceError(
        'WRITE_FAILED',
        'Tag content does not match the confirmed content',
      );
    }

    opts?.onWriting?.();
    const bytes = Ndef.encodeMessage([Ndef.uriRecord(uri)]);
    await NfcManager.ndefHandler.writeNdefMessage(bytes);

    return { uid, previousContent: content, wrote: true };
  } catch (error) {
    throw mapError(error);
  } finally {
    await NfcManager.cancelTechnologyRequest().catch(() => undefined);
  }
}

export async function writeUriAndVerify(
  uri: string,
  opts?: {
    onDetected?: () => void;
    onWriting?: () => void;
    onVerifying?: () => void;
    allowOverwrite?: boolean;
    expectedPreviousContent?: string;
  },
): Promise<WriteVerifyResult> {
  const writeResult = await writeUri(uri, {
    onDetected: opts?.onDetected,
    onWriting: opts?.onWriting,
    allowOverwrite: opts?.allowOverwrite,
    expectedPreviousContent: opts?.expectedPreviousContent,
  });

  opts?.onVerifying?.();
  const readResult = await readTag();

  const readBackContent = readResult.content;
  // Exact string match only — no trim/lowercase normalization (production safety).
  // A completed write with a mismatch is returned so callers can record history.
  const verified = readBackContent === uri;

  return {
    uid: writeResult.uid ?? readResult.uid,
    writtenContent: uri,
    readBackContent,
    verified,
    detected: true,
    written: writeResult.wrote,
  };
}
