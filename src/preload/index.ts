import { contextBridge, ipcRenderer } from 'electron'
import type { ErdPoint, ErdSaved, ErdSticky, ErdStored } from '../shared/erd'
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
import type {
  ApiEnvironment,
  ApiResult,
  ApiSend,
  ApiUser,
  CollectionSummary,
  MintedToken,
  SavedRequest,
} from '../shared/api'
import type { ImportedFile } from '../shared/import/documents'
import type { BroadcastOutcome, PusherCredentials, RealtimeFrame } from '../shared/realtime'
import type {
  AppRoute,
  ArtisanCommand,
  ContainerProcesses,
  QueueReport,
  RouteContext,
  SchemaTable,
  ScoutIndex,
  TestFile,
} from '../shared/tools'

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

  getArtisanCommands(containerId: string, workingDir: string): Promise<ArtisanCommand[]> {
    return ipcRenderer.invoke('tools:artisan', containerId, workingDir)
  },

  getScoutIndexes(containerId: string, workingDir: string, tenant: string): Promise<ScoutIndex[]> {
    return ipcRenderer.invoke('tools:scout', containerId, workingDir, tenant)
  },

  sendApiRequest(options: ApiSend): Promise<ApiResult> {
    return ipcRenderer.invoke('api:send', options)
  },

  erdFromMigrations(
    containerId: string,
    workingDir: string,
  ): Promise<{ tables: SchemaTable[]; error: string | null }> {
    return ipcRenderer.invoke('erd:migrations', containerId, workingDir)
  },

  readErd(containerId: string, workingDir: string): Promise<ErdStored> {
    return ipcRenderer.invoke('erd:read', containerId, workingDir)
  },

  saveErd(
    containerId: string,
    workingDir: string,
    dbml: string,
    layout: Record<string, ErdPoint>,
    stickies: ErdSticky[],
  ): Promise<ErdSaved> {
    return ipcRenderer.invoke('erd:save', containerId, workingDir, dbml, layout, stickies)
  },

  listCollections(
    containerId: string,
    workingDir: string,
  ): Promise<{ collections: CollectionSummary[]; directory: string; error: string | null }> {
    return ipcRenderer.invoke('api:collections', containerId, workingDir)
  },

  readCollection(containerId: string, workingDir: string, name: string): Promise<SavedRequest[]> {
    return ipcRenderer.invoke('api:collection', containerId, workingDir, name)
  },

  /** Opens the picker and reads whatever was chosen; never throws at the renderer. */
  importFile(): Promise<ImportedFile> {
    return ipcRenderer.invoke('api:import:file')
  },

  importIntoCollection(
    containerId: string,
    workingDir: string,
    name: string,
    requests: SavedRequest[],
  ): Promise<{
    file: string
    operations: number
    added: number
    replaced: number
    error: string | null
  }> {
    return ipcRenderer.invoke('api:collection:import', containerId, workingDir, name, requests)
  },

  saveToCollection(
    containerId: string,
    workingDir: string,
    name: string,
    request: SavedRequest,
  ): Promise<{ file: string; operations: number; error: string | null }> {
    return ipcRenderer.invoke('api:collection:save', containerId, workingDir, name, request)
  },

  forgetInCollection(
    containerId: string,
    workingDir: string,
    name: string,
    operationId: string,
  ): Promise<{ file: string; operations: number; error: string | null }> {
    return ipcRenderer.invoke('api:collection:forget', containerId, workingDir, name, operationId)
  },

  searchApiUsers(
    containerId: string,
    workingDir: string,
    tenant: string,
    query: string,
  ): Promise<ApiUser[]> {
    return ipcRenderer.invoke('api:users', containerId, workingDir, tenant, query)
  },

  mintApiToken(
    containerId: string,
    workingDir: string,
    tenant: string,
    userId: string,
  ): Promise<MintedToken> {
    return ipcRenderer.invoke('api:mint', containerId, workingDir, tenant, userId)
  },

  revokeApiTokens(containerId: string, workingDir: string, tenant: string): Promise<number> {
    return ipcRenderer.invoke('api:revoke', containerId, workingDir, tenant)
  },

  realtimeCredentials(containerId: string, workingDir: string): Promise<PusherCredentials> {
    return ipcRenderer.invoke('realtime:credentials', containerId, workingDir)
  },

  realtimeOpen(context: {
    url: string
    containerId: string
    workingDir: string
    host: string
    tenant: string
    actorId: string
    insecure: boolean
  }): Promise<void> {
    return ipcRenderer.invoke('realtime:open', context)
  },

  realtimeSubscribe(channel: string): Promise<void> {
    return ipcRenderer.invoke('realtime:subscribe', channel)
  },

  realtimeUnsubscribe(channel: string): Promise<void> {
    return ipcRenderer.invoke('realtime:unsubscribe', channel)
  },

  realtimeWhisper(channel: string, event: string, data: unknown): Promise<boolean> {
    return ipcRenderer.invoke('realtime:whisper', channel, event, data)
  },

  realtimeClose(): Promise<void> {
    return ipcRenderer.invoke('realtime:close')
  },

  onRealtimeFrame(listener: (frame: RealtimeFrame) => void): () => void {
    const handler = (_: unknown, frame: RealtimeFrame): void => listener(frame)

    ipcRenderer.on('realtime:frame', handler)

    return () => {
      ipcRenderer.off('realtime:frame', handler)
    }
  },

  onRealtimeStatus(listener: (status: string, detail: string) => void): () => void {
    const handler = (_: unknown, status: string, detail: string): void =>
      listener(status, detail)

    ipcRenderer.on('realtime:status', handler)

    return () => {
      ipcRenderer.off('realtime:status', handler)
    }
  },

  realtimeBroadcast(
    containerId: string,
    workingDir: string,
    tenant: string,
    channel: string,
    event: string,
    payload: string,
  ): Promise<BroadcastOutcome> {
    return ipcRenderer.invoke(
      'realtime:broadcast',
      containerId,
      workingDir,
      tenant,
      channel,
      event,
      payload,
    )
  },

  realtimeEvents(containerId: string, workingDir: string): Promise<string[]> {
    return ipcRenderer.invoke('realtime:events', containerId, workingDir)
  },

  saveErdFile(request: {
    name: string
    what: string
    extension: string
    data: string
    base64: boolean
  }): Promise<{ path: string | null; error: string | null }> {
    return ipcRenderer.invoke('erd:save-file', request)
  },

  realtimeOccupied(
    containerId: string,
    workingDir: string,
  ): Promise<{ channels: string[]; error: string | null }> {
    return ipcRenderer.invoke('realtime:occupied', containerId, workingDir)
  },

  appVersion(): string {
    return ipcRenderer.sendSync('ray:version') as string
  },

  readEnvironments(): ApiEnvironment[] {
    return ipcRenderer.sendSync('api:environments:read') as ApiEnvironment[]
  },

  writeEnvironments(list: ApiEnvironment[]): void {
    ipcRenderer.send('api:environments:write', list)
  },

  getRoutes(containerId: string, workingDir: string): Promise<AppRoute[]> {
    return ipcRenderer.invoke('tools:routes', containerId, workingDir)
  },

  getRouteContexts(containerId: string, workingDir: string): Promise<RouteContext[]> {
    return ipcRenderer.invoke('tools:route-context', containerId, workingDir)
  },

  getSchemaTables(containerId: string, workingDir: string, tenant: string): Promise<SchemaTable[]> {
    return ipcRenderer.invoke('tools:schema', containerId, workingDir, tenant)
  },

  getTestFiles(containerId: string, workingDir: string): Promise<TestFile[]> {
    return ipcRenderer.invoke('tools:tests', containerId, workingDir)
  },

  getQueueReport(containerId: string, workingDir: string): Promise<QueueReport> {
    return ipcRenderer.invoke('tools:queues', containerId, workingDir)
  },

  getContainerProcesses(liveMasters: string[]): Promise<ContainerProcesses[]> {
    return ipcRenderer.invoke('tools:processes', liveMasters)
  },

  startExec(start: { id: string; args: string[]; columns?: number }): Promise<{
    ok: boolean
    message?: string
  }> {
    return ipcRenderer.invoke('exec:start', start)
  },

  stopExec(id: string): void {
    ipcRenderer.send('exec:stop', id)
  },

  onExecData(listener: (event: { id: string; chunk: string; stream: 'out' | 'err' }) => void) {
    const handler = (_: unknown, event: { id: string; chunk: string; stream: 'out' | 'err' }) =>
      listener(event)

    ipcRenderer.on('exec:data', handler)

    return () => {
      ipcRenderer.off('exec:data', handler)
    }
  },

  onExecEnd(listener: (event: { id: string; code: number | null }) => void) {
    const handler = (_: unknown, event: { id: string; code: number | null }) => listener(event)

    ipcRenderer.on('exec:end', handler)

    return () => {
      ipcRenderer.off('exec:end', handler)
    }
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

  /** Posts a macOS notification, unless the window already has focus. */
  notify(title: string, body: string): void {
    ipcRenderer.send('ray:notify', title, body)
  },
  /** Posts one banner now and says whether macOS let it through. */
  testNotification(): Promise<{ ok: boolean; error: string | null }> {
    return ipcRenderer.invoke('ray:notify-test') as Promise<{ ok: boolean; error: string | null }>
  },

  /** Opens a file at a line in the configured editor. False when none is set. */
  openInEditor(file: string, line: number): Promise<boolean> {
    return ipcRenderer.invoke('ray:open-in-editor', file, line) as Promise<boolean>
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
