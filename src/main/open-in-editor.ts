import { shell } from 'electron'
import type { MainSettings } from './settings'

/**
 * How each editor wants to be handed a file and a line.
 *
 * All of these are URL schemes rather than CLI calls, so opening a file does
 * not depend on anything being on PATH.
 */
const SCHEMES: Record<string, (file: string, line: number) => string> = {
  phpstorm: (file, line) => `phpstorm://open?file=${encodeURIComponent(file)}&line=${line}`,
  vscode: (file, line) => `vscode://file/${encodeURI(file)}:${line}`,
  cursor: (file, line) => `cursor://file/${encodeURI(file)}:${line}`,
  sublime: (file, line) => `subl://open?url=file://${encodeURI(file)}&line=${line}`,
}

/**
 * Rewrites a path as the sender saw it into one that exists on this machine.
 *
 * Payloads from a container carry container paths — `/var/www/html/app/...` —
 * which no editor here can open. Ray has the same idea in its own
 * remote_path/local_path settings; this applies it on the receiving side, where
 * the person configuring it can actually see the result.
 */
export function toLocalPath(file: string, settings: MainSettings): string {
  const { remotePath, localPath } = settings

  if (!remotePath || !localPath || !file.startsWith(remotePath)) {
    return file
  }

  return localPath + file.slice(remotePath.length)
}

/** Returns false when no editor is configured or the choice is unknown. */
export function openInEditor(file: string, line: number, settings: MainSettings): boolean {
  const scheme = SCHEMES[settings.editor]

  if (!scheme || !file) {
    return false
  }

  shell.openExternal(scheme(toLocalPath(file, settings), Math.max(1, line)))

  return true
}
