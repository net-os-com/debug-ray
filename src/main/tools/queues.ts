import type { FailedJob, QueueReport, QueueRow, SupervisorRow } from '../../shared/tools'
import { runDocker } from '../exec/run-docker'

const QUEUE_TIMEOUT_MS = 60_000

/** Failed jobs go back months; the panel is for the ones you are still chasing. */
const MAX_FAILED = 100

/**
 * What the queues are carrying, and who is carrying it.
 *
 * Horizon already keeps all of this in Redis and exposes it through repositories
 * the dashboard uses — asking those is both cheaper and more truthful than
 * counting keys ourselves, because it is the same source the dashboard shows.
 * Without Horizon the numbers fall back to what the queue driver itself reports.
 */
export async function queueReport(containerId: string, workingDir: string): Promise<QueueReport> {
  const root = workingDir || '/var/www/html'
  const result = await runDocker(
    ['exec', '-i', '-w', root, containerId, 'php'],
    program(root),
    QUEUE_TIMEOUT_MS,
  )

  const line = result.stdout
    .split('\n')
    .reverse()
    .find((candidate) => candidate.startsWith('{'))

  if (line === undefined) {
    return empty(firstLine(result.stderr) || 'The queue probe returned nothing.')
  }

  try {
    return JSON.parse(line) as QueueReport
  } catch {
    return empty('The queue probe returned something that is not JSON.')
  }
}

function empty(error: string): QueueReport {
  return {
    horizon: false,
    defaultConnection: '',
    queues: [],
    supervisors: [],
    failed: [],
    failedTotal: 0,
    recent: 0,
    completed: 0,
    throughput: 0,
    error,
  }
}

function firstLine(text: string): string {
  return text.split('\n')[0]?.trim() ?? ''
}

/** Exported for the shape test; nothing else should need it. */
export function program(root: string): string {
  return `<?php
require ${JSON.stringify(root)} . '/vendor/autoload.php';
$__app = require ${JSON.stringify(root)} . '/bootstrap/app.php';
$__app->make(Illuminate\\Contracts\\Console\\Kernel::class)->bootstrap();

$__report = [
    'horizon' => class_exists(Laravel\\Horizon\\Horizon::class),
    'defaultConnection' => (string) config('queue.default'),
    'queues' => [],
    'supervisors' => [],
    'failed' => [],
    'failedTotal' => 0,
    'recent' => 0,
    'completed' => 0,
    'throughput' => 0,
    'error' => null,
];

$__quiet = function (callable $fn, $fallback = null) {
    try { return $fn(); } catch (Throwable $e) { return $fallback; }
};

if ($__report['horizon']) {
    // The dashboard's own numbers: length, the wait the oldest job has already
    // had, and how many workers are on it right now.
    $__workload = $__quiet(fn () => app(Laravel\\Horizon\\Contracts\\WorkloadRepository::class)->get(), []);

    foreach ((array) $__workload as $__row) {
        $__report['queues'][] = [
            'name' => (string) ($__row['name'] ?? ''),
            'connection' => $__report['defaultConnection'],
            'length' => (int) ($__row['length'] ?? 0),
            'wait' => (int) ($__row['wait'] ?? 0),
            'processes' => (int) ($__row['processes'] ?? 0),
        ];
    }

    foreach ((array) $__quiet(fn () => app(Laravel\\Horizon\\Contracts\\SupervisorRepository::class)->all(), []) as $__s) {
        $__options = (array) ($__s->options ?? []);
        $__processes = (array) ($__s->processes ?? []);

        $__report['supervisors'][] = [
            'name' => (string) ($__s->name ?? ''),
            'master' => (string) ($__s->master ?? ''),
            'status' => (string) ($__s->status ?? ''),
            'pid' => (string) ($__s->pid ?? ''),
            'queues' => array_values(array_filter(explode(',', (string) ($__options['queue'] ?? '')))),
            'processes' => array_sum($__processes),
            'maxProcesses' => (int) ($__options['maxProcesses'] ?? 0),
            'memoryLimit' => (int) ($__options['memory'] ?? 0),
        ];
    }

    $__jobs = app(Laravel\\Horizon\\Contracts\\JobRepository::class);
    $__report['failedTotal'] = (int) $__quiet(fn () => $__jobs->countFailed(), 0);
    $__report['recent'] = (int) $__quiet(fn () => $__jobs->countRecent(), 0);
    $__report['completed'] = (int) $__quiet(fn () => $__jobs->countCompleted(), 0);
    $__report['throughput'] = (int) $__quiet(fn () => app(Laravel\\Horizon\\Contracts\\MetricsRepository::class)->throughput(), 0);

    // getFailed() hands back a Collection, and casting one of those to an
    // array gives you its internals rather than its items.
    $__failed = $__quiet(fn () => $__jobs->getFailed(), []);
    $__failed = $__failed instanceof Illuminate\\Support\\Collection
        ? $__failed->all()
        : (array) $__failed;

    foreach (array_slice(array_values($__failed), 0, ${MAX_FAILED}) as $__job) {
        $__payload = json_decode((string) ($__job->payload ?? ''), true);
        $__retried = json_decode((string) ($__job->retried_by ?? ''), true);

        $__report['failed'][] = [
            'id' => (string) ($__job->id ?? ''),
            'name' => (string) ($__job->name ?? ''),
            'connection' => (string) ($__job->connection ?? ''),
            'queue' => (string) ($__job->queue ?? ''),
            // Multi-database tenancy puts the tenant in the payload, and
            // without it "this job failed" does not say for whom.
            'tenant' => (string) (is_array($__payload) ? ($__payload['tenant_id'] ?? '') : ''),
            'exception' => explode("\\n", (string) ($__job->exception ?? ''))[0],
            'failedAt' => (float) ($__job->failed_at ?? 0) * 1000,
            'retried' => is_array($__retried) ? count($__retried) : 0,
        ];
    }
} else {
    // No Horizon: the driver can still be asked how long each configured queue
    // is, which is the one number that always means something.
    $__names = [];

    foreach ((array) config('queue.connections') as $__name => $__connection) {
        $__queue = $__connection['queue'] ?? null;

        if (is_string($__queue) && $__queue !== '') {
            $__names[$__name] = $__queue;
        }
    }

    foreach ($__names as $__connection => $__queue) {
        $__size = $__quiet(fn () => Illuminate\\Support\\Facades\\Queue::connection($__connection)->size($__queue));

        if ($__size === null) {
            continue;
        }

        $__report['queues'][] = [
            'name' => $__queue,
            'connection' => $__connection,
            'length' => (int) $__size,
            'wait' => 0,
            'processes' => 0,
        ];
    }

    $__report['failedTotal'] = (int) $__quiet(fn () => count(app('queue.failer')->all()), 0);
}

echo json_encode($__report), "\\n";
`
}
