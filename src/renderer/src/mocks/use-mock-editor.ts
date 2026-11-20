import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { MockService } from '../../../shared/mocks/types'
import { withConflictHint } from './conflict-hint'
import { NO_DRAFT, afterSave, followDisk, fromDisk, isDirty, type DraftSync } from './draft-sync'
import { retitle as retitleService, updateWebhook } from './edit-service'
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
  const [sync, setSync] = useState<DraftSync>(NO_DRAFT)
  // Changes whenever the draft stops being the one a save in flight was made from.
  const lineage = useRef(0)

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

  const { draft } = sync
  const dirty = isDirty(sync)

  const replace = useCallback((next: DraftSync): void => {
    lineage.current += 1
    setSync(next)
  }, [])

  useEffect(() => {
    if (selection === null) {
      if (sync !== NO_DRAFT) {
        replace(NO_DRAFT)
      }

      return
    }

    const next = followDisk(sync, saved)

    if (next === null) {
      replace(NO_DRAFT)
      setSelection(null)
    } else if (next !== sync) {
      setSync(next)
    }
  }, [selection, saved, sync, replace])

  const select = useCallback(
    (next: MockSelection): void => {
      const leaving = next === null || next.service !== selection?.service

      if (leaving && dirty && !window.confirm('Discard unsaved changes?')) {
        return
      }

      if (leaving) {
        replace(NO_DRAFT)
      }

      if (next?.kind !== 'webhook' || `${next.service}/${next.id}` !== oneOffKey) {
        setOneOff(null)
      }

      setSelection(next)
    },
    [dirty, selection?.service, oneOffKey, replace],
  )

  const edit = useCallback((change: (s: MockService) => MockService): void => {
    setSync((current) => (current.draft === null ? current : { ...current, draft: change(current.draft) }))
  }, [])

  const retitle = useCallback(
    (title: string): void => {
      if (draft === null) {
        return
      }

      const others = services.map((one) => one.name)
      const { name } = retitleService(draft, title, others)

      edit((s) => retitleService(s, title, others))
      setSelection((current) => (current === null || current.service === name ? current : { ...current, service: name }))
    },
    [draft, services, edit],
  )

  const discard = useCallback((): void => {
    replace(fromDisk(saved))

    if (saved === null) {
      setSelection(null)
    }
  }, [saved, replace])

  const saveOneOff = useCallback((): void => {
    if (selection?.kind !== 'webhook' || oneOffBody === null) {
      return
    }

    const { id } = selection

    edit((s) => updateWebhook(s, id, { body: oneOffBody }))
    setOneOff(null)
  }, [selection, oneOffBody, edit])

  const create = useCallback(
    (service: MockService): void => {
      if (dirty && !window.confirm('Discard unsaved changes?')) {
        return
      }

      replace({ draft: service, base: null, onDisk: false })
      setSelection({ service: service.name, kind: 'service' })
    },
    [dirty, replace],
  )

  const save = useCallback(async (): Promise<string | null> => {
    if (draft === null) {
      return null
    }

    if (draft.title.trim() === '') {
      return 'Give the service a title.'
    }

    const started = lineage.current
    const { error, hash, file } = await mocks.save(draft)

    if (error === null && hash !== null && lineage.current === started) {
      setSync((current) => afterSave(current, draft, { file, hash }))
      setSelection((current) =>
        current === null || current.service === draft.name ? current : { ...current, service: draft.name },
      )
    }

    return withConflictHint(error)
  }, [draft, mocks])

  return {
    selection,
    select,
    draft,
    dirty,
    edit,
    retitle,
    discard,
    save,
    create,
    oneOffBody,
    setOneOffBody,
    saveOneOff,
  }
}
