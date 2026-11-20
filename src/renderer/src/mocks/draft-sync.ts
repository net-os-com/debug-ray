import type { MockService } from '../../../shared/mocks/types'

/**
 * The draft beside its file: `base` is the draft as it last matched the file,
 * and `onDisk` says the draft was read from or written to a file.
 */
export type DraftSync = {
  draft: MockService | null
  base: string | null
  onDisk: boolean
}

export const NO_DRAFT: DraftSync = { draft: null, base: null, onDisk: false }

export function isDirty({ draft, base }: DraftSync): boolean {
  return draft !== null && JSON.stringify(draft) !== base
}

export function fromDisk(saved: MockService | null): DraftSync {
  return saved === null ? NO_DRAFT : { draft: saved, base: JSON.stringify(saved), onDisk: true }
}

/**
 * The draft once the file is read again: it follows the file while untouched,
 * keeps edits the file does not have, and is null when its file is gone.
 */
export function followDisk(current: DraftSync, saved: MockService | null): DraftSync | null {
  if (saved === null) {
    return current.onDisk && !isDirty(current) ? null : current
  }

  const snapshot = JSON.stringify(saved)
  // The file and its hash come from disk, not from the editing.
  const writtenByDraft =
    current.draft !== null &&
    JSON.stringify({ ...current.draft, file: saved.file, hash: saved.hash }) === snapshot

  return (!isDirty(current) || writtenByDraft) && current.base !== snapshot ? fromDisk(saved) : current
}

/** A save of `sent` landed: edits made while it ran stay, on the file it wrote. */
export function afterSave(
  current: DraftSync,
  sent: MockService,
  written: { file: string; hash: string },
): DraftSync {
  const stamp = { name: sent.name, file: written.file, hash: written.hash }

  return {
    draft: current.draft === null ? null : { ...current.draft, ...stamp },
    base: JSON.stringify({ ...sent, ...stamp }),
    onDisk: true,
  }
}
