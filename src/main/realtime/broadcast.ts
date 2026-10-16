import type { BroadcastOutcome } from '../../shared/realtime'
import { phpBootstrap } from '../exec/bootstrap'
import { runDocker } from '../exec/run-docker'

const TIMEOUT_MS = 30_000

/**
 * Broadcasts one event from inside the application.
 *
 * Laravel 12's anonymous broadcasting is what makes this honest: the event goes
 * out through the application's own broadcaster, with the application's own
 * credentials, onto a channel it authorizes itself. The alternative — signing a
 * REST call to Pusher from this desktop app — would need the app secret on this
 * machine to produce a message the application never sent.
 *
 * `sendNow` rather than `send`: the anonymous event is queued by default, and a
 * debugger whose Broadcast button quietly does nothing until someone starts a
 * worker is a debugger that lies.
 */
export async function broadcast(
  containerId: string,
  workingDir: string,
  tenant: string,
  channel: string,
  event: string,
  payload: string,
): Promise<BroadcastOutcome> {
  const root = workingDir || '/var/www/html'
  const result = await runDocker(
    ['exec', '-i', '-w', root, containerId, 'php'],
    broadcastProgram(root, tenant, channel, event, payload),
    TIMEOUT_MS,
  ).catch((error: Error) => ({ stdout: '', stderr: error.message, code: 1, timedOut: false }))

  const line = result.stdout
    .split('\n')
    .reverse()
    .find((candidate) => candidate.startsWith('{'))

  if (line === undefined) {
    return {
      ok: false,
      error: result.stderr.split('\n')[0]?.trim() || 'The event could not be broadcast.',
    }
  }

  try {
    return JSON.parse(line) as BroadcastOutcome
  } catch {
    return { ok: false, error: 'The container answered with something that is not JSON.' }
  }
}

/**
 * Puts a value into PHP source so that PHP can only ever read it as text.
 *
 * Not `JSON.stringify`. That emits a double-quoted literal, and JSON does not
 * escape `$` — which PHP interpolates inside double quotes. A payload holding
 * `{"hash":"$2y$10$..."}` or `costs $x` would arrive changed, and `${...}` is
 * still evaluated on PHP 8.4 (deprecated in 8.2, removed in 9). Base64 has no
 * quote, backslash or dollar in its alphabet, so there is nothing left to read
 * as syntax.
 */
function phpText(value: string): string {
  return `base64_decode('${Buffer.from(value, 'utf8').toString('base64')}')`
}

/** Exported for the shape test; nothing else should need it. */
export function broadcastProgram(
  root: string,
  tenant: string,
  channel: string,
  event: string,
  payload: string,
): string {
  return `<?php
${phpBootstrap(root)}

use Illuminate\\Support\\Facades\\Broadcast;

$__tenantId = ${phpText(tenant)};
$__model = config('tenancy.tenant_model');

if ($__tenantId !== '' && is_string($__model) && class_exists($__model)) {
    $__tenant = $__model::find($__tenantId);

    if ($__tenant !== null) {
        tenancy()->initialize($__tenant);
    }
}

try {
    $__payload = json_decode(${phpText(payload)}, true);

    if (!is_array($__payload)) {
        echo json_encode(['ok' => false, 'error' => 'The payload must be a JSON object.']), "\\n";
        exit;
    }

    $__name = ${phpText(channel)};

    // The prefix is how a client names the channel; the broadcaster puts it
    // back itself, so handing it the prefixed name would send to
    // "private-private-…" and nobody would ever see it.
    if (str_starts_with($__name, 'presence-')) {
        $__event = Broadcast::presence(substr($__name, 9));
    } elseif (str_starts_with($__name, 'private-')) {
        $__event = Broadcast::private(substr($__name, 8));
    } else {
        $__event = Broadcast::on($__name);
    }

    $__event->as(${phpText(event)})->with($__payload)->sendNow();

    echo json_encode(['ok' => true, 'error' => null]), "\\n";
} catch (Throwable $__e) {
    echo json_encode([
        'ok' => false,
        'error' => class_basename($__e) . ': ' . mb_strimwidth($__e->getMessage(), 0, 200, '…'),
    ]), "\\n";
}
`
}
