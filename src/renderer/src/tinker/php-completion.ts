import type { Completion } from '../ui/code-editor'
import { applyCompletion, classToken } from './completion'
import { searchClasses, type ClassIndex } from './rank-classes'

/**
 * The PHP side of the editor, bundled for the shell.
 *
 * It lives here rather than in the editor so the editor does not know what a
 * class is; the ERD passes no completion at all.
 */
export function phpCompletion(classes: ClassIndex): Completion | null {
  if (classes.length === 0) {
    return null
  }

  return {
    tokenAt: (code, caret) => classToken(code, caret),
    search: (token) => searchClasses(classes, token),
    apply: (code, caret, entry) => {
      const token = classToken(code, caret)

      return token === null ? { code, caret } : applyCompletion(code, token, entry.fqcn)
    },
  }
}
