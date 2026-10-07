export type ArtisanArgument = {
  name: string
  description: string
  required: boolean
  /** Takes several values, given on the command line one after another. */
  array: boolean
}

export type ArtisanOption = {
  /** Including the leading dashes, as Symfony reports it. */
  name: string
  description: string
  /** A flag when false: present or absent, never `--flag=value`. */
  acceptsValue: boolean
  multiple: boolean
}

export type ArtisanCommand = {
  name: string
  description: string
  arguments: ArtisanArgument[]
  options: ArtisanOption[]
}

export type ScoutIndex = {
  model: string
  /** The index the model writes to, which under tenancy is per tenant. */
  index: string
  /** Rows in the database, or null when the count could not be taken. */
  db: number | null
  /** Documents the engine reports, or null when the index could not be read. */
  indexed: number | null
  /** True when the count is a search estimate rather than the engine's own tally. */
  approximate: boolean
  /** The engine is still writing, so a difference may simply be in flight. */
  indexing: boolean
  error: string | null
}

export type QueueRow = {
  name: string
  connection: string
  length: number
  /** Seconds the oldest job on this queue has already waited. */
  wait: number
  processes: number
}

export type SupervisorRow = {
  name: string
  master: string
  status: string
  pid: string
  queues: string[]
  processes: number
  maxProcesses: number
  /** The megabyte ceiling a worker restarts itself at. */
  memoryLimit: number
}

export type FailedJob = {
  id: string
  name: string
  connection: string
  queue: string
  /** Under multi-database tenancy, whose job this was. */
  tenant: string
  /** The first line of the exception; the rest is in the payload. */
  exception: string
  failedAt: number
  retried: number
}

export type QueueReport = {
  horizon: boolean
  defaultConnection: string
  queues: QueueRow[]
  supervisors: SupervisorRow[]
  failed: FailedJob[]
  failedTotal: number
  recent: number
  completed: number
  /** Jobs per minute, as Horizon measures it. */
  throughput: number
  error: string | null
}

export type WorkerProcess = {
  pid: number
  /** Resident set size in kilobytes, as ps reports it. */
  rss: number
  elapsed: string
  command: string
  /** The Horizon master that started it, from the command line. */
  master: string
  /** Its master is gone, so nothing will ever stop it. */
  orphaned: boolean
}

export type ContainerProcesses = {
  container: string
  total: number
  /** Exited children nobody reaped. They cost a process slot each. */
  defunct: number
  processes: WorkerProcess[]
}

export type TestFile = {
  /** Relative to the application root, which is how the runner takes it. */
  path: string
  /** The folder under tests/ — Feature, Unit, Arch. */
  suite: string
  name: string
  /** Every it()/test()/arch() name in the file. */
  cases: string[]
}

export type SchemaColumn = {
  name: string
  type: string
  nullable: boolean
  default: string | null
  autoIncrement: boolean
}

export type SchemaIndex = {
  name: string
  columns: string[]
  unique: boolean
  primary: boolean
}

export type SchemaKey = {
  columns: string[]
  table: string
  foreignColumns: string[]
  onDelete: string
}

export type SchemaTable = {
  name: string
  /** Bytes on disk, as the engine reports them. */
  size: number
  /** The engine's estimate, not a count(*) — null when it could not be read. */
  rows: number | null
  engine: string
  columns: SchemaColumn[]
  indexes: SchemaIndex[]
  keys: SchemaKey[]
  error: string | null
}

export type AppRoute = {
  /** HEAD is dropped: every GET has one and it tells you nothing. */
  methods: string[]
  uri: string
  name: string
  action: string
  /** The last segment of the action, which is the part that differs. */
  controller: string
  middleware: string[]
  domain: string
}

export type ContractField = {
  name: string
  /** The PHP type, short — `string`, `int`, `Carbon`. Empty when unknown. */
  type: string
  nullable: boolean
  /** Validation rules, with rule objects reduced to their class name. */
  rules: string[]
}

export type RouteContext = {
  uri: string
  methods: string[]
  name: string
  action: string
  /** The DTO or FormRequest the controller takes, when it takes one. */
  contract: string | null
  kind: 'data' | 'request' | ''
  fields: ContractField[]
}
