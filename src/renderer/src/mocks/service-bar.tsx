import type { MockService } from '../../../shared/mocks/types'
import { StrokeIcon } from '../chrome/module-icons'
import { relativeTime } from '../relative-time'
import { CopyButton } from '../ui/copy-button'
import { useNow } from '../use-now'

const RELOAD_PATH =
  'M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99'
const TRASH_PATH =
  'm14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0'

/** Where the platform finds the mock server from inside its container. */
export function envLine(name: string): string {
  const url = `http://host.docker.internal:23517/mock/${name}`

  return name === 'balena' ? `BALENA_API_URL=${url}` : url
}

type ServiceBarProps = {
  service: MockService
  container: string
  loadedAt: number | null
  busy: boolean
  onTitle: (title: string) => void
  onReload: () => void
  onDelete: () => void
}

export function ServiceBar({
  service,
  container,
  loadedAt,
  busy,
  onTitle,
  onReload,
  onDelete,
}: ServiceBarProps) {
  const now = useNow(loadedAt !== null)
  const line = envLine(service.name)

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
