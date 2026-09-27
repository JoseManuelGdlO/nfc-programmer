import NfcManager, { Ndef, NfcTech } from 'react-native-nfc-manager';
import { cancel, init, readTag } from '../src/services/nfcService';

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
