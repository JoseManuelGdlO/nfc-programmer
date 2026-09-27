# NFC Programmer

Android NFC tag programmer for NTAG213 tags: read NDEF metadata, write and verify URI records, batch programming with unique IDs, operation history, and a non-destructive lock placeholder (permanent lock not implemented in v1).

## Requirements

- **Android** device with NFC hardware
- **Node.js** (LTS recommended) and npm
- **Android SDK** / Android Studio for native builds
- **Expo Development Build** — **Expo Go is not supported** (`react-native-nfc-manager` requires a custom dev client)

## Scope (v1)

- URI NDEF write/read/verify, rewrite, batch, and local history
- **No irreversible lock** — the lock screen is informational only; NTAG213 static/dynamic lock bytes are not written in this release

## Setup and run (Android Development Build)

```bash
npm install
npx expo prebuild --platform android
npx expo run:android
```

Use a physical device with NFC enabled. Connect via USB debugging or ensure the device is reachable for `run:android`.

Start the dev server when iterating:

```bash
npm start
```

## Automated checks

```bash
npm test
npx tsc --noEmit
```

## Manual test checklist (v1 success criteria)

On a physical Android device with a Development Build and virgin/rewritable NTAG213 tags:

- [ ] **Read** — Scan empty and already-programmed tags; confirm useful metadata (UID, tech, NDEF/URI when present) on the read screen
- [ ] **Write + verify** — Enter a URI, write to a tag, and confirm post-write verification shows a round-trip URI match
- [ ] **Rewrite** — Change the URI on a rewritable tag and verify the new value after rewrite
- [ ] **Batch** — Program multiple tags in one batch; confirm each tag gets a **unique** URL and IDs are not reused across the run
- [ ] **Historial** — After read/write/rewrite/batch actions, confirm entries appear in history with correct operation types
- [ ] **Lock path** — Open the lock screen; confirm warnings only and **no** irreversible lock is applied to the tag

## Project layout

- `app/` — Expo Router screens (dashboard, read, write, rewrite, batch, history, lock)
- `src/services/` — `nfcService`, `storageService`, `idService`, `batchLot`, `apiService` (stub)
- `src/types/` — shared types (`ProductionRecord`, `WriteVerifyResult`, `NfcUiStatus`, etc.)
