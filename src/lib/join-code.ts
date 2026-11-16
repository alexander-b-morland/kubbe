// Join codes are typed by hand on a phone, so the alphabet leaves out the
// look-alikes I, O, 0 and 1. It has 32 symbols, which keeps random bytes unbiased.
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export const JOIN_CODE_LENGTH = 6;

export function generateJoinCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(JOIN_CODE_LENGTH));
  return Array.from(bytes, (byte) => ALPHABET[byte & 31]).join("");
}

/** Tidy up what a person typed: any case, with spaces or dashes. */
export function normaliseJoinCode(input: string): string {
  return input.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function isJoinCode(code: string): boolean {
  return code.length === JOIN_CODE_LENGTH && [...code].every((char) => ALPHABET.includes(char));
}

/** "ABC DEF": easier to read aloud and copy. */
export function formatJoinCode(code: string): string {
  return `${code.slice(0, 3)} ${code.slice(3)}`;
}
