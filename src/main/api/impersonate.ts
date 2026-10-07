import type { ApiUser, MintedToken } from '../../shared/api'
import { runDocker } from '../exec/run-docker'

const USERS_TIMEOUT_MS = 30_000
const MINT_TIMEOUT_MS = 30_000

/**
 * How long a minted token lives. Long enough to try a call and then try it
 * again after fixing the body; short enough that one left behind stops working
 * before anyone could find it.
 */
const TOKEN_MINUTES = 15

/**
 * The name every token this app mints carries, so they can be told apart from
 * the application's own and revoked as a group.
 */
const TOKEN_NAME = 'netos-debug-api'

/** Users you could send a request as. */
export async function searchUsers(
  containerId: string,
  workingDir: string,
  tenant: string,
  query: string,
): Promise<ApiUser[]> {
  const root = workingDir || '/var/www/html'
  const result = await runDocker(
    ['exec', '-i', '-w', root, containerId, 'php'],
    usersProgram(root, tenant, query),
    USERS_TIMEOUT_MS,
  ).catch(() => null)

  return parse<ApiUser[]>(result?.stdout ?? '', '[') ?? []
}

/**
 * Issues a short-lived Sanctum token for one user.
 *
 * This runs `php artisan`-style code inside the container, which means the
 * token is written to that container's database — so it authenticates against a
 * stack backed by the same database and nowhere else. Pointing an environment
 * at a remote host and minting here would produce a token the remote side has
 * never heard of.
 */
export async function mintToken(
  containerId: string,
  workingDir: string,
  tenant: string,
  userId: string,
): Promise<MintedToken> {
  const root = workingDir || '/var/www/html'
  const result = await runDocker(
    ['exec', '-i', '-w', root, containerId, 'php'],
    mintProgram(root, tenant, userId),
    MINT_TIMEOUT_MS,
  ).catch((error: Error) => ({ stdout: '', stderr: error.message, code: 1, timedOut: false }))

  const minted = parse<MintedToken>(result.stdout, '{')

  if (minted === null) {
    return {
      token: '',
      userId,
      userLabel: '',
      expiresAt: 0,
      error: firstLine(result.stderr) || 'The token could not be minted.',
    }
  }

  return minted
}

/** Throws away every token this app has ever minted in that tenant. */
export async function revokeTokens(
  containerId: string,
  workingDir: string,
  tenant: string,
): Promise<number> {
  const root = workingDir || '/var/www/html'
  const result = await runDocker(
    ['exec', '-i', '-w', root, containerId, 'php'],
    revokeProgram(root, tenant),
    MINT_TIMEOUT_MS,
  ).catch(() => null)

  return parse<{ deleted: number }>(result?.stdout ?? '', '{')?.deleted ?? 0
}

function parse<T>(stdout: string, opener: string): T | null {
  const line = stdout
    .split('\n')
    .reverse()
    .find((candidate) => candidate.startsWith(opener))

  if (line === undefined) {
    return null
  }

  try {
    return JSON.parse(line) as T
  } catch {
    return null
  }
}

function firstLine(text: string): string {
  return text.split('\n')[0]?.trim() ?? ''
}

/** Tenancy has to be initialised first: users live in the tenant's database. */
function boot(root: string, tenant: string): string {
  return `<?php
require ${JSON.stringify(root)} . '/vendor/autoload.php';
$__app = require ${JSON.stringify(root)} . '/bootstrap/app.php';
$__app->make(Illuminate\\Contracts\\Console\\Kernel::class)->bootstrap();

$__model = config('tenancy.tenant_model');

if (${JSON.stringify(tenant)} !== '' && is_string($__model) && class_exists($__model)) {
    $__tenant = $__model::find(${JSON.stringify(tenant)});

    if ($__tenant !== null) {
        tenancy()->initialize($__tenant);
    }
}

$__users = config('auth.providers.users.model');

/** The column names differ per project; the readable name does not. */
function netos_label($__user): string {
    $__first = $__user->firstName ?? $__user->first_name ?? '';
    $__last = $__user->lastName ?? $__user->last_name ?? '';
    $__name = trim($__first . ' ' . $__last);

    return $__name !== '' ? $__name : (string) ($__user->name ?? $__user->email ?? $__user->getKey());
}
`
}

/** Exported for the shape test; nothing else should need it. */
export function usersProgram(root: string, tenant: string, query: string): string {
  return `${boot(root, tenant)}
$__query = ${JSON.stringify(query)};
$__rows = [];

try {
    $__builder = $__users::query();

    if ($__query !== '') {
        // Asking for a column the table does not have fails when the query
        // runs, not when it is built, so a try around the builder catches
        // nothing and the whole search comes back empty. The columns are
        // checked first instead.
        $__table = (new $__users())->getTable();
        $__columns = array_values(array_filter(
            ['email', 'first_name', 'last_name', 'firstName', 'lastName', 'name'],
            fn (string $__column): bool => Illuminate\\Support\\Facades\\Schema::hasColumn($__table, $__column),
        ));

        $__builder->where(function ($__where) use ($__query, $__columns) {
            foreach ($__columns as $__column) {
                $__where->orWhere($__column, 'like', '%' . $__query . '%');
            }
        });
    }

    foreach ($__builder->limit(40)->get() as $__user) {
        $__rows[] = [
            'id' => (string) $__user->getKey(),
            'label' => netos_label($__user),
            'email' => (string) ($__user->email ?? ''),
            'roles' => method_exists($__user, 'getRoleNames')
                ? array_values($__user->getRoleNames()->all())
                : [],
        ];
    }
} catch (Throwable $__e) {
    $__rows = [];
}

echo json_encode($__rows), "\\n";
`
}

function mintProgram(root: string, tenant: string, userId: string): string {
  return `${boot(root, tenant)}
try {
    $__user = $__users::find(${JSON.stringify(userId)});

    if ($__user === null) {
        echo json_encode([
            'token' => '', 'userId' => ${JSON.stringify(userId)}, 'userLabel' => '',
            'expiresAt' => 0, 'error' => 'No user with that id in this tenant.',
        ]), "\\n";
        exit;
    }

    $__expires = now()->addMinutes(${TOKEN_MINUTES});
    $__token = $__user->createToken(${JSON.stringify(TOKEN_NAME)}, ['*'], $__expires);

    echo json_encode([
        'token' => $__token->plainTextToken,
        'userId' => (string) $__user->getKey(),
        'userLabel' => netos_label($__user),
        'expiresAt' => $__expires->getTimestampMs(),
        'error' => null,
    ]), "\\n";
} catch (Throwable $__e) {
    echo json_encode([
        'token' => '', 'userId' => ${JSON.stringify(userId)}, 'userLabel' => '', 'expiresAt' => 0,
        'error' => class_basename($__e) . ': ' . mb_strimwidth($__e->getMessage(), 0, 160, '…'),
    ]), "\\n";
}
`
}

function revokeProgram(root: string, tenant: string): string {
  return `${boot(root, tenant)}
$__deleted = 0;

try {
    $__deleted = Laravel\\Sanctum\\PersonalAccessToken::where('name', ${JSON.stringify(TOKEN_NAME)})->delete();
} catch (Throwable $__e) {
    $__deleted = 0;
}

echo json_encode(['deleted' => (int) $__deleted]), "\\n";
`
}
