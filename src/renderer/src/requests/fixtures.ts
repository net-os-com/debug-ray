import type { HttpRequest, Query, QueryFrame } from './types'

/*
 * Stand-in data, transcribed from the design canvas, until a collector exists.
 * Anchored to the moment the app starts so the list reads as recent traffic.
 */
const START = Date.now()

function at(secondsAgo: number): number {
  return START - secondsAgo * 1000
}

const HOST_SQL = 'select * from `users` where `users`.`id` = ? limit 1'

function trace(source: string): QueryFrame[] {
  const file = source.split(':')[0]

  return [
    { callable: `App\\Http\\Resources\\${file.replace('.php', '')}::toArray()`, file: source, application: true },
    {
      callable: 'App\\Http\\Controllers\\ActivityController::upcoming()',
      file: 'ActivityController.php:37',
      application: true,
    },
    {
      callable: 'Illuminate\\Routing\\ControllerDispatcher::dispatch()',
      file: 'vendor/laravel/framework/…:46',
      application: false,
    },
    {
      callable: 'App\\Http\\Middleware\\IdentifyTenant::handle()',
      file: 'IdentifyTenant.php:44',
      application: true,
    },
  ]
}

function query(
  sql: string,
  bindings: string[],
  durationMs: number,
  offsetMs: number,
  source: string,
  extra: Partial<Query> = {},
): Query {
  return {
    sql,
    bindings,
    durationMs,
    offsetMs,
    source,
    connection: 'mysql',
    explain: null,
    hint: null,
    trace: trace(source),
    ...extra,
  }
}

const UPCOMING_QUERIES: Query[] = [
  query('select * from `sessions` where `id` = ? limit 1', ["'k3Jd9sVq2LxR'"], 0.9, 4, 'SessionGuard.php:156', {
    explain: [['1', 'SIMPLE', 'sessions', 'const', 'PRIMARY', '1', '100.00', '']],
  }),
  query('select * from `users` where `id` = ? limit 1', ['8812'], 0.7, 6, 'EloquentUserProvider.php:59', {
    explain: [['1', 'SIMPLE', 'users', 'const', 'PRIMARY', '1', '100.00', '']],
  }),
  query('select * from `tenants` where `slug` = ? limit 1', ["'anwb'"], 1.1, 9, 'IdentifyTenant.php:31', {
    explain: [['1', 'SIMPLE', 'tenants', 'const', 'tenants_slug_unique', '1', '100.00', '']],
  }),
  query(
    'select * from `activities` where `office_id` = ? and `starts_at` >= ? and `deleted_at` is null order by `starts_at` asc limit 20',
    ['12', "'2026-09-04 00:00:00'"],
    148.6,
    22,
    'ActivityRepository.php:52',
    {
      explain: [['1', 'SIMPLE', 'activities', 'ALL', '—', '48 210', '3.33', 'Using where; Using filesort']],
      hint: 'Full table scan on activities. Add an index on (office_id, starts_at).',
    },
  ),
  query(HOST_SQL, ['301'], 2.4, 176, 'ActivityResource.php:28'),
  query(HOST_SQL, ['118'], 2.1, 181, 'ActivityResource.php:28'),
  query(HOST_SQL, ['301'], 1.9, 186, 'ActivityResource.php:28'),
  query(HOST_SQL, ['944'], 2.2, 190, 'ActivityResource.php:28'),
  query(HOST_SQL, ['57'], 2.0, 195, 'ActivityResource.php:28'),
  query(HOST_SQL, ['118'], 2.3, 199, 'ActivityResource.php:28'),
  query(
    'select `activity_id`, count(*) as aggregate from `invites` where `activity_id` in (?, ?, ?, ?, ?) and `status` = ? group by `activity_id`',
    ['1041', '1042', '1043', '1044', '1045', "'accepted'"],
    6.8,
    206,
    'ActivityResource.php:41',
    { explain: [['1', 'SIMPLE', 'invites', 'range', 'invites_activity_status_idx', '34', '100.00', 'Using where; Using index']] },
  ),
  query(
    'select * from `activity_images` where `activity_images`.`activity_id` in (?, ?, ?, ?, ?)',
    ['1041', '1042', '1043', '1044', '1045'],
    3.2,
    216,
    'ActivityController.php:37',
    { explain: [['1', 'SIMPLE', 'activity_images', 'range', 'activity_images_activity_id_index', '9', '100.00', 'Using where']] },
  ),
  query(
    'select exists(select * from `invites` where `user_id` = ? and `activity_id` = ? and `status` = ?) as `exists`',
    ['8812', '1041', "'accepted'"],
    1.4,
    224,
    'ActivityPolicy.php:22',
  ),
  query('select * from `offices` where `offices`.`id` = ? limit 1', ['12'], 0.8, 229, 'ActivityResource.php:33'),
  query(
    'select count(*) as aggregate from `invites` where `user_id` = ? and `status` = ?',
    ['8812', "'pending'"],
    1.8,
    236,
    'InviteRepository.php:31',
  ),
  query('select * from `feature_flags` where `tenant_id` = ?', ['4'], 1.2, 241, 'FeatureFlags.php:19'),
  query(
    'insert into `activity_views` (`user_id`, `activity_id`, `viewed_at`) values (?, ?, ?)',
    ['8812', '1041', "'2026-09-04 14:32:18'"],
    4.9,
    380,
    'TrackActivityView.php:24',
  ),
  query(
    'update `sessions` set `last_activity` = ? where `id` = ?',
    ['1788532338', "'k3Jd9sVq2LxR'"],
    1.3,
    404,
    'DatabaseSessionHandler.php:118',
  ),
]

const SESSION_QUERIES: Query[] = [
  query('select * from `sessions` where `id` = ? limit 1', ["'k3Jd9sVq2LxR'"], 0.9, 3, 'SessionGuard.php:156'),
  query('select * from `users` where `id` = ? limit 1', ['8812'], 0.7, 5, 'EloquentUserProvider.php:59'),
]

export const REQUESTS: HttpRequest[] = [
  {
    id: 'r1',
    method: 'GET',
    host: 'anwb.test',
    uri: '/api/activities/upcoming',
    status: 200,
    startedAt: at(6),
    durationMs: 412,
    memoryMb: 14.2,
    route: 'activities.upcoming',
    action: 'ActivityController@upcoming',
    middleware: ['api', 'auth:sanctum', 'tenant'],
    queries: UPCOMING_QUERIES,
    collectorCounts: { timeline: 9, route: 1, events: 24, request: 2, cache: 7, mail: 2 },
  },
  {
    id: 'r2',
    method: 'POST',
    host: 'anwb.test',
    uri: '/api/invites/4412/accept',
    status: 422,
    startedAt: at(13),
    durationMs: 96,
    memoryMb: 9.8,
    route: 'invites.accept',
    action: 'InviteController@accept',
    middleware: ['api', 'auth:sanctum', 'tenant'],
    queries: [
      ...SESSION_QUERIES,
      query('select * from `invites` where `id` = ? limit 1', ['4412'], 1.2, 12, 'InviteController.php:44'),
      query(
        'select count(*) as aggregate from `invites` where `activity_id` = ? and `status` = ?',
        ['1042', "'accepted'"],
        1.6,
        18,
        'AcceptInvite.php:29',
      ),
      query('select * from `activities` where `id` = ? limit 1', ['1042'], 0.9, 22, 'AcceptInvite.php:31'),
    ],
    collectorCounts: { timeline: 5, route: 1, events: 8, request: 2, cache: 3, mail: 0 },
  },
  {
    id: 'r3',
    method: 'GET',
    host: 'anwb.test',
    uri: '/dashboard',
    status: 200,
    startedAt: at(26),
    durationMs: 238,
    memoryMb: 18.4,
    route: 'dashboard',
    action: 'DashboardController@index',
    middleware: ['web', 'auth', 'tenant'],
    queries: [
      ...SESSION_QUERIES,
      query('select * from `offices` where `id` = ? limit 1', ['12'], 0.8, 14, 'DashboardController.php:22'),
      query(
        'select * from `activities` where `office_id` = ? and `starts_at` >= ? limit 5',
        ['12', "'2026-09-04 00:00:00'"],
        18.2,
        26,
        'DashboardController.php:31',
      ),
    ],
    collectorCounts: { timeline: 7, route: 1, events: 14, request: 2, cache: 5, mail: 0 },
  },
  {
    id: 'r4',
    method: 'GET',
    host: 'anwb.test',
    uri: '/api/office/occupancy',
    status: 200,
    startedAt: at(44),
    durationMs: 39,
    memoryMb: 7.1,
    route: 'office.occupancy',
    action: 'OfficeController@occupancy',
    middleware: ['api', 'auth:sanctum', 'tenant'],
    queries: [
      query('select * from `sessions` where `id` = ? limit 1', ["'k3Jd9sVq2LxR'"], 0.8, 3, 'SessionGuard.php:156'),
      query(
        'select count(*) as aggregate from `desk_bookings` where `office_id` = ? and `date` = ?',
        ['12', "'2026-09-04'"],
        2.9,
        11,
        'OccupancyRepository.php:18',
      ),
    ],
    collectorCounts: { timeline: 3, route: 1, events: 4, request: 2, cache: 2, mail: 0 },
  },
  {
    id: 'r5',
    method: 'GET',
    host: 'anwb.test',
    uri: '/activities/1042',
    status: 200,
    startedAt: at(62),
    durationMs: 187,
    memoryMb: 12.6,
    route: 'activities.show',
    action: 'ActivityController@show',
    middleware: ['web', 'auth', 'tenant'],
    queries: [
      ...SESSION_QUERIES,
      query('select * from `activities` where `id` = ? limit 1', ['1042'], 1.1, 12, 'ActivityController.php:52'),
      query(HOST_SQL, ['301'], 2.2, 40, 'ActivityResource.php:28'),
      query(HOST_SQL, ['118'], 2.0, 46, 'ActivityResource.php:28'),
      query(HOST_SQL, ['944'], 2.1, 52, 'ActivityResource.php:28'),
    ],
    collectorCounts: { timeline: 6, route: 1, events: 11, request: 2, cache: 4, mail: 0 },
  },
  {
    id: 'r6',
    method: 'PUT',
    host: 'anwb.test',
    uri: '/api/profile',
    status: 200,
    startedAt: at(81),
    durationMs: 74,
    memoryMb: 8.3,
    route: 'profile.update',
    action: 'ProfileController@update',
    middleware: ['api', 'auth:sanctum'],
    queries: [
      ...SESSION_QUERIES,
      query(
        'update `users` set `first_name` = ?, `updated_at` = ? where `id` = ?',
        ["'Sam'", "'2026-09-04 14:30:57'", '8812'],
        3.4,
        21,
        'ProfileController.php:38',
      ),
    ],
    collectorCounts: { timeline: 4, route: 1, events: 6, request: 2, cache: 1, mail: 1 },
  },
  {
    id: 'r7',
    method: 'GET',
    host: 'anwb.test',
    uri: '/api/invites',
    status: 500,
    startedAt: at(97),
    durationMs: 1204,
    memoryMb: 22.9,
    route: 'invites.index',
    action: 'InviteController@index',
    middleware: ['api', 'auth:sanctum', 'tenant'],
    queries: [
      ...SESSION_QUERIES,
      query(
        'select * from `invites` where `user_id` = ? order by `created_at` desc',
        ['8812'],
        1102.4,
        44,
        'InviteRepository.php:52',
        {
          explain: [['1', 'SIMPLE', 'invites', 'ALL', '—', '214 880', '10.00', 'Using where; Using filesort']],
          hint: 'Full table scan on invites. Add an index on (user_id, created_at).',
        },
      ),
    ],
    collectorCounts: { timeline: 4, route: 1, events: 5, request: 2, cache: 1, mail: 0 },
  },
  {
    id: 'r8',
    method: 'DELETE',
    host: 'anwb.test',
    uri: '/api/activities/1039/rsvp',
    status: 204,
    startedAt: at(126),
    durationMs: 58,
    memoryMb: 7.8,
    route: 'activities.rsvp.destroy',
    action: 'RsvpController@destroy',
    middleware: ['api', 'auth:sanctum', 'tenant'],
    queries: [
      ...SESSION_QUERIES,
      query(
        'delete from `invites` where `user_id` = ? and `activity_id` = ?',
        ['8812', '1039'],
        2.6,
        19,
        'RsvpController.php:29',
      ),
    ],
    collectorCounts: { timeline: 3, route: 1, events: 5, request: 2, cache: 0, mail: 0 },
  },
  {
    id: 'r9',
    method: 'GET',
    host: 'anwb.test',
    uri: '/login',
    status: 302,
    startedAt: at(150),
    durationMs: 21,
    memoryMb: 5.4,
    route: 'login',
    action: 'AuthController@showLogin',
    middleware: ['web', 'guest'],
    queries: [
      query('select * from `sessions` where `id` = ? limit 1', ["'k3Jd9sVq2LxR'"], 0.8, 3, 'SessionGuard.php:156'),
    ],
    collectorCounts: { timeline: 2, route: 1, events: 3, request: 2, cache: 0, mail: 0 },
  },
]
