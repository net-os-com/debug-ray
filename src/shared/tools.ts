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
