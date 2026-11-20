import { useCallback, useEffect, useMemo, useState } from 'react'
import type { MockService } from '../../../shared/mocks/types'
import type { MocksData } from './use-mocks'

export type MockSelection =
  | { service: string; kind: 'endpoint' | 'webhook'; id: string }
  | { service: string; kind: 'service' }
  | null

/**
 * The service being edited, as a draft beside the one on disk.
 *
 * The draft is the loaded service until something edits it; it is dirty while
 * it differs from the loaded one, and a reload from disk replaces it only when
 * it is not.
 */
export function useMockEditor(mocks: MocksData) {
  const [selection, setSelection] = useState<MockSelection>(null)
  const [draft, setDraft] = useState<MockService | null>(null)

  const services = mocks.state.services
  const saved = useMemo(
    () => services.find((one) => one.name === selection?.service) ?? null,
    [services, selection?.service],
  )

  const [base, setBase] = useState<string | null>(null)

  const snapshot = JSON.stringify(saved)
  const dirty = draft !== null && JSON.stringify(draft) !== base

  // The file and its hash come from disk, not from the editing.
  const savedAsDraft =
    draft !== null && saved !== null
      ? JSON.stringify({ ...draft, file: saved.file, hash: saved.hash }) === snapshot
      : false

  useEffect(() => {
    if (selection === null) {
      setDraft(null)
      setBase(null)

      return
    }

    // Untouched, or just written by this very draft: follow what is on disk.
    if (saved !== null && (!dirty || savedAsDraft) && base !== snapshot) {
      setDraft(saved)
      setBase(snapshot)
    }
  }, [selection, saved, snapshot, dirty, savedAsDraft, base])

  const select = useCallback(
    (next: MockSelection): void => {
      const leaving = next === null || next.service !== selection?.service

      if (leaving && dirty && !window.confirm('Discard unsaved changes?')) {
        return
      }

      if (leaving) {
        setDraft(null)
        setBase(null)
      }

      setSelection(next)
    },
    [dirty, selection?.service],
  )

  const edit = useCallback((change: (s: MockService) => MockService): void => {
    setDraft((current) => (current === null ? current : change(current)))
  }, [])

  const discard = useCallback((): void => {
    setDraft(saved)
    setBase(saved === null ? null : JSON.stringify(saved))

    if (saved === null) {
      setSelection(null)
    }
  }, [saved])

  const create = useCallback(
    (service: MockService): void => {
      if (dirty && !window.confirm('Discard unsaved changes?')) {
        return
      }

      setDraft(service)
      setBase(null)
      setSelection({ service: service.name, kind: 'service' })
    },
    [dirty],
  )

  const save = useCallback(async (): Promise<string | null> => {
    if (draft === null) {
      return null
    }

    return mocks.save(draft)
  }, [draft, mocks])

  return { selection, select, draft, dirty, edit, discard, save, create }
}
