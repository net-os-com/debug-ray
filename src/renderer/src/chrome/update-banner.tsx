import type { UpdateStatus } from '../../../shared/ray-event'

/**
 * Says an update exists and waits to be asked. Nothing downloads on its own —
 * a release is well over a hundred megabytes, and a debug tool has no business
 * spending someone's bandwidth without being told to.
 */
export function UpdateBanner({ status }: { status: UpdateStatus }) {
  if (status.phase === 'idle') {
    return null
  }

  return (
    <div className={status.phase === 'error' ? 'update update--error' : 'update'}>
      <span className="update__text">{message(status)}</span>
      {action(status)}
    </div>
  )
}

function message(status: UpdateStatus): string {
  switch (status.phase) {
    case 'available':
      return `NetOS Debug ${status.version} is available.`
    case 'downloading':
      return `Downloading ${status.version}… ${status.percent}%`
    case 'ready':
      return `NetOS Debug ${status.version} is ready to install.`
    case 'error':
      return `Could not fetch the update: ${status.error ?? 'unknown error'}`
    default:
      return ''
  }
}

function action(status: UpdateStatus) {
  if (status.phase === 'available') {
    return (
      <button className="button button--primary" onClick={window.ray.downloadUpdate} type="button">
        Download
      </button>
    )
  }

  if (status.phase === 'ready') {
    return (
      <button className="button button--primary" onClick={window.ray.installUpdate} type="button">
        Restart and install
      </button>
    )
  }

  if (status.phase === 'error') {
    return (
      <button className="button" onClick={window.ray.checkForUpdate} type="button">
        Try again
      </button>
    )
  }

  return null
}
