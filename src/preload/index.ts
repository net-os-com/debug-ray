import { contextBridge, ipcRenderer } from 'electron'
import type { RayEvent, ServerStatus } from '../shared/ray-event'

const api = {
  onEvent(listener: (event: RayEvent) => void): () => void {
    const handler = (_: unknown, event: RayEvent): void => listener(event)

    ipcRenderer.on('ray:event', handler)

    return () => {
      ipcRenderer.off('ray:event', handler)
    }
  },

  onStatus(listener: (status: ServerStatus) => void): () => void {
    const handler = (_: unknown, status: ServerStatus): void => listener(status)

    ipcRenderer.on('ray:status', handler)

    return () => {
      ipcRenderer.off('ray:status', handler)
    }
  },

  getStatus(): Promise<ServerStatus> {
    return ipcRenderer.invoke('ray:status')
  },
}

contextBridge.exposeInMainWorld('ray', api)

export type RayApi = typeof api
