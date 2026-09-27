jest.mock('react-native-nfc-manager', () => ({
  __esModule: true,
  default: {
    start: jest.fn(() => Promise.resolve()),
    isSupported: jest.fn(() => Promise.resolve(true)),
    isEnabled: jest.fn(() => Promise.resolve(true)),
    requestTechnology: jest.fn(() => Promise.resolve()),
    cancelTechnologyRequest: jest.fn(() => Promise.resolve()),
    getTag: jest.fn(),
    setEventListener: jest.fn(),
    ndefHandler: {
      getNdefMessage: jest.fn(),
      writeNdefMessage: jest.fn(),
    },
  },
  NfcTech: { Ndef: 'Ndef' },
  Ndef: jest.requireActual('react-native-nfc-manager/ndef-lib'),
}));

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
