/**
 * Permission bits of a mounted secret or config, octal on screen and decimal
 * on the wire.
 *
 * The API carries the mode as a plain number because that is what JSON has,
 * but nobody reasons about file permissions in decimal: 288 is meaningless
 * where 0444 is immediate. These two functions are the only place the two
 * representations meet.
 */

/** Permission bits applied when none was chosen — Docker's own default. */
export const DEFAULT_FILE_MODE = 0o444;

/** Formats stored bits for display, e.g. 288 → "0444". Zero means "not
 *  chosen", and the server then applies DEFAULT_FILE_MODE. */
export function formatFileMode(mode: number | undefined): string {
  if (!mode) return '';
  return '0' + mode.toString(8).padStart(3, '0');
}

/**
 * Reads what the user typed, accepting "444", "0444" or "0o444" — the leading
 * zero matters, since it is the form formatFileMode itself produces.
 *
 * Returns 0 for an empty field — "not chosen", which the server turns into the
 * default — and undefined for anything that is not three octal digits, so the
 * caller can keep the Save button disabled rather than send a mode that would
 * come back as a 422. "4755" is therefore refused here as well: the setuid bit
 * is not a permission bit, and Swarm does not take it.
 */
export function parseFileMode(input: string): number | undefined {
  const text = input.trim().replace(/^0o?/i, '');
  if (text === '') return 0;
  if (!/^[0-7]{1,3}$/.test(text)) return undefined;
  return parseInt(text, 8);
}
