/**
 * Whether the stream is paused, and since when.
 *
 * Owned by the main process, so the window, the menu bar panel and the icon
 * all see one pause, and a window that opens while it holds can tell what
 * arrived before it from what arrived since.
 */
export type PauseState = {
  paused: boolean
  /** Epoch milliseconds the pause began; null while the stream runs. */
  since: number | null
}
