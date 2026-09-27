import { generateCode, generateUniqueCodes, buildUri, ID_ALPHABET } from '../src/services/idService';

test('alphabet excludes ambiguous characters', () => {
  expect(ID_ALPHABET).not.toMatch(/[01IOL]/);
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
