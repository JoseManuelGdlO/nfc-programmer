import NfcManager, { Ndef, NfcTech } from 'react-native-nfc-manager';
import { NfcServiceError } from '../src/types/nfc';
import {
  cancel,
  init,
  readTag,
  writeUri,
  writeUriAndVerify,
} from '../src/services/nfcService';

const nfc = NfcManager as jest.Mocked<typeof NfcManager> & {
  ndefHandler: {
    getNdefMessage: jest.Mock;
    writeNdefMessage: jest.Mock;
  };
};

beforeEach(() => {
  jest.clearAllMocks();
  nfc.requestTechnology.mockResolvedValue(undefined);
  nfc.cancelTechnologyRequest.mockResolvedValue(undefined);
  nfc.getTag.mockResolvedValue(null);
  nfc.ndefHandler.getNdefMessage.mockResolvedValue(null);
});

describe('init', () => {
  test('calls NfcManager.start', async () => {
    await init();
    expect(nfc.start).toHaveBeenCalledTimes(1);
  });
});

describe('readTag', () => {
  test('returns empty result when there are no NDEF records', async () => {
    nfc.getTag.mockResolvedValue({ id: [4, 1, 2, 3], ndefMessage: [] });
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
    nfc.getTag.mockResolvedValue({ id: [4, 1, 2, 3] });
    nfc.ndefHandler.getNdefMessage.mockResolvedValue({ ndefMessage: [record] });

    const result = await readTag();

    expect(result.records).toEqual([{ type: 'URI', content: uri }]);
    expect(result.content).toBe(uri);
    expect(result.isEmpty).toBe(false);
    expect(nfc.cancelTechnologyRequest).toHaveBeenCalledTimes(1);
  });

  test('formats UID bytes as colon-separated hex', async () => {
    nfc.getTag.mockResolvedValue({ id: [0x04, 0xa3, 0x12, 0xff] });
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
    nfc.getTag.mockResolvedValue({
      id: [4, 1, 2, 3],
      isWritable: true,
      ndefMessage: [],
    });
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
    nfc.getTag.mockResolvedValue({ id: [1], isWritable: true });
    nfc.ndefHandler.getNdefMessage.mockResolvedValue({ ndefMessage: [record] });

    await expect(writeUri('https://new.example/tag')).rejects.toThrow(NfcServiceError);
    expect(nfc.ndefHandler.writeNdefMessage).not.toHaveBeenCalled();
  });

  test('throws TAG_NOT_WRITABLE when isWritable is false', async () => {
    nfc.getTag.mockResolvedValue({ id: [1], isWritable: false });
    nfc.ndefHandler.getNdefMessage.mockResolvedValue({ ndefMessage: [] });

    await expect(writeUri('https://example.com/nfc/X')).rejects.toMatchObject({
      code: 'TAG_NOT_WRITABLE',
    });
    expect(nfc.ndefHandler.writeNdefMessage).not.toHaveBeenCalled();
  });
});

describe('writeUriAndVerify', () => {
  test('returns verified when read-back URI matches', async () => {
    const uri = 'https://midominio.com/nfc/VERIFY1';
    const record = Ndef.uriRecord(uri);
    nfc.getTag.mockResolvedValue({ id: [4, 1, 2, 3], isWritable: true });
    nfc.ndefHandler.getNdefMessage
      .mockResolvedValueOnce({ ndefMessage: [] })
      .mockResolvedValueOnce({ ndefMessage: [record] });
    nfc.ndefHandler.writeNdefMessage.mockResolvedValue(undefined);

    const onWriting = jest.fn();
    const onVerifying = jest.fn();
    const result = await writeUriAndVerify(uri, { onWriting, onVerifying });

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

  test('throws VERIFY_MISMATCH when read-back differs', async () => {
    const intended = 'https://midominio.com/nfc/INTENDED';
    const readBack = 'https://midominio.com/nfc/OTHER';
    nfc.getTag.mockResolvedValue({ id: [1], isWritable: true });
    nfc.ndefHandler.getNdefMessage
      .mockResolvedValueOnce({ ndefMessage: [] })
      .mockResolvedValueOnce({ ndefMessage: [Ndef.uriRecord(readBack)] });
    nfc.ndefHandler.writeNdefMessage.mockResolvedValue(undefined);

    await expect(writeUriAndVerify(intended)).rejects.toMatchObject({
      code: 'VERIFY_MISMATCH',
    });
  });
});
