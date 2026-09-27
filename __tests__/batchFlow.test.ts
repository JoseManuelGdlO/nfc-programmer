import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';

import BatchScreen from '../app/batch';
import { cancel, readTag, writeUriAndVerify } from '../src/services/nfcService';
import { appendHistory } from '../src/services/storageService';

jest.mock('../src/services/nfcService', () => ({
  init: jest.fn(() => Promise.resolve()),
  ensureNfcReady: jest.fn(() => Promise.resolve()),
  cancel: jest.fn(() => Promise.resolve()),
  readTag: jest.fn(),
  writeUriAndVerify: jest.fn(),
}));

jest.mock('../src/services/storageService', () => ({
  appendHistory: jest.fn(async () => ({})),
  getReservedCodes: jest.fn(async () => new Set<string>()),
  saveBatchLot: jest.fn(async () => undefined),
  updateBatchLot: jest.fn(async () => undefined),
}));

const cancelMock = cancel as jest.MockedFunction<typeof cancel>;
const readTagMock = readTag as jest.MockedFunction<typeof readTag>;
const writeMock = writeUriAndVerify as jest.MockedFunction<typeof writeUriAndVerify>;
const appendHistoryMock = appendHistory as jest.MockedFunction<typeof appendHistory>;

const emptyProbe = {
  uid: '04:01:02:03',
  records: [],
  content: '',
  isEmpty: true,
  isWritable: true,
  maxSize: 128,
};

function verifiedWrite(uri: string) {
  return {
    uid: '04:01:02:03',
    writtenContent: uri,
    readBackContent: uri,
    verified: true,
    detected: true,
    written: true,
  };
}

async function startSeries() {
  const screen = await render(React.createElement(BatchScreen));
  fireEvent.press(screen.getByText('INICIAR SERIE'));
  return screen;
}

const originalConsoleError = console.error.bind(console);

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
    const text = args.map((arg) => String(arg)).join('\n');
    if (text.includes('not configured to support act')) {
      return;
    }
    originalConsoleError(...args);
  });
});

afterAll(() => {
  jest.restoreAllMocks();
});

describe('batch programming flow', () => {
  test('cancels the NFC session when the screen unmounts', async () => {
    const screen = await render(React.createElement(BatchScreen));
    await screen.unmount();
    expect(cancelMock).toHaveBeenCalled();
  });

  test('waits for Siguiente NFC before programming the next tag', async () => {
    readTagMock.mockResolvedValue(emptyProbe);
    writeMock.mockImplementation(async (uri) => verifiedWrite(uri));

    const screen = await startSeries();

    expect(await screen.findByText(/Retira el NFC \/ TAG 1 completado/)).toBeTruthy();
    expect(writeMock).toHaveBeenCalledTimes(1);
    expect(readTagMock).toHaveBeenCalledTimes(1);

    fireEvent.press(screen.getByText('Siguiente NFC'));

    await waitFor(() => {
      expect(writeMock).toHaveBeenCalledTimes(2);
    });
    expect(readTagMock).toHaveBeenCalledTimes(2);
    expect(await screen.findByText(/Retira el NFC \/ TAG 2 completado/)).toBeTruthy();
  });

  test('stays on the same tag when overwrite is cancelled', async () => {
    readTagMock.mockResolvedValue({
      ...emptyProbe,
      content: 'https://old.example/tag',
      isEmpty: false,
      records: [{ type: 'URI', content: 'https://old.example/tag' }],
    });

    const screen = await startSeries();

    fireEvent.press(await screen.findByText('Cancelar'));

    expect(await screen.findByText('REINTENTAR')).toBeTruthy();
    expect(screen.getByText('SALTAR')).toBeTruthy();
    expect(screen.getByText('ABORTAR')).toBeTruthy();
    expect(writeMock).not.toHaveBeenCalled();
    expect(readTagMock).toHaveBeenCalledTimes(1);
    expect(screen.getByText(/TAG 1 \/ 10/)).toBeTruthy();
  });

  test('records a failed verification and does not advance', async () => {
    readTagMock.mockResolvedValue(emptyProbe);
    writeMock.mockImplementation(async (uri) => ({
      ...verifiedWrite(uri),
      readBackContent: 'https://other.example/mismatch',
      verified: false,
    }));

    const screen = await startSeries();

    expect(await screen.findByText('REINTENTAR')).toBeTruthy();
    expect(appendHistoryMock).toHaveBeenCalledWith(
      expect.objectContaining({ verified: false, operation: 'WRITE' }),
    );
    expect(screen.queryByText('Siguiente NFC')).toBeNull();
    expect(screen.getByText(/TAG 1 \/ 10/)).toBeTruthy();
  });
});
