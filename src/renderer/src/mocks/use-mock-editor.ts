import { useCallback, useEffect, useMemo, useState } from 'react'
import type { MockService } from '../../../shared/mocks/types'
import { updateWebhook } from './edit-service'
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
export type MockEditor = ReturnType<typeof useMockEditor>

export function useMockEditor(mocks: MocksData) {
  const [selection, setSelection] = useState<MockSelection>(null)
  const [draft, setDraft] = useState<MockService | null>(null)

  const services = mocks.state.services
  const saved = useMemo(
    () => services.find((one) => one.name === selection?.service) ?? null,
    [services, selection?.service],
  )

  const [oneOff, setOneOff] = useState<{ key: string; body: string } | null>(null)

  const oneOffKey = selection?.kind === 'webhook' ? `${selection.service}/${selection.id}` : null
  const oneOffBody = oneOff !== null && oneOff.key === oneOffKey ? oneOff.body : null

  const setOneOffBody = useCallback(
    (body: string | null): void => {
      setOneOff(body === null || oneOffKey === null ? null : { key: oneOffKey, body })
    },
    [oneOffKey],
  )

  const [base, setBase] = useState<string | null>(null)
  const [onDisk, setOnDisk] = useState(false)

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
      setOnDisk(false)

      return
    }

    // It was read from disk and the file is gone: deleted here or by hand.
    if (saved === null && onDisk && !dirty) {
      setDraft(null)
      setBase(null)
      setOnDisk(false)
      setSelection(null)

      return
    }

    // Untouched, or just written by this very draft: follow what is on disk.
    if (saved !== null && (!dirty || savedAsDraft) && base !== snapshot) {
      setDraft(saved)
      setBase(snapshot)
      setOnDisk(true)
    }
  }, [selection, saved, snapshot, dirty, savedAsDraft, base, onDisk])

  const select = useCallback(
    (next: MockSelection): void => {
      const leaving = next === null || next.service !== selection?.service

      if (leaving && dirty && !window.confirm('Discard unsaved changes?')) {
        return
      }

      if (leaving) {
        setDraft(null)
        setBase(null)
        setOnDisk(false)
      }

      if (next?.kind !== 'webhook' || `${next.service}/${next.id}` !== oneOffKey) {
        setOneOff(null)
      }

      setSelection(next)
    },
    [dirty, selection?.service, oneOffKey],
  )

  const edit = useCallback((change: (s: MockService) => MockService): void => {
    setDraft((current) => (current === null ? current : change(current)))
  }, [])

  const discard = useCallback((): void => {
    setDraft(saved)
    setBase(saved === null ? null : JSON.stringify(saved))
    setOnDisk(saved !== null)

    if (saved === null) {
      setSelection(null)
    }
  }, [saved])

  const saveOneOff = useCallback((): void => {
    if (selection?.kind !== 'webhook' || oneOffBody === null) {
      return
    }

    const { id } = selection

    setDraft((current) => (current === null ? current : updateWebhook(current, id, { body: oneOffBody })))
    setOneOff(null)
  }, [selection, oneOffBody])

  const create = useCallback(
    (service: MockService): void => {
      if (dirty && !window.confirm('Discard unsaved changes?')) {
        return
      }

      setDraft(service)
      setBase(null)
      setOnDisk(false)
      setSelection({ service: service.name, kind: 'service' })
    },
    [dirty],
  )

  const save = useCallback(async (): Promise<string | null> => {
    if (draft === null) {
      return null
    }

    if (draft.title.trim() === '') {
      return 'Give the service a title.'
    }

    const error = await mocks.save(draft)

    // Rebased on what was just written, so it is clean whatever shape the file
    // comes back in; the reload then replaces the draft with the real thing.
    if (error === null) {
      setBase(JSON.stringify(draft))
    }

    return error
  }, [draft, mocks])

  return {
    selection,
    select,
    draft,
    dirty,
    edit,
    discard,
    save,
    create,
    oneOffBody,
    setOneOffBody,
    saveOneOff,
  }
}
