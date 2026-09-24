import { contextBridge, ipcRenderer } from 'electron'
import type { McpStatus, RayClient, RayEvent, ServerStatus } from '../shared/ray-event'

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

  getClients(): Promise<RayClient[]> {
    return ipcRenderer.invoke('ray:clients')
  },

  getMcpStatus(): Promise<McpStatus> {
    return ipcRenderer.invoke('ray:mcp')
  },

  requestAttention(): void {
    ipcRenderer.send('ray:attention')
  },

  // navigator.clipboard is unavailable on the file:// origin the packaged
  // renderer runs from, and Electron's own clipboard module is main-process
  // only, so copying goes over IPC.
  copy(text: string): void {
    ipcRenderer.send('ray:copy', text)
  },
}

contextBridge.exposeInMainWorld('ray', api)

export type RayApi = typeof api
