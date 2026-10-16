import { dialog, BrowserWindow } from 'electron'
import { writeFile } from 'node:fs/promises'

export type SaveRequest = {
  /** What the save sheet offers as the name. */
  name: string
  /** Shown beside the extension in the sheet. */
  what: string
  extension: string
  /** Text, or base64 when the file is binary. */
  data: string
  base64: boolean
}

/**
 * Asks where to put a file, then writes it.
 *
 * The sheet is the permission: nothing is written anywhere until somebody has
 * named a place for it, and cancelling leaves the disk untouched.
 */
export async function saveFile(
  window: BrowserWindow | null,
  request: SaveRequest,
): Promise<{ path: string | null; error: string | null }> {
  const sheet = await (window === null
    ? dialog.showSaveDialog({ defaultPath: request.name })
    : dialog.showSaveDialog(window, {
        defaultPath: request.name,
        filters: [{ name: request.what, extensions: [request.extension] }],
      }))

  if (sheet.canceled || sheet.filePath === undefined) {
    return { path: null, error: null }
  }

  try {
    await writeFile(
      sheet.filePath,
      request.base64 ? Buffer.from(request.data, 'base64') : request.data,
    )

    return { path: sheet.filePath, error: null }
  } catch (error) {
    return { path: null, error: error instanceof Error ? error.message : 'The file was not written.' }
  }
}
