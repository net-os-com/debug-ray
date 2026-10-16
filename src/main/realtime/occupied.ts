import { phpBootstrap } from '../exec/bootstrap'
import { runDocker } from '../exec/run-docker'

const TIMEOUT_MS = 20_000

export type OccupiedChannels = {
  channels: string[]
  error: string | null
}

/**
 * Asks Pusher which channels currently have somebody on them.
 *
 * There is no wildcard subscribe in the Pusher protocol — `pusher:subscribe`
 * takes one channel name — so the only way to follow "everything" is to find
 * out what everything is and then name each one. This is that list, and it is
 * the browser's own subscriptions seen from the other side: a channel is
 * occupied precisely because something is listening to it.
 *
 * It runs in the container because the HTTP API is signed with the app secret.
 * Keeping the call there keeps the secret there.
 */
export async function occupiedChannels(
  containerId: string,
  workingDir: string,
): Promise<OccupiedChannels> {
  const root = workingDir || '/var/www/html'
  const result = await runDocker(
    ['exec', '-i', '-w', root, containerId, 'php'],
    occupiedProgram(root),
    TIMEOUT_MS,
  ).catch((error: Error) => ({ stdout: '', stderr: error.message, code: 1, timedOut: false }))

  const line = result.stdout
    .split('\n')
    .reverse()
    .find((candidate) => candidate.startsWith('{'))

  if (line === undefined) {
    return {
      channels: [],
      error: result.stderr.split('\n')[0]?.trim() || 'The channel list could not be read.',
    }
  }

  try {
    return JSON.parse(line) as OccupiedChannels
  } catch {
    return { channels: [], error: 'The container answered with something that is not JSON.' }
  }
}

/** Exported for the shape test; nothing else should need it. */
export function occupiedProgram(root: string): string {
  return `<?php
${phpBootstrap(root)}

try {
    if (!class_exists(Pusher\\Pusher::class)) {
        echo json_encode([
            'channels' => [],
            'error' => 'pusher/pusher-php-server is not installed in this application.',
        ]), "\\n";
        exit;
    }

    $__c = config('broadcasting.connections.pusher') ?? [];
    $__pusher = new Pusher\\Pusher(
        (string) ($__c['key'] ?? ''),
        (string) ($__c['secret'] ?? ''),
        (string) ($__c['app_id'] ?? ''),
        (array) ($__c['options'] ?? []),
    );

    $__answer = $__pusher->get('/channels');
    $__channels = is_object($__answer)
        ? ($__answer->channels ?? null)
        : ($__answer['channels'] ?? null);

    echo json_encode([
        'channels' => $__channels === null ? [] : array_keys((array) $__channels),
        'error' => null,
    ]), "\\n";
} catch (Throwable $__e) {
    echo json_encode([
        'channels' => [],
        'error' => class_basename($__e) . ': ' . mb_strimwidth($__e->getMessage(), 0, 200, '…'),
    ]), "\\n";
}
`
}
