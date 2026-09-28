import { useCallback, useEffect, useMemo, useState } from 'react'
import type { TinkerContainer } from '../../../shared/tinker'
import type { ArtisanCommand } from '../../../shared/tools'
import { buildArgv, commandLine, isDestructive, type ArtisanValues } from './build-argv'
import { useExecStream } from './use-exec-stream'

const NO_VALUES: ArtisanValues = { args: {}, options: {} }

export type ArtisanState = ReturnType<typeof useArtisan>

export function useArtisan(container: TinkerContainer | null) {
  const [commands, setCommands] = useState<ArtisanCommand[]>([])
  const [query, setQuery] = useState('')
  const [name, setName] = useState<string | null>(null)
  const [values, setValues] = useState<ArtisanValues>(NO_VALUES)
  /** Set once a destructive command has been asked for but not yet confirmed. */
  const [armed, setArmed] = useState(false)
  const stream = useExecStream()

  useEffect(() => {
    if (container === null || !container.running) {
      setCommands([])

      return
    }

    let cancelled = false

    void window.ray
      .getArtisanCommands(container.id, container.workingDir)
      .then((found) => {
        if (!cancelled) {
          setCommands(found)
        }
      })
      .catch(() => undefined)

    return () => {
      cancelled = true
    }
  }, [container])

  const selected = useMemo(
    () => commands.find((command) => command.name === name) ?? null,
    [commands, name],
  )

  const shown = useMemo(() => {
    const needle = query.trim().toLowerCase()

    if (needle === '') {
      return commands
    }

    return commands.filter((command) =>
      `${command.name} ${command.description}`.toLowerCase().includes(needle),
    )
  }, [commands, query])

  const select = useCallback((next: string) => {
    setName(next)
    // Values belong to the command they were typed for.
    setValues(NO_VALUES)
    setArmed(false)
  }, [])

  const setArg = useCallback((argument: string, value: string) => {
    setValues((current) => ({ ...current, args: { ...current.args, [argument]: value } }))
  }, [])

  const setOption = useCallback((option: string, value: string | boolean) => {
    setValues((current) => ({ ...current, options: { ...current.options, [option]: value } }))
  }, [])

  const argv = useMemo(
    () =>
      container === null || selected === null ? null : buildArgv(container, selected, values),
    [container, selected, values],
  )

  const missing = useMemo(
    () =>
      selected === null
        ? []
        : selected.arguments
            .filter((argument) => argument.required && (values.args[argument.name] ?? '').trim() === '')
            .map((argument) => argument.name),
    [selected, values],
  )

  const run = useCallback(() => {
    if (argv === null || selected === null || missing.length > 0) {
      return
    }

    if (isDestructive(selected.name) && !armed) {
      setArmed(true)

      return
    }

    setArmed(false)
    void stream.start(argv)
  }, [argv, selected, missing, armed, stream])

  return {
    commands: shown,
    total: commands.length,
    selected,
    select,
    query,
    setQuery,
    values,
    setArg,
    setOption,
    missing,
    armed,
    disarm: useCallback(() => setArmed(false), []),
    preview: argv === null ? '' : commandLine(argv),
    run,
    stream,
  }
}
