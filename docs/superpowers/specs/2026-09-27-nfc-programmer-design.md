# NFC Programmer — Design Spec

**Date:** 2026-09-27  
**Product:** Internal Android production tool for programming NTAG213 tags (13.56 MHz, NFC Forum Type 2) via NDEF.  
**Stack:** React Native (Expo + Development Build), TypeScript, `react-native-nfc-manager`.

---

## 1. Goals

Wholesale virgin NTAG213 tags are programmed in-house and delivered pre-written to clients.

Core jobs:
- Read NDEF content and tag metadata
- Write URI NDEF records
- Rewrite existing content (without locking)
- Batch-program unique URLs
- Persist a local production history
- Keep a separate, heavily guarded path for permanent read-only lock (not implemented until explicitly authorized)

Non-goals for v1:
- iOS support
- Irreversible chip lock commands
- Password / AUTH0 protection
- Live REST sync (only a typed service stub)

---

## 2. Platform & library capabilities

### 2.1 Multiplatform / Android NDEF (v1 uses Android only)

| Capability | Support via `react-native-nfc-manager` |
|---|---|
| Start / stop NFC session | Yes |
| Read UID when OS exposes it | Yes (reliable on Android) |
| Read NDEF message | Yes (`NfcTech.Ndef`) |
| Write NDEF URI record | Yes (`Ndef.uriRecord` + `writeNdefMessage`) |
| Re-read to verify | Yes |
| Detect writable | Partial but usable on Android (`isWritable`) |
| Available capacity | Partial (`maxSize` when exposed) |

### 2.2 Permanent lock (NOT in v1)

`ndefHandler.makeReadOnly()` is unreliable for NTAG213 (especially vs Type 2 lock bits) and must not be used as the production lock mechanism without validation.

Real NTAG213 irreversible lock mechanism (for a future authorized phase):
1. **Static lock bytes** — page `02h`, bytes 2–3; OTP bits; `0→1` via bitwise OR; irreversible.
2. **Dynamic lock bytes** — page `28h` on NTAG213; locks user memory from page `10h` onward.
3. Issued with WRITE command `0xA2` over `NfcTech.NfcA` + `transceive`.

Consequences: tag becomes permanently non-rewritable; cannot be undone in software. Android can implement this; iOS Core NFC does not provide equivalent Type 2 lock control for this app’s purposes.

**v1 ships a Lock screen with warnings only — no lock bit writes until explicit user authorization of the mechanism above.**

---

## 3. Architecture

Chosen approach: **service layers + Expo Router**, thin UI hooks.

```
app/                         # Expo Router screens
  index.tsx                  # Dashboard — NFC Programmer
  read.tsx
  write.tsx
  rewrite.tsx
  batch.tsx
  history.tsx
  lock.tsx                   # Warnings only in v1

src/
  services/
    nfcService.ts            # NFC hardware boundary
    storageService.ts        # Local persistence
    apiService.ts            # REST stub (same shapes as storage)
    idService.ts             # Unique serial IDs
  components/
    NfcStatusBanner.tsx
    ConfirmOverwriteModal.tsx
    PrimaryButton.tsx
  hooks/
    useNfcOperation.ts       # Maps service flow → UI status
  types/
    nfc.ts
    history.ts
```

### 3.1 Service responsibilities

**`nfcService`**
- `init()` / `isSupported()` / `isEnabled()`
- `readTag()` → UID, NDEF records, content summary, empty?, writable?, maxSize?
- `writeUri(uri)` → write NDEF URI record
- `writeUriAndVerify(uri)` → write, end session, re-read, compare
- `cancel()` / cleanup in `finally`
- Typed errors (see §5)
- No React imports; no storage side effects

**`storageService`**
- Append / list / clear history
- Persist batch lots (pending / used IDs)
- AsyncStorage in v1

**`apiService`**
- Stub methods mirroring storage (`listHistory`, `appendHistory`, …)
- Ready to swap implementation later without changing screens

**`idService`**
- Generate collision-free IDs for batch mode
- Check against history + pending lots

Screens never call `NfcManager.requestTechnology` directly.

---

## 4. UI status model

Shared operation states:

`IDLE` → `WAITING` → `DETECTED` → `READING` | `WRITING` → `VERIFYING` → `COMPLETED` | `ERROR`

User-facing labels:
- Esperando NFC…
- NFC detectado
- Leyendo… / Escribiendo…
- Verificando…
- Completado
- Error

Dashboard entries (large industrial buttons):
- Grabar NFC
- Leer NFC
- Reescribir NFC
- Grabación en serie
- Historial

Visual direction: administrative / industrial tool — high contrast, clear status, large tap targets. Not a consumer marketing site.

---

## 5. Feature flows

### 5.1 Read
1. User taps Leer NFC → `WAITING`
2. Request `NfcTech.Ndef`
3. On tag: `DETECTED` → read NDEF + metadata
4. Show: UID (if available), NDEF record type(s), stored content, empty flag, writable flag, capacity when known
5. Always `cancelTechnologyRequest()` in `finally`

### 5.2 Write URI
1. User enters URL (e.g. `https://midominio.com/nfc/ABC123`)
2. Grabar NFC → `WAITING`
3. On detect: if tag has existing content → overwrite confirmation modal
4. If confirmed or empty: encode `Ndef.uriRecord(url)` → write
5. Close session → new session → re-read → compare URI string
6. Persist history `{ operation: "WRITE", verified }`
7. Show checklist: detected / written / verified + UID + content

### 5.3 Rewrite
1. Read first; display current content
2. Require writable; else error and stop
3. User enters new content
4. Overwrite confirmation (always, since content exists)
5. Write → verify → history `{ operation: "REWRITE", verified }`
6. **Never** invoke lock

### 5.4 Overwrite safety
Any write against a non-empty tag shows:

> Este NFC ya contiene información:  
> `[contenido]`  
> ¿Deseas sobrescribirlo?

Cancel aborts with no write. Permanent lock is never chained to write/rewrite/batch.

### 5.5 Typed NFC errors
- `NFC_UNAVAILABLE`
- `NFC_DISABLED`
- `SESSION_CANCELLED`
- `TAG_NOT_WRITABLE`
- `WRITE_FAILED`
- `VERIFY_MISMATCH`
- `UNSUPPORTED_TAG` (when applicable)

`EMPTY_TAG` is informational for read UI, not necessarily an error.

---

## 6. History

```ts
type HistoryOperation = "WRITE" | "REWRITE" | "LOCK";

interface ProductionRecord {
  id: string;              // local uuid
  uid: string | null;
  content: string;
  operation: HistoryOperation;
  createdAt: string;       // ISO-8601
  verified: boolean;
}
```

History screen: newest first; show UID, content, operation, verified, timestamp.

---

## 7. Batch production (“Grabación en serie”)

Inputs:
- Base URL: `https://midominio.com/nfc/`
- Quantity: N (e.g. 50)

Algorithm:
1. Generate N unique IDs **up front** and persist the lot as `pending` before the first tag (crash-safe; no accidental ID reuse on restart).
2. Show `TAG k / N` + “Acerca el NFC”.
3. For each tag: write full URI → verify → append history `WRITE` → mark ID `used`.
4. Brief success → auto-advance to next.
5. End with summary: success / fail / cancelled counts.

### 7.1 ID format (`idService`)
- 6 characters from unambiguous alphabet (exclude `0/O`, `1/I/L`)
- Example: `A8X92K`
- Uniqueness against: existing history contents/IDs + all pending/used lot IDs
- Default on skip after failure: **keep ID reserved** (do not recycle) unless user explicitly chooses “liberar”
- Failure actions per tag: Reintentar / Saltar / Abortar lote
- Same overwrite modal as single write
- No automatic lock

---

## 8. Lock screen (v1 placeholder)

Separate navigation entry with multi-step warnings describing irreversibility.

v1 behavior:
- Show educational copy about NTAG213 static/dynamic lock bits
- State clearly that irreversible lock is **not enabled** until authorized
- Do not call `makeReadOnly`, `NfcA.transceive`, or any lock-page write

---

## 9. Tech setup (Expo + Android)

- Expo app with TypeScript
- `react-native-nfc-manager` + official config plugin
- Development Build / `expo prebuild` (not Expo Go)
- Android permission: `android.permission.NFC`
- `compileSdkVersion` ≥ 31 (via `expo-build-properties` if needed)
- Navigation: Expo Router
- Local storage: `@react-native-async-storage/async-storage`

---

## 10. Implementation phases

### Phase A (start immediately after plan approval)
1. Project scaffold (Expo, TS, folders, types)
2. `nfcService` init + read
3. Write URI + verify
4. Rewrite flow
5. Overwrite modal + status banner
6. Dashboard + read/write/rewrite screens

### Phase B
7. `storageService` + history screen
8. `idService` + batch screen
9. `apiService` stub
10. Lock placeholder screen

### Phase C (only after explicit authorization)
11. Document exact lock byte payload for NTAG213
12. Android `NfcA.transceive` lock implementation
13. Double confirmation + history `LOCK`

---

## 11. Success criteria (v1)

On a physical Android device with a Development Build and virgin/rewritable NTAG213 tags:
1. Read empty and programmed tags with useful metadata
2. Write a URI and verify round-trip match
3. Rewrite and verify
4. Batch N tags with unique URLs and no ID reuse
5. See all operations in Historial
6. Lock path remains non-destructive

---

## 12. Decisions log

| Decision | Choice |
|---|---|
| Platforms v1 | Android only |
| Bootstrap | Expo + Development Build |
| Architecture | Service layers + Expo Router |
| Storage v1 | AsyncStorage behind `storageService` |
| NDEF content type | URI records for write/batch |
| Permanent lock | Deferred; mechanism documented; not coded |
| Batch ID policy | Pre-generate + persist; reserve on skip |
