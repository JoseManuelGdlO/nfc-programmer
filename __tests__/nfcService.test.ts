import NfcManager, { Ndef, NfcTech, type TagEvent } from 'react-native-nfc-manager';
import { NfcServiceError } from '../src/types/nfc';
import {
  cancel,
  ensureNfcReady,
  init,
  readTag,
  writeUri,
  writeUriAndVerify,
} from '../src/services/nfcService';

/** Partial tag payloads used in tests (library types omit fields the app reads at runtime). */
function mockTag(tag: Record<string, unknown>): TagEvent {
  return tag as unknown as TagEvent;
}

const nfc = NfcManager as jest.Mocked<typeof NfcManager> & {
  ndefHandler: {
    getNdefMessage: jest.Mock;
    writeNdefMessage: jest.Mock;
  };
};

beforeEach(() => {
  jest.clearAllMocks();
  nfc.requestTechnology.mockResolvedValue(NfcTech.Ndef);
  nfc.cancelTechnologyRequest.mockResolvedValue(undefined);
  nfc.getTag.mockResolvedValue(null);
  nfc.ndefHandler.getNdefMessage.mockResolvedValue(null);
});

describe('init', () => {
  test('calls NfcManager.start', async () => {
    await init();
    expect(nfc.start).toHaveBeenCalledTimes(1);
  });

  test('maps Android no nfc support from start', async () => {
    nfc.start.mockRejectedValueOnce(new Error('no nfc support'));
    await expect(init()).rejects.toMatchObject({ code: 'NFC_UNAVAILABLE' });
  });
});

describe('ensureNfcReady', () => {
  test('throws NFC_DISABLED when the radio is off', async () => {
    nfc.isEnabled.mockResolvedValueOnce(false);
    await expect(ensureNfcReady()).rejects.toMatchObject({ code: 'NFC_DISABLED' });
  });

  test('throws NFC_UNAVAILABLE when the device has no NFC', async () => {
    nfc.isSupported.mockResolvedValueOnce(false);
    await expect(ensureNfcReady()).rejects.toMatchObject({ code: 'NFC_UNAVAILABLE' });
    expect(nfc.isEnabled).not.toHaveBeenCalled();
  });
});

describe('readTag', () => {
  test('returns empty result when there are no NDEF records', async () => {
    nfc.getTag.mockResolvedValue(mockTag({ id: '04010203', ndefMessage: [] }));
    nfc.ndefHandler.getNdefMessage.mockResolvedValue({ ndefMessage: [] });

    const result = await readTag();

    expect(result).toEqual({
      uid: '04:01:02:03',
      records: [],
      content: '',
      isEmpty: true,
      isWritable: null,
      maxSize: null,
    });
    expect(nfc.cancelTechnologyRequest).toHaveBeenCalledTimes(1);
  });

  test('maps URI record content', async () => {
    const uri = 'https://midominio.com/nfc/ABC123';
    const record = Ndef.uriRecord(uri);
    nfc.getTag.mockResolvedValue(mockTag({ id: '04010203', ndefMessage: [] }));
    nfc.ndefHandler.getNdefMessage.mockResolvedValue({ ndefMessage: [record] });

    const result = await readTag();

    expect(result.records).toEqual([{ type: 'URI', content: uri }]);
    expect(result.content).toBe(uri);
    expect(result.isEmpty).toBe(false);
    expect(nfc.cancelTechnologyRequest).toHaveBeenCalledTimes(1);
  });

  test('treats a tag as empty only when every record is EMPTY', async () => {
    nfc.getTag.mockResolvedValue(mockTag({ id: '01', ndefMessage: [] }));
    nfc.ndefHandler.getNdefMessage.mockResolvedValue({
      ndefMessage: [Ndef.record(Ndef.TNF_EMPTY, '', [], [])],
    });

    const result = await readTag();

    expect(result.records).toEqual([{ type: 'EMPTY', content: '' }]);
    expect(result.isEmpty).toBe(true);
  });

  test('does not treat UNKNOWN records with blank decoded content as empty', async () => {
    const record = Ndef.record(Ndef.TNF_MIME_MEDIA, 'application/octet-stream', [], 'secret-bytes');
    nfc.getTag.mockResolvedValue(mockTag({ id: '01', ndefMessage: [] }));
    nfc.ndefHandler.getNdefMessage.mockResolvedValue({ ndefMessage: [record] });

    const result = await readTag();

    expect(result.records).toEqual([{ type: 'UNKNOWN', content: '' }]);
    expect(result.isEmpty).toBe(false);
  });

  test('formats UID bytes as colon-separated hex', async () => {
    nfc.getTag.mockResolvedValue(mockTag({ id: '04a312ff', ndefMessage: [] }));
    nfc.ndefHandler.getNdefMessage.mockResolvedValue({ ndefMessage: [] });

    const result = await readTag();

    expect(result.uid).toBe('04:A3:12:FF');
  });

  test('invokes cancelTechnologyRequest when read fails', async () => {
    nfc.requestTechnology.mockRejectedValue(new Error('read failed'));

    await expect(readTag()).rejects.toThrow();
    expect(nfc.cancelTechnologyRequest).toHaveBeenCalledTimes(1);
  });

  test('requests NDEF technology', async () => {
    nfc.ndefHandler.getNdefMessage.mockResolvedValue({ ndefMessage: [] });
    await readTag();
    expect(nfc.requestTechnology).toHaveBeenCalledWith(NfcTech.Ndef);
  });
});

describe('cancel', () => {
  test('calls cancelTechnologyRequest', async () => {
    await cancel();
    expect(nfc.cancelTechnologyRequest).toHaveBeenCalledTimes(1);
  });
});

describe('writeUri', () => {
  test('writes URI bytes on empty tag', async () => {
    const uri = 'https://midominio.com/nfc/ABC123';
    const expectedBytes = Ndef.encodeMessage([Ndef.uriRecord(uri)]);
    nfc.getTag.mockResolvedValue(
      mockTag({ id: '04010203', isWritable: true, ndefMessage: [] }),
    );
    nfc.ndefHandler.getNdefMessage.mockResolvedValue({ ndefMessage: [] });
    nfc.ndefHandler.writeNdefMessage.mockResolvedValue(undefined);

    const result = await writeUri(uri);

    expect(nfc.ndefHandler.writeNdefMessage).toHaveBeenCalledWith(expectedBytes);
    expect(result).toEqual({
      uid: '04:01:02:03',
      previousContent: '',
      wrote: true,
    });
    expect(nfc.cancelTechnologyRequest).toHaveBeenCalled();
  });

  test('throws before write when tag is non-empty and allowOverwrite is not true', async () => {
    const existing = 'https://old.example/tag';
    const record = Ndef.uriRecord(existing);
    nfc.getTag.mockResolvedValue(mockTag({ id: '01', isWritable: true, ndefMessage: [] }));
    nfc.ndefHandler.getNdefMessage.mockResolvedValue({ ndefMessage: [record] });

    await expect(writeUri('https://new.example/tag')).rejects.toThrow(NfcServiceError);
    expect(nfc.ndefHandler.writeNdefMessage).not.toHaveBeenCalled();
  });

  test('throws TAG_NOT_WRITABLE when isWritable is false', async () => {
    nfc.getTag.mockResolvedValue(mockTag({ id: '01', isWritable: false, ndefMessage: [] }));
    nfc.ndefHandler.getNdefMessage.mockResolvedValue({ ndefMessage: [] });

    await expect(writeUri('https://example.com/nfc/X')).rejects.toMatchObject({
      code: 'TAG_NOT_WRITABLE',
    });
    expect(nfc.ndefHandler.writeNdefMessage).not.toHaveBeenCalled();
  });

  test('blocks write of a non-URI UNKNOWN record unless allowOverwrite is set', async () => {
    const record = Ndef.record(Ndef.TNF_UNKNOWN, '', [], [1, 2, 3]);
    nfc.getTag.mockResolvedValue(mockTag({ id: '01', isWritable: true, ndefMessage: [] }));
    nfc.ndefHandler.getNdefMessage.mockResolvedValue({ ndefMessage: [record] });

    await expect(writeUri('https://new.example/tag')).rejects.toMatchObject({
      code: 'WRITE_FAILED',
    });
    expect(nfc.ndefHandler.writeNdefMessage).not.toHaveBeenCalled();
  });

  test('aborts overwrite when live content differs from the confirmed content', async () => {
    const confirmed = 'https://old.example/confirmed';
    const current = 'https://other.example/now';
    nfc.getTag.mockResolvedValue(mockTag({ id: '01', isWritable: true, ndefMessage: [] }));
    nfc.ndefHandler.getNdefMessage.mockResolvedValue({
      ndefMessage: [Ndef.uriRecord(current)],
    });
    const onWriting = jest.fn();

    await expect(
      writeUri('https://new.example/tag', {
        allowOverwrite: true,
        expectedPreviousContent: confirmed,
        onWriting,
      }),
    ).rejects.toMatchObject({ code: 'WRITE_FAILED' });
    expect(nfc.ndefHandler.writeNdefMessage).not.toHaveBeenCalled();
    expect(onWriting).not.toHaveBeenCalled();
  });

  test('overwrites when live content matches the confirmed content', async () => {
    const confirmed = 'https://old.example/confirmed';
    const uri = 'https://new.example/tag';
    nfc.getTag.mockResolvedValue(mockTag({ id: '01', isWritable: true, ndefMessage: [] }));
    nfc.ndefHandler.getNdefMessage.mockResolvedValue({
      ndefMessage: [Ndef.uriRecord(confirmed)],
    });
    nfc.ndefHandler.writeNdefMessage.mockResolvedValue(undefined);
    const onWriting = jest.fn();

    const result = await writeUri(uri, {
      allowOverwrite: true,
      expectedPreviousContent: confirmed,
      onWriting,
    });

    expect(onWriting).toHaveBeenCalledTimes(1);
    expect(nfc.ndefHandler.writeNdefMessage).toHaveBeenCalledWith(
      Ndef.encodeMessage([Ndef.uriRecord(uri)]),
    );
    expect(result.previousContent).toBe(confirmed);
  });

  test('maps Android cancel, missing NFC, and not-writeable messages to typed codes', async () => {
    nfc.requestTechnology.mockRejectedValueOnce(new Error('cancelled'));
    await expect(readTag()).rejects.toMatchObject({ code: 'SESSION_CANCELLED' });

    nfc.requestTechnology.mockRejectedValueOnce(new Error('user cancel'));
    await expect(readTag()).rejects.toMatchObject({ code: 'SESSION_CANCELLED' });

    class UserCancel extends Error {}
    nfc.requestTechnology.mockRejectedValueOnce(new UserCancel());
    await expect(readTag()).rejects.toMatchObject({ code: 'SESSION_CANCELLED' });

    nfc.requestTechnology.mockRejectedValueOnce(new Error('no nfc support'));
    await expect(readTag()).rejects.toMatchObject({ code: 'NFC_UNAVAILABLE' });

    nfc.getTag.mockResolvedValue(mockTag({ id: '01', isWritable: true, ndefMessage: [] }));
    nfc.ndefHandler.getNdefMessage.mockResolvedValue({ ndefMessage: [] });
    nfc.ndefHandler.writeNdefMessage.mockRejectedValue(new Error('tag is not writeable'));
    await expect(writeUri('https://example.com/nfc/X')).rejects.toMatchObject({
      code: 'TAG_NOT_WRITABLE',
    });
  });
});

describe('writeUriAndVerify', () => {
  test('returns verified when read-back URI matches', async () => {
    const uri = 'https://midominio.com/nfc/VERIFY1';
    const record = Ndef.uriRecord(uri);
    nfc.getTag.mockResolvedValue(mockTag({ id: '04010203', isWritable: true, ndefMessage: [] }));
    nfc.ndefHandler.getNdefMessage
      .mockResolvedValueOnce({ ndefMessage: [] })
      .mockResolvedValueOnce({ ndefMessage: [record] });
    nfc.ndefHandler.writeNdefMessage.mockResolvedValue(undefined);

    const order: string[] = [];
    const onDetected = jest.fn(() => {
      order.push('detected');
    });
    const onWriting = jest.fn(() => {
      order.push('writing');
    });
    const onVerifying = jest.fn(() => {
      order.push('verifying');
    });
    nfc.ndefHandler.writeNdefMessage.mockImplementation(async () => {
      order.push('write');
    });
    const result = await writeUriAndVerify(uri, { onDetected, onWriting, onVerifying });

    expect(order).toEqual(['detected', 'writing', 'write', 'verifying']);
    expect(onWriting).toHaveBeenCalled();
    expect(onVerifying).toHaveBeenCalled();
    expect(result).toMatchObject({
      uid: '04:01:02:03',
      writtenContent: uri,
      readBackContent: uri,
      verified: true,
      written: true,
      detected: true,
    });
    expect(nfc.requestTechnology).toHaveBeenCalledTimes(2);
  });

  test('returns verified false when read-back differs without throwing', async () => {
    const intended = 'https://midominio.com/nfc/INTENDED';
    const readBack = 'https://midominio.com/nfc/OTHER';
    nfc.getTag.mockResolvedValue(mockTag({ id: '01', isWritable: true, ndefMessage: [] }));
    nfc.ndefHandler.getNdefMessage
      .mockResolvedValueOnce({ ndefMessage: [] })
      .mockResolvedValueOnce({ ndefMessage: [Ndef.uriRecord(readBack)] });
    nfc.ndefHandler.writeNdefMessage.mockResolvedValue(undefined);

    const result = await writeUriAndVerify(intended);

    expect(nfc.ndefHandler.writeNdefMessage).toHaveBeenCalled();
    expect(result).toMatchObject({
      writtenContent: intended,
      readBackContent: readBack,
      verified: false,
      written: true,
      detected: true,
    });
  });

  test('refuses a write session whose content differs from the confirmed probe', async () => {
    nfc.getTag.mockResolvedValue(mockTag({ id: '01', isWritable: true, ndefMessage: [] }));
    nfc.ndefHandler.getNdefMessage.mockResolvedValue({
      ndefMessage: [Ndef.uriRecord('https://different.example/tag')],
    });

    await expect(
      writeUriAndVerify('https://new.example/tag', {
        allowOverwrite: true,
        expectedPreviousContent: 'https://confirmed.example/tag',
      }),
    ).rejects.toMatchObject({ code: 'WRITE_FAILED' });
    expect(nfc.ndefHandler.writeNdefMessage).not.toHaveBeenCalled();
  });

  test('does not call onWriting when the tag is non-empty and overwrite is not allowed', async () => {
    const existing = 'https://old.example/tag';
    nfc.getTag.mockResolvedValue(mockTag({ id: '01', isWritable: true, ndefMessage: [] }));
    nfc.ndefHandler.getNdefMessage.mockResolvedValue({
      ndefMessage: [Ndef.uriRecord(existing)],
    });
    const onWriting = jest.fn();

    await expect(
      writeUriAndVerify('https://new.example/tag', { onWriting }),
    ).rejects.toMatchObject({ code: 'WRITE_FAILED' });
    expect(onWriting).not.toHaveBeenCalled();
    expect(nfc.ndefHandler.writeNdefMessage).not.toHaveBeenCalled();
  });
});
