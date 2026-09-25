import { withImplicitReturn } from './implicit-return'

/**
 * `use` at the top of a snippet, the way the design's examples are written.
 * Closures' `use ($x)` carries parentheses, so it never matches.
 */
const USE_STATEMENT = /^\s*use\s+[^();]+;\s*$/

/** Everything the result JSON is wrapped in, so stray output cannot be mistaken for it. */
export const RESULT_MARKER = '__NETOS_TINKER__'

export type ProgramParts = {
  source: string
  /**
   * Where the snippet's first line ends up in the generated file. A parse error
   * is reported against the generated file, and only this makes the number mean
   * something to whoever wrote the snippet.
   */
  bodyOffset: number
}

/**
 * Builds the program that runs inside the container.
 *
 * The snippet's `use` statements are hoisted to the top because PHP only
 * accepts them at file scope, and the rest goes into a closure so a bare
 * `return` hands back a value instead of ending the file. The body is written
 * out literally rather than eval'd: eval would catch parse errors, but it
 * compiles without the file's imports, so `User::count()` after
 * `use App\Models\User;` would fail to resolve.
 */
export function buildProgram(root: string, tenant: string, code: string): ProgramParts {
  const imports: string[] = []
  const body: string[] = []

  for (const line of code.split('\n')) {
    if (USE_STATEMENT.test(line) && body.every((seen) => seen.trim() === '')) {
      imports.push(line.trim())

      continue
    }

    body.push(line)
  }

  const head = [
    '<?php',
    ...imports,
    '',
    `require ${quote(root)} . '/vendor/autoload.php';`,
    `$__netosApp = require ${quote(root)} . '/bootstrap/app.php';`,
    '$__netosApp->make(Illuminate\\Contracts\\Console\\Kernel::class)->bootstrap();',
    '',
    tenantSetup(tenant),
    walker(),
    emitter(),
    dumpHandler(),
    '$__netosStart = microtime(true);',
    '$__netosValue = null;',
    '$__netosThrown = null;',
    'ob_start();',
    '',
    'try {',
    '    $__netosValue = (static function () {',
  ]

  const tail = [
    '    })();',
    '} catch (Throwable $__netosCaught) {',
    '    $__netosThrown = $__netosCaught;',
    '}',
    '',
    '$__netosMs = round((microtime(true) - $__netosStart) * 1000, 3);',
    '',
    'if ($__netosThrown !== null) {',
    '    $__netosPayload = [',
    "        'kind' => 'throwable',",
    "        'error' => [",
    "            'cls' => get_class($__netosThrown),",
    "            'message' => $__netosThrown->getMessage(),",
    "            'file' => $__netosThrown->getFile(),",
    "            'line' => $__netosThrown->getLine(),",
    "            'frames' => array_values(array_map(",
    "                static fn (array $f): array => [",
    "                    'file' => $f['file'] ?? '',",
    "                    'line' => $f['line'] ?? 0,",
    "                    'call' => ($f['class'] ?? '') . ($f['type'] ?? '') . ($f['function'] ?? ''),",
    '                ],',
    '                array_slice($__netosThrown->getTrace(), 0, 25),',
    '            )),',
    '        ],',
    '    ];',
    '} else {',
    '    $__netosPayload = [',
    "        'kind' => 'value',",
    "        'value' => __netos_node($__netosValue, 0),",
    "        'memoryMb' => round(memory_get_peak_usage(true) / 1048576, 1),",
    '    ];',
    '}',
    '',
    "$__netosPayload['durationMs'] = $__netosMs;",
    '',
    '__netos_emit($__netosPayload);',
    '',
  ]

  // Tinkerwell's manners: the last expression comes back whether or not the
  // snippet says `return`.
  const source = [...head, withImplicitReturn(body.join('\n')), ...tail].join('\n')

  return {
    source,
    // Counted in lines, not in array entries: the walker is one entry holding a
    // hundred lines, and using the entry count put every reported line a
    // hundred rows off.
    bodyOffset: head.join('\n').split('\n').length,
  }
}

/** Initialising a tenant is skipped entirely when the app has no tenancy. */
function tenantSetup(tenant: string): string {
  if (tenant === '') {
    return ''
  }

  return [
    `$__netosTenantKey = ${quote(tenant)};`,
    "$__netosTenantModel = config('tenancy.tenant_model');",
    'if (is_string($__netosTenantModel) && class_exists($__netosTenantModel)) {',
    '    $__netosTenant = $__netosTenantModel::find($__netosTenantKey);',
    '    if ($__netosTenant === null) {',
    '        throw new RuntimeException("No tenant " . $__netosTenantKey . " exists.");',
    '    }',
    '    tenancy()->initialize($__netosTenant);',
    '}',
    '',
  ].join('\n')
}

/**
 * Walks the returned value into the tree the output pane renders. Properties
 * keep PHP's own sigils — `+` public, `#` protected, `-` private — so a model
 * reads the way `dd()` prints it.
 *
 * Every limit here exists because this JSON travels to the renderer: a deep
 * object graph or a query builder holding the whole container would otherwise
 * serialise until something gives out.
 */
function walker(): string {
  return `
const NETOS_MAX_DEPTH = 5;
const NETOS_MAX_KIDS = 100;
const NETOS_MAX_STRING = 400;

function __netos_node(mixed $value, int $depth, array &$seen = []): array
{
    if ($value === null) {
        return ['t' => 'null'];
    }

    if (is_bool($value)) {
        return ['t' => 'bool', 'v' => $value];
    }

    if (is_int($value)) {
        return ['t' => 'num', 'v' => $value];
    }

    if (is_float($value)) {
        return ['t' => 'num', 'v' => is_finite($value) ? $value : (string) $value];
    }

    if (is_string($value)) {
        $cut = mb_strlen($value) > NETOS_MAX_STRING;

        return ['t' => 'str', 'v' => $cut ? mb_substr($value, 0, NETOS_MAX_STRING) : $value, 'cut' => $cut];
    }

    if (is_resource($value)) {
        return ['t' => 'str', 'v' => 'resource(' . get_resource_type($value) . ')'];
    }

    if (is_array($value)) {
        if ($depth >= NETOS_MAX_DEPTH) {
            return ['t' => 'arr', 'kids' => [], 'more' => count($value)];
        }

        $kids = [];
        $more = 0;

        foreach ($value as $key => $item) {
            if (count($kids) >= NETOS_MAX_KIDS) {
                $more++;

                continue;
            }

            $kids[] = [is_int($key) ? (string) $key : '"' . $key . '"', __netos_node($item, $depth + 1, $seen)];
        }

        return ['t' => 'arr', 'kids' => $kids, 'more' => $more];
    }

    if ($value instanceof Closure) {
        return ['t' => 'obj', 'cls' => 'Closure', 'id' => '#' . spl_object_id($value), 'kids' => []];
    }

    $id = spl_object_id($value);
    $cls = get_class($value);

    // Reflection on an Eloquent model yields forty-odd framework properties —
    // fillable, casts, guarded, observables — and buries the six that say what
    // the record is. Laravel's own dd() trims the same way.
    if (class_exists(Illuminate\\Database\\Eloquent\\Model::class) && $value instanceof Illuminate\\Database\\Eloquent\\Model) {
        if (isset($seen[$id]) || $depth >= NETOS_MAX_DEPTH) {
            return ['t' => 'ref', 'cls' => $cls, 'id' => '#' . $id];
        }

        $seen[$id] = true;

        $shown = [
            ['#connection', __netos_node($value->getConnectionName(), $depth + 1, $seen)],
            ['#table', __netos_node($value->getTable(), $depth + 1, $seen)],
            ['#attributes', __netos_node($value->getAttributes(), $depth + 1, $seen)],
            ['#relations', __netos_node($value->getRelations(), $depth + 1, $seen)],
            ['+exists', __netos_node($value->exists, $depth + 1, $seen)],
            ['+wasRecentlyCreated', __netos_node($value->wasRecentlyCreated, $depth + 1, $seen)],
        ];

        unset($seen[$id]);

        return ['t' => 'obj', 'cls' => $cls, 'id' => '#' . $id, 'kids' => $shown, 'more' => 0];
    }

    if (isset($seen[$id])) {
        return ['t' => 'ref', 'cls' => $cls, 'id' => '#' . $id];
    }

    if ($depth >= NETOS_MAX_DEPTH) {
        return ['t' => 'ref', 'cls' => $cls, 'id' => '#' . $id];
    }

    $seen[$id] = true;
    $kids = [];
    $more = 0;

    foreach ((new ReflectionObject($value))->getProperties() as $property) {
        if ($property->isStatic()) {
            continue;
        }

        if (count($kids) >= NETOS_MAX_KIDS) {
            $more++;

            continue;
        }

        if (!$property->isInitialized($value)) {
            continue;
        }

        $sigil = $property->isPublic() ? '+' : ($property->isProtected() ? '#' : '-');

        try {
            $kids[] = [$sigil . $property->getName(), __netos_node($property->getValue($value), $depth + 1, $seen)];
        } catch (Throwable) {
            $kids[] = [$sigil . $property->getName(), ['t' => 'str', 'v' => 'unreadable']];
        }
    }

    unset($seen[$id]);

    return ['t' => 'obj', 'cls' => $cls, 'id' => '#' . $id, 'kids' => $kids, 'more' => $more];
}
`
}

function quote(value: string): string {
  return "'" + value.replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "'"
}

/**
 * Writes the result line, exactly once.
 *
 * It is a shutdown function as well as the last statement, because `dd()` and
 * `exit()` are how half of PHP debugging ends — and a snippet that stops there
 * should still show what it printed rather than look like it never ran.
 */
function emitter(): string {
  return `
function __netos_emit(array $payload): void
{
    static $done = false;

    if ($done) {
        return;
    }

    $done = true;
    $printed = '';

    while (ob_get_level() > 0) {
        $printed = ((string) ob_get_clean()) . $printed;
    }

    $payload['output'] = $printed;

    echo "\\n", '${RESULT_MARKER}', json_encode($payload, JSON_PARTIAL_OUTPUT_ON_ERROR | JSON_INVALID_UTF8_SUBSTITUTE), "\\n";
}

register_shutdown_function(static function (): void {
    __netos_emit(['kind' => 'value', 'value' => ['t' => 'null'], 'durationMs' => 0, 'memoryMb' => null]);
});
`
}

/**
 * Sends every `dump()` through a dumper of our own, so each one starts on a
 * fresh line. PHP gives no seam between two `echo` calls, but a dump is a call
 * we can wrap — and a dump landing on the tail of an echo is what makes output
 * unreadable.
 */
function dumpHandler(): string {
  return `
if (class_exists(Symfony\\Component\\VarDumper\\VarDumper::class)) {
    Symfony\\Component\\VarDumper\\VarDumper::setHandler(static function (mixed $value): void {
        $buffered = ob_get_contents();

        if (is_string($buffered) && $buffered !== '' && !str_ends_with($buffered, "\\n")) {
            echo "\\n";
        }

        $dumper = new Symfony\\Component\\VarDumper\\Dumper\\CliDumper('php://output');
        $dumper->setColors(false);
        $dumper->dump((new Symfony\\Component\\VarDumper\\Cloner\\VarCloner())->cloneVar($value));
    });
}
`
}
