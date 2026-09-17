// Mention-handle helper — one regex builder so the @handle spelling lives in
// brand.mentionHandle / protocol MENTION_HANDLE, not in a dozen literals.
export function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Match @handle at a word boundary, preceded by start or whitespace (case-insensitive). */
export function mentionRegex(handle: string): RegExp {
  return new RegExp(`(^|\\s)@${escapeRegExp(handle)}\\b`, 'i');
}
