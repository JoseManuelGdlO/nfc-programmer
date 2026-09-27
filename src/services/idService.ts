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
