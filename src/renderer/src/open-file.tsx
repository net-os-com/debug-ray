import { useSettingsValue } from './settings-context'

type OpenFileProps = {
  file: string | null | undefined
  line: number | string | null | undefined
  children: React.ReactNode
  className?: string
}

/**
 * Renders a file reference as a button when an editor is configured, and as
 * plain text when none is. Without this the label would look clickable to
 * someone who never set an editor and then do nothing.
 */
export function OpenFile({ file, line, children, className }: OpenFileProps) {
  const { editor } = useSettingsValue()

  if (editor === 'none' || !file) {
    return <span className={className}>{children}</span>
  }

  return (
    <button
      className={className ? `${className} open-file` : 'open-file'}
      onClick={(event) => {
        event.stopPropagation()
        void window.ray.openInEditor(file, Number(line) || 1)
      }}
      title={`Open ${file} in your editor`}
      type="button"
    >
      {children}
    </button>
  )
}
