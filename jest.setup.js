jest.mock('react-native-nfc-manager', () => ({
  __esModule: true,
  default: {
    start: jest.fn(),
    isSupported: jest.fn(() => Promise.resolve(true)),
    requestTechnology: jest.fn(),
    cancelTechnologyRequest: jest.fn(),
    getTag: jest.fn(),
    setEventListener: jest.fn(),
  },
  NfcTech: { Ndef: 'Ndef' },
  Ndef: {
    text: {
      decodePayload: jest.fn(),
    },
    uri: {
      decodePayload: jest.fn(),
    },
  },
}));

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
