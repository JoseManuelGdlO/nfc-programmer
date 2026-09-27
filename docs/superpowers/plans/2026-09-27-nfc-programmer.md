# NFC Programmer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an Android Expo Development Build app that reads, writes, rewrites, batch-programs, and histories NTAG213 NDEF URI tags for internal production use — without irreversible lock.

**Architecture:** Expo Router screens call thin hooks; all NFC I/O lives in `nfcService`; persistence in `storageService`; unique serial IDs in `idService`; `apiService` is a typed REST stub. No permanent lock bit writes in this plan.

**Tech Stack:** Expo (TypeScript) + Expo Router, `react-native-nfc-manager`, `@react-native-async-storage/async-storage`, Jest for unit tests of pure/service layers, Android Development Build.

**Spec:** `docs/superpowers/specs/2026-09-27-nfc-programmer-design.md`

## Global Constraints

- Platform v1: **Android only**
- Bootstrap: **Expo + Development Build** (not Expo Go)
- NDEF content for write/rewrite/batch: **URI records only**
- Permanent lock: **deferred** — Lock screen shows warnings only; never call `makeReadOnly` or `NfcA.transceive` lock writes
- Never auto-lock after write
- Overwrite non-empty tags only after explicit confirmation
- Batch IDs: 6-char unambiguous alphabet; pre-generate + persist lot; reserve on skip
- UI language: Spanish labels as in the spec
- Branch naming when implementing features: `cursor/<descriptive-name>-76e4`

---

## File structure (create)

```
app/
  _layout.tsx
  index.tsx
  read.tsx
  write.tsx
  rewrite.tsx
  batch.tsx
  history.tsx
  lock.tsx
src/
  types/nfc.ts
  types/history.ts
  services/nfcService.ts
  services/storageService.ts
  services/apiService.ts
  services/idService.ts
  hooks/useNfcOperation.ts
  components/NfcStatusBanner.tsx
  components/ConfirmOverwriteModal.tsx
  components/PrimaryButton.tsx
  theme/colors.ts
__tests__/
  idService.test.ts
  storageService.test.ts
  nfcService.test.ts
app.json
package.json
jest.config.js
jest.setup.js
```

---

### Task 1: Scaffold Expo app + base config

**Files:**
- Create: Expo project at repo root (keep existing `docs/` and `.gitignore`)
- Create/Modify: `app.json`, `package.json`, `tsconfig.json`, `app/_layout.tsx`
- Create: `src/theme/colors.ts`, `jest.config.js`, `jest.setup.js`

**Interfaces:**
- Consumes: none
- Produces: runnable Expo TypeScript app with Expo Router entry `app/_layout.tsx`

- [ ] **Step 1: Create Expo app in place**

```bash
cd /agent
npx create-expo-app@latest . --template tabs -y
# If create-expo-app refuses non-empty dir, use a temp dir and move app files, preserving docs/ and .gitignore
```

Remove demo tab screens; keep Expo Router structure under `app/`.

- [ ] **Step 2: Install dependencies**

```bash
npx expo install react-native-nfc-manager @react-native-async-storage/async-storage expo-build-properties
npm install --save-dev jest @types/jest ts-jest jest-expo @testing-library/react-native
```

- [ ] **Step 3: Configure `app.json` plugins (Android NFC)**

```json
{
  "expo": {
    "name": "NFC Programmer",
    "slug": "nfc-programmer",
    "scheme": "nfc-programmer",
    "android": {
      "package": "com.internal.nfcprogrammer",
      "permissions": ["android.permission.NFC"]
    },
    "plugins": [
      "react-native-nfc-manager",
      [
        "expo-build-properties",
        {
          "android": {
            "compileSdkVersion": 35,
            "targetSdkVersion": 35,
            "minSdkVersion": 26
          }
        }
      ]
    ]
  }
}
```

- [ ] **Step 4: Add theme + root layout shell**

`src/theme/colors.ts`:

```ts
export const colors = {
  background: '#E8ECF0',
  surface: '#F4F6F8',
  ink: '#1A2332',
  muted: '#5A6577',
  accent: '#C45C26',
  success: '#1F7A4C',
  danger: '#B42318',
  border: '#C5CDD8',
  waiting: '#2F5D8C',
};
```

`app/_layout.tsx`: Stack navigator, Spanish headers, background `colors.background`.

- [ ] **Step 5: Jest config**

`jest.config.js`:

```js
module.exports = {
  preset: 'jest-expo',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  testMatch: ['**/__tests__/**/*.test.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
};
```

`jest.setup.js`: mock `react-native-nfc-manager` and AsyncStorage (minimal stubs; Task 3–4 expand).

- [ ] **Step 6: Commit**

```bash
git checkout -b cursor/nfc-programmer-scaffold-76e4
git add -A
git commit -m "chore: scaffold Expo NFC Programmer app with Jest and NFC plugin"
git push -u origin cursor/nfc-programmer-scaffold-76e4
```

---

### Task 2: Shared types

**Files:**
- Create: `src/types/nfc.ts`
- Create: `src/types/history.ts`

**Interfaces:**
- Consumes: none
- Produces: `NfcUiStatus`, `TagReadResult`, `WriteVerifyResult`, `NfcServiceErrorCode`, `ProductionRecord`, `HistoryOperation`, `BatchLot`, `BatchLotItem`

- [ ] **Step 1: Write types**

`src/types/nfc.ts`:

```ts
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
```

`src/types/history.ts`:

```ts
export type HistoryOperation = 'WRITE' | 'REWRITE' | 'LOCK';

export interface ProductionRecord {
  id: string;
  uid: string | null;
  content: string;
  operation: HistoryOperation;
  createdAt: string;
  verified: boolean;
}

export type BatchItemStatus = 'pending' | 'used' | 'skipped_reserved';

export interface BatchLotItem {
  code: string;
  uri: string;
  status: BatchItemStatus;
}

export interface BatchLot {
  id: string;
  baseUrl: string;
  quantity: number;
  items: BatchLotItem[];
  createdAt: string;
  completedAt: string | null;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/types
git commit -m "feat: add NFC and production history TypeScript types"
git push
```

---

### Task 3: `idService` (TDD)

**Files:**
- Create: `src/services/idService.ts`
- Test: `__tests__/idService.test.ts`

**Interfaces:**
- Consumes: none
- Produces:
  - `ID_ALPHABET: string`
  - `generateCode(length?: number): string`
  - `buildUri(baseUrl: string, code: string): string`
  - `generateUniqueCodes(count: number, reserved: Set<string>): string[]`

- [ ] **Step 1: Write failing tests**

```ts
import { generateCode, generateUniqueCodes, buildUri, ID_ALPHABET } from '../src/services/idService';

test('alphabet excludes ambiguous characters', () => {
  expect(ID_ALPHABET).not.toMatch(/[01IOL]/
});

test('generateCode returns 6 chars from alphabet', () => {
  const code = generateCode(6);
  expect(code).toHaveLength(6);
  for (const ch of code) expect(ID_ALPHABET).toContain(ch);
});

test('generateUniqueCodes never collides with reserved', () => {
  const reserved = new Set(['AAAAAA']);
  const codes = generateUniqueCodes(20, reserved);
  expect(codes).toHaveLength(20);
  expect(new Set(codes).size).toBe(20);
  codes.forEach((c) => expect(reserved.has(c)).toBe(false));
});

test('buildUri joins base and code without double slash bugs', () => {
  expect(buildUri('https://midominio.com/nfc/', 'A8X92K')).toBe(
    'https://midominio.com/nfc/A8X92K',
  );
  expect(buildUri('https://midominio.com/nfc', 'A8X92K')).toBe(
    'https://midominio.com/nfc/A8X92K',
  );
});
```

- [ ] **Step 2: Run tests — expect FAIL**

```bash
npm test -- __tests__/idService.test.ts
```

Expected: FAIL (module not found / exports missing)

- [ ] **Step 3: Implement `idService.ts`**

```ts
export const ID_ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';

export function generateCode(length = 6): string {
  let out = '';
  for (let i = 0; i < length; i++) {
    out += ID_ALPHABET[Math.floor(Math.random() * ID_ALPHABET.length)];
  }
  return out;
}

export function buildUri(baseUrl: string, code: string): string {
  const base = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
  return `${base}${code}`;
}

export function generateUniqueCodes(count: number, reserved: Set<string>): string[] {
  const result: string[] = [];
  const seen = new Set(reserved);
  let guard = 0;
  while (result.length < count) {
    const code = generateCode(6);
    if (!seen.has(code)) {
      seen.add(code);
      result.push(code);
    }
    guard += 1;
    if (guard > count * 1000) {
      throw new Error('Unable to generate unique NFC codes');
    }
  }
  return result;
}
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
npm test -- __tests__/idService.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add src/services/idService.ts __tests__/idService.test.ts
git commit -m "feat: add unique NFC ID generator service"
git push
```

---

### Task 4: `storageService` (TDD)

**Files:**
- Create: `src/services/storageService.ts`
- Test: `__tests__/storageService.test.ts`
- Modify: `jest.setup.js` (AsyncStorage mock)

**Interfaces:**
- Consumes: `ProductionRecord`, `BatchLot` from types
- Produces:
  - `listHistory(): Promise<ProductionRecord[]>`
  - `appendHistory(record: Omit<ProductionRecord, 'id' | 'createdAt'> & { id?: string; createdAt?: string }): Promise<ProductionRecord>`
  - `getReservedCodes(): Promise<Set<string>>`
  - `saveBatchLot(lot: BatchLot): Promise<void>`
  - `listBatchLots(): Promise<BatchLot[]>`
  - `updateBatchLot(lot: BatchLot): Promise<void>`

- [ ] **Step 1: Mock AsyncStorage in `jest.setup.js`**

Use `@react-native-async-storage/async-storage/jest/async-storage-mock`.

- [ ] **Step 2: Write failing tests**

Cover: append then list newest-first; `getReservedCodes` includes history URI suffixes and pending/used/skipped_reserved lot codes; save/update batch lot.

- [ ] **Step 3: Implement storage**

Keys:
- `@nfc/history` → `ProductionRecord[]`
- `@nfc/batchLots` → `BatchLot[]`

`appendHistory` generates `id` via `crypto.randomUUID()` or fallback, `createdAt` ISO now, prepends to list.

`getReservedCodes`: parse last path segment from each history `content` URL + all lot item codes.

- [ ] **Step 4: Tests PASS → commit**

```bash
git add src/services/storageService.ts __tests__/storageService.test.ts jest.setup.js
git commit -m "feat: add local storage service for history and batch lots"
git push
```

---

### Task 5: `nfcService` init + read (TDD with mocks)

**Files:**
- Create: `src/services/nfcService.ts`
- Test: `__tests__/nfcService.test.ts`
- Modify: `jest.setup.js` (NfcManager mock)

**Interfaces:**
- Consumes: `TagReadResult`, `NfcServiceError`
- Produces:
  - `init(): Promise<void>`
  - `isSupported(): Promise<boolean>`
  - `isEnabled(): Promise<boolean>`
  - `readTag(onDetected?: () => void): Promise<TagReadResult>`
  - `cancel(): Promise<void>`
  - internal helpers: `formatUid`, `summarizeNdefMessage`

- [ ] **Step 1: Expand NfcManager mock**

Mock: `start`, `isSupported`, `isEnabled`, `requestTechnology`, `cancelTechnologyRequest`, `getTag`, `ndefHandler.getNdefMessage`, `ndefHandler.writeNdefMessage`, plus `Ndef` encode/decode/uri helpers used by the service (or import real `Ndef` util if it is pure JS — prefer real `Ndef` from the package when possible).

- [ ] **Step 2: Failing tests**

Cases:
1. `init` calls `NfcManager.start`
2. `readTag` returns empty result when no records
3. `readTag` maps URI record content
4. `readTag` formats UID bytes as `04:A3:...`
5. cancel is always invoked (success and failure paths)

- [ ] **Step 3: Implement read path**

```ts
// Pseudo-structure — full implementation in nfcService.ts
async function readTag(onDetected?: () => void): Promise<TagReadResult> {
  try {
    await NfcManager.requestTechnology(NfcTech.Ndef);
    onDetected?.();
    const tag = await NfcManager.getTag();
    const msg = await NfcManager.ndefHandler.getNdefMessage();
    // map records with Ndef.uri.decodePayload / text helpers
    return { uid, records, content, isEmpty, isWritable, maxSize };
  } catch (e) {
    throw mapError(e);
  } finally {
    await NfcManager.cancelTechnologyRequest().catch(() => undefined);
  }
}
```

Map Android tag fields: `tag.id` → UID; `tag.isWritable`; `tag.maxSize` when present.

- [ ] **Step 4: Tests PASS → commit**

```bash
git commit -m "feat: implement NFC init and NDEF read in nfcService"
git push
```

---

### Task 6: `nfcService` write URI + verify

**Files:**
- Modify: `src/services/nfcService.ts`
- Modify: `__tests__/nfcService.test.ts`

**Interfaces:**
- Consumes: `readTag`, `TagReadResult`
- Produces:
  - `writeUri(uri: string, opts?: { onDetected?: () => void; allowOverwrite?: boolean }): Promise<{ uid: string | null; previousContent: string; wrote: boolean }>`
  - `writeUriAndVerify(uri: string, opts?: { onDetected?: () => void; onWriting?: () => void; onVerifying?: () => void; allowOverwrite?: boolean }): Promise<WriteVerifyResult>`

- [ ] **Step 1: Failing tests**

1. Empty tag → writes URI bytes via `Ndef.encodeMessage([Ndef.uriRecord(uri)])`
2. Non-empty + `allowOverwrite !== true` → throws before write (caller shows modal)
3. `writeUriAndVerify` success when read-back URI matches
4. Mismatch → `NfcServiceError('VERIFY_MISMATCH')`
5. `isWritable === false` → `TAG_NOT_WRITABLE`

Write flow detail for verify:
1. Session A: request tech → optional read existing → write → cancel
2. Session B: `readTag` → compare normalized URI strings

- [ ] **Step 2: Implement write + verify**

Normalize comparison: trim, lowercase host optional — keep **exact string match** of intended URI vs decoded URI for production safety (document in code comment).

- [ ] **Step 3: Tests PASS → commit**

```bash
git commit -m "feat: add NDEF URI write and verify to nfcService"
git push
```

---

### Task 7: UI primitives + `useNfcOperation`

**Files:**
- Create: `src/components/NfcStatusBanner.tsx`
- Create: `src/components/ConfirmOverwriteModal.tsx`
- Create: `src/components/PrimaryButton.tsx`
- Create: `src/hooks/useNfcOperation.ts`

**Interfaces:**
- Consumes: `NfcUiStatus`, `colors`
- Produces:
  - `<NfcStatusBanner status={NfcUiStatus} message?: string />`
  - `<ConfirmOverwriteModal visible content onConfirm onCancel />`
  - `<PrimaryButton label onPress variant? disabled? />`
  - `useNfcOperation()` → `{ status, error, setStatus, run(operation), reset() }`

- [ ] **Step 1: Implement components**

Status labels (ES):
```ts
const LABELS: Record<NfcUiStatus, string> = {
  IDLE: 'Listo',
  WAITING: 'Esperando NFC...',
  DETECTED: 'NFC detectado',
  READING: 'Leyendo...',
  WRITING: 'Escribiendo...',
  VERIFYING: 'Verificando...',
  COMPLETED: 'Completado',
  ERROR: 'Error',
};
```

Modal copy exact:
`Este NFC ya contiene información:` + content + `¿Deseas sobrescribirlo?`

- [ ] **Step 2: Hook**

`run` sets WAITING, invokes async fn that receives status setters, maps `NfcServiceError` → ERROR message in Spanish.

- [ ] **Step 3: Commit**

```bash
git commit -m "feat: add NFC status UI primitives and operation hook"
git push
```

---

### Task 8: Dashboard

**Files:**
- Create/Replace: `app/index.tsx`

**Interfaces:**
- Consumes: Expo Router `Link`/`router`, `PrimaryButton`
- Produces: Dashboard routes to `/write`, `/read`, `/rewrite`, `/batch`, `/history`, `/lock`

- [ ] **Step 1: Implement dashboard**

Title hero: **NFC Programmer** (brand-level).  
Five primary full-width buttons + secondary danger text button “Bloqueo permanente”.

- [ ] **Step 2: Smoke-check TypeScript**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git commit -m "feat: add NFC Programmer industrial dashboard"
git push
```

---

### Task 9: Read screen

**Files:**
- Create: `app/read.tsx`

**Interfaces:**
- Consumes: `nfcService.readTag`, `useNfcOperation`, `NfcStatusBanner`, `PrimaryButton`
- Produces: screen showing UID, record type, content, empty, writable, capacity

- [ ] **Step 1: Implement flow**

Button “Leer NFC” → status WAITING → onDetected DETECTED → READING → show fields → COMPLETED.

Display empties as “Vacío: sí/no”, writable “Escritura: sí/no/desconocido”, capacity “Capacidad: N bytes” or “—”.

- [ ] **Step 2: Commit**

```bash
git commit -m "feat: add NFC read screen"
git push
```

---

### Task 10: Write screen + history append

**Files:**
- Create: `app/write.tsx`

**Interfaces:**
- Consumes: `nfcService.writeUri` / `writeUriAndVerify`, `storageService.appendHistory`, overwrite modal
- Produces: checklist UI + persisted `WRITE` record

- [ ] **Step 1: Implement**

1. TextInput URL (default placeholder `https://midominio.com/nfc/`)
2. GRABAR NFC
3. First session probe: `readTag` or write path that returns `previousContent`
   - Practical approach: `writeUriAndVerify` accepts callback when existing content found and pauses via Promise + modal (`allowOverwrite` gate)
4. On success show:
   - ✓ NFC detectado
   - ✓ Escritura completada
   - ✓ Contenido verificado (or ✗ if verified false)
   - UID + content
5. `appendHistory({ uid, content: uri, operation: 'WRITE', verified })`

Recommended service helper addition if needed:

```ts
probeAndWriteUri(uri, { confirmOverwrite: async (existing) => boolean, onStatus })
```

Keep probe/confirm inside screen orchestration if clearer: read → modal → writeUriAndVerify with `allowOverwrite: true`.

- [ ] **Step 2: Commit**

```bash
git commit -m "feat: add NFC write screen with verify and history"
git push
```

---

### Task 11: Rewrite screen

**Files:**
- Create: `app/rewrite.tsx`

**Interfaces:**
- Consumes: same services as write
- Produces: two-step UI (read current → enter new URI → write/verify) + `REWRITE` history

- [ ] **Step 1: Implement**

Step A: “Leer NFC” → show current content + writable check (block if not writable).  
Step B: input new URI → confirm overwrite → writeUriAndVerify → history `REWRITE`.

- [ ] **Step 2: Commit**

```bash
git commit -m "feat: add NFC rewrite screen without locking"
git push
```

---

### Task 12: History screen

**Files:**
- Create: `app/history.tsx`

**Interfaces:**
- Consumes: `storageService.listHistory`
- Produces: list newest-first with operation, verified badge, uid, content, date

- [ ] **Step 1: Implement FlatList** + empty state “Sin registros aún”
- [ ] **Step 2: Commit**

```bash
git commit -m "feat: add NFC production history screen"
git push
```

---

### Task 13: Batch production screen

**Files:**
- Create: `app/batch.tsx`

**Interfaces:**
- Consumes: `idService`, `storageService`, `nfcService.writeUriAndVerify`, overwrite modal
- Produces: lot persistence + sequential TAG k/N programming

- [ ] **Step 1: Unit-test lot builder (optional small pure fn in batch helpers)**

`createLot(baseUrl, quantity, reserved): BatchLot` using `generateUniqueCodes` + `buildUri`.

- [ ] **Step 2: Implement screen**

1. Inputs: base URL, quantity
2. “Iniciar serie” → build lot → `saveBatchLot` → index 0
3. Show `TAG k / N` + Esperando NFC
4. On tag: overwrite gate → write/verify → `appendHistory` WRITE → mark item `used` → `updateBatchLot` → advance
5. On failure: buttons Reintentar / Saltar (status `skipped_reserved`) / Abortar
6. Summary at end

- [ ] **Step 3: Commit**

```bash
git commit -m "feat: add serial NFC batch programming mode"
git push
```

---

### Task 14: `apiService` stub + Lock placeholder

**Files:**
- Create: `src/services/apiService.ts`
- Create: `app/lock.tsx`

**Interfaces:**
- Consumes: `ProductionRecord` types
- Produces:
  - `apiService.listHistory(): Promise<ProductionRecord[]>` (throws `NOT_IMPLEMENTED` or returns `[]` with comment)
  - `apiService.appendHistory(...): Promise<ProductionRecord>` stub
  - Lock screen with irreversible warning copy; primary actions disabled / “No autorizado aún”

- [ ] **Step 1: apiService**

```ts
export const apiService = {
  async listHistory(): Promise<ProductionRecord[]> {
    throw new Error('API REST no configurada todavía');
  },
  async appendHistory(_input: Omit<ProductionRecord, 'id' | 'createdAt'>): Promise<ProductionRecord> {
    throw new Error('API REST no configurada todavía');
  },
};
```

Screens continue using `storageService` only.

- [ ] **Step 2: Lock screen**

Show ADVERTENCIA text from user requirements. Explain static lock page `02h` + dynamic `28h`, irreversibility. Buttons “Continuar” lead to second confirm that still ends in “Función no habilitada — pendiente de autorización”. **No NFC write calls.**

- [ ] **Step 3: Commit**

```bash
git commit -m "feat: add API stub and non-destructive lock placeholder screen"
git push
```

---

### Task 15: README + final verification

**Files:**
- Create: `README.md`

**Interfaces:**
- Consumes: whole app
- Produces: build/run instructions for Android Development Build

- [ ] **Step 1: README contents**

Include:
- `npm install`
- `npx expo prebuild --platform android`
- `npx expo run:android` (device with NFC)
- Note: Expo Go unsupported
- Scope: no irreversible lock yet
- Manual test checklist matching Success criteria in spec §11

- [ ] **Step 2: Run automated tests**

```bash
npm test
npx tsc --noEmit
```

Expected: all unit tests PASS; no TS errors.

- [ ] **Step 3: Final commit + push**

```bash
git add README.md
git commit -m "docs: add Android Development Build instructions and test checklist"
git push
```

---

## Self-review (plan vs spec)

| Spec requirement | Task |
|---|---|
| Init NFC | 5 |
| Read NDEF + metadata | 5, 9 |
| Write URI | 6, 10 |
| Verify after write | 6, 10 |
| Rewrite without lock | 11 |
| Overwrite confirmation | 7, 10, 11, 13 |
| History records | 4, 10–13 |
| Batch unique IDs | 3, 13 |
| apiService stub | 14 |
| Lock deferred + warnings | 14 |
| Industrial dashboard | 8 |
| Service separation | 3–6 |
| Android Expo Dev Build | 1, 15 |
| No irreversible lock code | All tasks — enforced in Global Constraints + Task 14 |

**Placeholder scan:** none intentional.  
**Type consistency:** `ProductionRecord`, `WriteVerifyResult`, `NfcUiStatus` shared from Task 2 across later tasks.

---

## Out of scope (do not implement in this plan)

- NTAG213 static/dynamic lock `transceive` payloads
- `makeReadOnly()` as production lock
- iOS
- Real REST backend
