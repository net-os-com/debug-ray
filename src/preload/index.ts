import { contextBridge, ipcRenderer } from 'electron'
import type {
  McpStatus,
  RayClient,
  RayEvent,
  ServerStatus,
  UpdateStatus,
} from '../shared/ray-event'
import type {
  Snippet,
  TinkerContainer,
  TinkerOutcome,
  TinkerRequest,
} from '../shared/tinker'

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

  getUpdateStatus(): Promise<UpdateStatus> {
    return ipcRenderer.invoke('ray:update')
  },

  onUpdate(listener: (status: UpdateStatus) => void): () => void {
    const handler = (_: unknown, status: UpdateStatus): void => listener(status)

    ipcRenderer.on('ray:update', handler)

    return () => {
      ipcRenderer.off('ray:update', handler)
    }
  },

  checkForUpdate(): void {
    ipcRenderer.send('ray:update:check')
  },

  downloadUpdate(): void {
    ipcRenderer.send('ray:update:download')
  },

  installUpdate(): void {
    ipcRenderer.send('ray:update:install')
  },

  getContainers(): Promise<TinkerContainer[]> {
    return ipcRenderer.invoke('tinker:containers')
  },

  getTenants(containerId: string, workingDir: string): Promise<string[]> {
    return ipcRenderer.invoke('tinker:tenants', containerId, workingDir)
  },

  getClasses(containerId: string, workingDir: string): Promise<string[]> {
    return ipcRenderer.invoke('tinker:classes', containerId, workingDir)
  },

  runTinker(request: TinkerRequest): Promise<TinkerOutcome> {
    return ipcRenderer.invoke('tinker:run', request)
  },

  readSnippets(): Snippet[] {
    return ipcRenderer.sendSync('tinker:snippets:read') as Snippet[]
  },

  writeSnippets(list: Snippet[]): void {
    ipcRenderer.send('tinker:snippets:write', list)
  },

  onFullScreen(listener: (fullScreen: boolean) => void): () => void {
    const handler = (_: unknown, fullScreen: boolean): void => listener(fullScreen)

    ipcRenderer.on('ray:fullscreen', handler)

    return () => {
      ipcRenderer.off('ray:fullscreen', handler)
    }
  },

  requestAttention(): void {
    ipcRenderer.send('ray:attention')
  },

  setAlwaysOnTop(onTop: boolean): void {
    ipcRenderer.send('ray:always-on-top', onTop)
  },

  readPreferences(): Record<string, unknown> {
    return ipcRenderer.sendSync('ray:prefs:read') as Record<string, unknown>
  },

  writePreferences(patch: Record<string, unknown>): void {
    ipcRenderer.send('ray:prefs:write', patch)
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
