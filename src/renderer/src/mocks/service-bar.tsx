import type { MockService } from '../../../shared/mocks/types'
import { StrokeIcon } from '../chrome/module-icons'
import { relativeTime } from '../relative-time'
import { CopyButton } from '../ui/copy-button'
import { useNow } from '../use-now'
import { TRASH_PATH } from './icon-paths'

const RELOAD_PATH =
  'M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99'

/** Where the platform finds the mock server from inside its container. */
export function envLine(name: string, port: number): string {
  const url = `http://host.docker.internal:${port}/mock/${name}`

  return name === 'balena' ? `BALENA_API_URL=${url}` : url
}

type ServiceBarProps = {
  service: MockService
  container: string
  loadedAt: number | null
  busy: boolean
  port: number
  dirty: boolean
  onSave: () => void
  onDiscard: () => void
  onTitle: (title: string) => void
  onReload: () => void
  onDelete: () => void
}

export function ServiceBar({
  service,
  container,
  loadedAt,
  busy,
  port,
  dirty,
  onSave,
  onDiscard,
  onTitle,
  onReload,
  onDelete,
}: ServiceBarProps) {
  const now = useNow(loadedAt !== null)
  const line = envLine(service.name, port)

  return (
    <div className="mk-bar">
      <input
        aria-label="Service name"
        className="mk-bar__title"
        onChange={(event) => onTitle(event.target.value)}
        value={service.title}
      />

      <div className="mk-bar__env">
        <label className="mk-bar__hint" htmlFor="mk-env-line">
          In your .env
        </label>
        <input className="mk-bar__line" id="mk-env-line" readOnly value={line} />
        <CopyButton label="Copy" text={line} />
      </div>

      <div className="mk-bar__source">
        <span className="mk-bar__hint">
          {service.file === '' ? (
            'Not saved yet'
          ) : (
            <>
              <span className="mk-bar__file">{service.file}</span> from {container}
              {loadedAt === null ? '' : ` · loaded ${relativeTime(loadedAt, now)}`}
            </>
          )}
        </span>
        {dirty ? (
          <>
            <span className="mk-bar__hint">Unsaved changes</span>
            <button className="button" onClick={onDiscard} type="button">
              Discard
            </button>
            <button className="button button--primary" onClick={onSave} type="button">
              Save
            </button>
          </>
        ) : null}
        <button
          aria-label="Reload fixtures"
          className="mk-icon-button"
          disabled={busy}
          onClick={onReload}
          title="Reload fixtures"
          type="button"
        >
          <StrokeIcon path={RELOAD_PATH} size={15} />
        </button>
        <button
          aria-label="Delete service"
          className="mk-icon-button mk-icon-button--danger"
          onClick={onDelete}
          title="Delete service"
          type="button"
        >
          <StrokeIcon path={TRASH_PATH} size={15} />
        </button>
      </div>
    </div>
  )
}
