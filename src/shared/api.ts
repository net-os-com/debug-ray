/** A place requests get sent to, and what they carry when they go there. */
export type ApiEnvironment = {
  id: string
  label: string
  /** Where requests go. No trailing slash. */
  host: string
  /** One line under the label in the picker. */
  meta: string
  variables: ApiVariable[]
  /**
   * Whether this environment will mint a token for another user. Off unless
   * it is turned on, because a token for an arbitrary account is a different
   * thing on a machine holding real data than on a laptop.
   */
  impersonate: boolean
  /**
   * A local stack behind a self-signed certificate is the normal case and a
   * refusal to connect is not a useful answer; anywhere else it is.
   */
  insecure: boolean
}

export type ApiVariable = {
  key: string
  value: string
  /** Kept out of anything written to disk in the repository. */
  secret: boolean
}

export type ApiPair = {
  key: string
  value: string
  enabled: boolean
}

export type ApiBodyMode = 'none' | 'json' | 'form'

export type ApiFormField = {
  key: string
  value: string
  /** A file field carries a path rather than a value. */
  file: boolean
  enabled: boolean
}

export type ApiAuthMode = 'none' | 'bearer' | 'impersonate'

export type ApiAuth = {
  mode: ApiAuthMode
  /** The variable holding the token, by name — never the token itself. */
  variable: string
  /** Who to impersonate; the token is minted at send time and never stored. */
  userId: string
  userLabel: string
}

/** Everything a request is, before variables are resolved. */
export type ApiRequest = {
  id: string
  name: string
  method: string
  /** May contain {{ variables }} and {path} parameters. */
  path: string
  pathParams: ApiPair[]
  query: ApiPair[]
  headers: ApiPair[]
  bodyMode: ApiBodyMode
  json: string
  form: ApiFormField[]
  auth: ApiAuth
  /** The route this was built from, when it was built from one. */
  routeUri: string
}

/** What the main process is handed to actually send. */
export type ApiSend = {
  environmentId: string
  method: string
  url: string
  headers: { key: string; value: string }[]
  body: string | null
  /** Multipart parts, when the body is a form. */
  form: { key: string; value: string; file: boolean }[] | null
  insecure: boolean
  timeoutMs: number
}

export type ApiTiming = {
  dns: number
  connect: number
  tls: number
  /** Time to the first byte of the response, from the request being written. */
  firstByte: number
  download: number
  total: number
}

export type ApiResult = {
  status: number
  statusText: string
  headers: { key: string; value: string }[]
  body: string
  /** Bytes received, which is not the string's length once it is decoded. */
  size: number
  timing: ApiTiming
  /** The X-Request-Id the app can use to find this in the Requests view. */
  debugId: string
  error: string | null
}

export type ApiUser = {
  id: string
  label: string
  email: string
  roles: string[]
}

export type MintedToken = {
  /** Held in memory for the session only; never written anywhere. */
  token: string
  userId: string
  userLabel: string
  /** Epoch milliseconds. After this the token stops working on its own. */
  expiresAt: number
  error: string | null
}

export type CollectionSummary = {
  name: string
  /** Relative to the application root, which is what git shows. */
  file: string
  operations: number
  /** The contents come with the listing: one call rather than one per file. */
  requests: SavedRequest[]
}

/**
 * One saved call, in the vocabulary the package and the app share. Nothing here
 * is a secret: a value that resolves at send time is stored as its reference.
 */
export type SavedRequest = {
  name: string
  method: string
  path: string
  pathParams: ApiPair[]
  query: ApiPair[]
  headers: ApiPair[]
  bodyMode: ApiBodyMode
  json: string
  /** The mode only — never who was impersonated, and never the token. */
  auth: ApiAuthMode
  summary: string
  /** Set by the package when reading; how one request is found again. */
  operationId?: string
}
