import { ipcMain } from 'electron'
import type { MockHit, MockService, MockState, WebhookFire, WebhookOutcome } from '../../shared/mocks/types'
import type { MockChoicesStore } from './choices-store'
import type { MockHitLog } from './hit-log'
import type { MockRegistry } from './mock-registry'
import { forgetMockService, listMocks, saveMockService } from './package-bridge'

type MockIpcDeps = {
  registry: MockRegistry
  choices: MockChoicesStore
  log: MockHitLog
  fire: (fire: WebhookFire) => Promise<WebhookOutcome>
}

export function registerMockIpc({ registry, choices, log, fire }: MockIpcDeps): void {
  const load = async (containerId: string, workingDir: string, containerName: string): Promise<MockState> => {
    const answer = await listMocks(containerId, workingDir)

    registry.replace(
      answer.error === null
        ? {
            services: answer.services,
            problems: answer.problems,
            directory: answer.directory,
            container: containerName,
            loadedAt: Date.now(),
            error: null,
          }
        : { ...registry.state(), container: containerName, error: answer.error },
    )

    return registry.state()
  }

  ipcMain.handle('mocks:load', (_event, containerId: string, workingDir: string, containerName: string) =>
    load(containerId, workingDir, containerName),
  )

  ipcMain.handle('mocks:state', (): MockState => registry.state())

  ipcMain.handle('mocks:save', async (_event, containerId: string, workingDir: string, service: MockService) => {
    const saved = await saveMockService(containerId, workingDir, service)

    await load(containerId, workingDir, registry.state().container)

    return saved
  })

  ipcMain.handle(
    'mocks:forget',
    async (_event, containerId: string, workingDir: string, name: string, hash: string) => {
      const forgotten = await forgetMockService(containerId, workingDir, name, hash)

      await load(containerId, workingDir, registry.state().container)

      return forgotten
    },
  )

  ipcMain.on('mocks:choices', (event) => {
    event.returnValue = choices.all()
  })

  ipcMain.handle('mocks:choose', (_event, key: string, responseId: string) => choices.set(key, responseId))

  ipcMain.handle('mocks:hits', (): MockHit[] => log.all())

  ipcMain.on('mocks:hits:clear', () => log.clear())

  ipcMain.handle('mocks:fire', (_event, request: WebhookFire) => fire(request))
}
