/** The package's refusal of a stale save, with what to do about it in this view. */
export function withConflictHint(error: string | null): string | null {
  return error !== null && error.includes(' changed on disk. ')
    ? `${error} Copy your edits, then Discard to load the file.`
    : error
}
