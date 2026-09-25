import { useCallback, useMemo, useState } from 'react'
import type { Snippet } from '../../../shared/tinker'

const STARTER = "use Illuminate\\Support\\Str;\n\nreturn Str::slug('Hello there');"

/** Everything the snippet list and the editor share. */
export type SnippetsState = ReturnType<typeof useSnippets>

function firstSnippet(): Snippet {
  return { id: newId(), name: 'Untitled snippet', code: STARTER, updatedAt: Date.now() }
}

/**
 * Owns the saved snippets and the draft of the one being edited.
 *
 * Drafts deliberately do not persist: what is on disk is what you saved, so the
 * dot next to a name means the same thing after a restart as it does now.
 */
export function useSnippets() {
  const [saved, setSaved] = useState<Snippet[]>(() => {
    const stored = window.ray.readSnippets()

    return stored.length > 0 ? stored : [firstSnippet()]
  })

  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [activeId, setActiveId] = useState<string>(() => saved[0]?.id ?? '')
  const [query, setQuery] = useState('')

  const persist = useCallback((list: Snippet[]) => {
    setSaved(list)
    window.ray.writeSnippets(list)
  }, [])

  const active = useMemo(
    () => saved.find((snippet) => snippet.id === activeId) ?? saved[0] ?? firstSnippet(),
    [saved, activeId],
  )

  const code = drafts[active.id] ?? active.code
  const dirty = code !== active.code

  const setCode = useCallback(
    (next: string) => setDrafts((current) => ({ ...current, [active.id]: next })),
    [active.id],
  )

  const rename = useCallback(
    (name: string) =>
      persist(saved.map((snippet) => (snippet.id === active.id ? { ...snippet, name } : snippet))),
    [persist, saved, active.id],
  )

  const save = useCallback(() => {
    persist(
      saved.map((snippet) =>
        snippet.id === active.id ? { ...snippet, code, updatedAt: Date.now() } : snippet,
      ),
    )

    setDrafts((current) => {
      const next = { ...current }
      delete next[active.id]

      return next
    })
  }, [persist, saved, active.id, code])

  const create = useCallback(() => {
    const snippet = firstSnippet()

    persist([snippet, ...saved])
    setActiveId(snippet.id)
    setQuery('')
  }, [persist, saved])

  const remove = useCallback(
    (id: string) => {
      const left = saved.filter((snippet) => snippet.id !== id)
      const list = left.length > 0 ? left : [firstSnippet()]

      persist(list)
      setDrafts((current) => {
        const next = { ...current }
        delete next[id]

        return next
      })

      if (id === activeId) {
        setActiveId(list[0]?.id ?? '')
      }
    },
    [persist, saved, activeId],
  )

  // Searching the code as well as the name, because you remember what a snippet
  // did more often than what you called it.
  const shown = useMemo(() => {
    const needle = query.trim().toLowerCase()

    if (needle === '') {
      return saved
    }

    return saved.filter((snippet) =>
      `${snippet.name} ${drafts[snippet.id] ?? snippet.code}`.toLowerCase().includes(needle),
    )
  }, [saved, drafts, query])

  return {
    shown,
    active,
    activeId: active.id,
    select: setActiveId,
    code,
    setCode,
    dirty,
    dirtyIds: useMemo(
      () => new Set(saved.filter((s) => (drafts[s.id] ?? s.code) !== s.code).map((s) => s.id)),
      [saved, drafts],
    ),
    save,
    create,
    remove,
    rename,
    query,
    setQuery,
  }
}

function newId(): string {
  return `s${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`
}
