import type { RouteContext } from '../../shared/tools'
import { runDocker } from '../exec/run-docker'

const CONTEXT_TIMEOUT_MS = 90_000

/** One scan covers every route; asking per route would boot Laravel each time. */
const cache = new Map<string, RouteContext[]>()

/**
 * What each route expects of a request, read off the code that validates it.
 *
 * This project validates with laravel-data rather than with FormRequests, so
 * the contract lives on the DTO in the controller's signature: its properties
 * give the shape of the body and its rules give the reasons a call will be
 * rejected. Both are worth seeing before you send rather than after a 422.
 */
export async function routeContexts(
  containerId: string,
  workingDir: string,
): Promise<RouteContext[]> {
  const cached = cache.get(containerId)

  if (cached !== undefined) {
    return cached
  }

  const root = workingDir || '/var/www/html'
  const result = await runDocker(
    ['exec', '-i', '-w', root, containerId, 'php'],
    program(root),
    CONTEXT_TIMEOUT_MS,
  ).catch(() => null)

  if (result === null) {
    return []
  }

  const line = result.stdout
    .split('\n')
    .reverse()
    .find((candidate) => candidate.startsWith('['))

  if (line === undefined) {
    return []
  }

  try {
    const contexts = JSON.parse(line) as RouteContext[]

    cache.set(containerId, contexts)

    return contexts
  } catch {
    return []
  }
}

export function forgetRouteContexts(): void {
  cache.clear()
}

function program(root: string): string {
  return `<?php
require ${JSON.stringify(root)} . '/vendor/autoload.php';
$__app = require ${JSON.stringify(root)} . '/bootstrap/app.php';
$__app->make(Illuminate\\Contracts\\Console\\Kernel::class)->bootstrap();

$__rows = [];
$__hasData = class_exists(Spatie\\LaravelData\\Data::class);

foreach (Illuminate\\Support\\Facades\\Route::getRoutes() as $__route) {
    $__action = $__route->getActionName();

    // Only the application's own controllers; a package's routes are not the
    // ones anyone opens this tab to call.
    if (! str_contains($__action, '@') || ! str_starts_with($__action, 'App\\\\')) {
        continue;
    }

    [$__class, $__method] = explode('@', $__action);

    if (! class_exists($__class) || ! method_exists($__class, $__method)) {
        continue;
    }

    $__contract = null;
    $__kind = '';
    $__fields = [];

    foreach ((new ReflectionMethod($__class, $__method))->getParameters() as $__parameter) {
        $__type = $__parameter->getType();

        if (! $__type instanceof ReflectionNamedType || $__type->isBuiltin()) {
            continue;
        }

        $__name = $__type->getName();

        if ($__hasData && is_subclass_of($__name, Spatie\\LaravelData\\Data::class)) {
            $__contract = $__name;
            $__kind = 'data';
            $__fields = netos_data_fields($__name);

            break;
        }

        if (is_subclass_of($__name, Illuminate\\Foundation\\Http\\FormRequest::class)) {
            $__contract = $__name;
            $__kind = 'request';
            $__fields = netos_request_fields($__name);

            break;
        }
    }

    $__rows[] = [
        'uri' => $__route->uri(),
        'methods' => array_values(array_diff($__route->methods(), ['HEAD'])),
        'name' => (string) ($__route->getName() ?? ''),
        'action' => $__action,
        'contract' => $__contract,
        'kind' => $__kind,
        'fields' => $__fields,
    ];
}

function netos_rule_names($__rule): array
{
    $__list = is_array($__rule) ? $__rule : explode('|', (string) $__rule);

    return array_values(array_unique(array_map(
        fn ($__one) => is_object($__one) ? class_basename($__one) : (string) $__one,
        $__list,
    )));
}

/** A laravel-data DTO: the properties give the shape, the rules give the law. */
function netos_data_fields(string $__class): array
{
    $__rules = [];

    try {
        foreach ($__class::getValidationRules([]) as $__field => $__rule) {
            $__rules[(string) $__field] = netos_rule_names($__rule);
        }
    } catch (Throwable $__e) {
        // A DTO whose rules need context still has usable property types.
    }

    $__fields = [];

    try {
        foreach ((new ReflectionClass($__class))->getProperties(ReflectionProperty::IS_PUBLIC) as $__property) {
            if ($__property->isStatic()) {
                continue;
            }

            $__type = $__property->getType();
            $__name = $__property->getName();

            $__fields[] = [
                'name' => $__name,
                'type' => $__type instanceof ReflectionNamedType ? class_basename($__type->getName()) : 'mixed',
                'nullable' => $__type === null ? true : $__type->allowsNull(),
                'rules' => $__rules[$__name] ?? [],
            ];

            unset($__rules[$__name]);
        }
    } catch (Throwable $__e) {
        // Fall through to whatever the rules alone can say.
    }

    // Rules with no property of their own — 'roles.*', nested paths — still
    // describe something the request has to satisfy.
    foreach ($__rules as $__field => $__names) {
        $__fields[] = ['name' => $__field, 'type' => '', 'nullable' => false, 'rules' => $__names];
    }

    return $__fields;
}

function netos_request_fields(string $__class): array
{
    try {
        $__reflection = new ReflectionMethod($__class, 'rules');

        // Some packages take an argument here, and calling those blind is a
        // fatal error rather than a missing answer.
        if ($__reflection->getNumberOfRequiredParameters() > 0) {
            return [];
        }

        $__fields = [];

        foreach ((new $__class())->rules() as $__field => $__rule) {
            $__fields[] = [
                'name' => (string) $__field,
                'type' => '',
                'nullable' => false,
                'rules' => netos_rule_names($__rule),
            ];
        }

        return $__fields;
    } catch (Throwable $__e) {
        return [];
    }
}

echo json_encode($__rows), "\\n";
`
}
