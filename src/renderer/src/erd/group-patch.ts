import { quoteName } from './dbml'
import { parseDbml } from './parse'
import type { PatchResult } from './patch'

/**
 * Membership of a `TableGroup`, edited in the source.
 *
 * Groups are not reached through `patch.ts`: that module works from the byte
 * ranges the parser reports, and the parser reports none for a group — it
 * hands back the names and nothing about where they were written. So the block
 * is found in the text, which is safe here because a group's body is a plain
 * list of names with no nesting.
 */
type Block = { start: number; end: number; bodyStart: number; bodyEnd: number }

/** Adds a table to a group, creating the group when it does not exist yet. */
export function addToGroup(code: string, group: string, table: string): PatchResult {
  const block = findBlock(code, group)
  const member = `  ${qualified(table)}`

  if (block === null) {
    return commit(`${code.replace(/\s*$/, '')}\n\nTableGroup ${quoteName(group)} {\n${member}\n}\n`)
  }

  if (members(code, block).includes(table)) {
    return { ok: true, code }
  }

  const body = code.slice(block.bodyStart, block.bodyEnd).replace(/\s*$/, '')

  return commit(
    code.slice(0, block.bodyStart) + `${body}\n${member}\n` + code.slice(block.bodyEnd),
  )
}

/**
 * Removes a table from a group, and the group with it when that was the last
 * member: a `TableGroup` with no tables draws no rectangle and lists nothing,
 * so leaving one behind is litter in a file somebody has to read.
 */
export function removeFromGroup(code: string, group: string, table: string): PatchResult {
  const block = findBlock(code, group)

  if (block === null) {
    return { ok: false, reason: `There is no group called ${group}.` }
  }

  const left = members(code, block).filter((one) => one !== table)

  if (left.length === 0) {
    return commit(trimBlank(code.slice(0, block.start) + code.slice(block.end)))
  }

  return commit(
    code.slice(0, block.bodyStart) +
      `\n${left.map((one) => `  ${qualified(one)}`).join('\n')}\n` +
      code.slice(block.bodyEnd),
  )
}

/** Renames a group in place, keeping its members and its colour. */
export function renameGroup(code: string, group: string, to: string): PatchResult {
  const block = findBlock(code, group)

  if (block === null) {
    return { ok: false, reason: `There is no group called ${group}.` }
  }

  const head = code.slice(block.start, block.bodyStart)
  const renamed = head.replace(/^(\s*TableGroup\s+)("[^"]*"|[^\s[{]+)/, `$1${quoteName(to)}`)

  return commit(code.slice(0, block.start) + renamed + code.slice(block.bodyStart))
}

/** The qualified names a group block lists, in source order. */
function members(code: string, block: Block): string[] {
  return code
    .slice(block.bodyStart, block.bodyEnd)
    .split('\n')
    .map((line) => line.replace(/\/\/.*$/, '').trim())
    .filter((line) => line !== '')
    .map(unquoteQualified)
}

/**
 * Where a group's block sits in the text.
 *
 * The body runs from the opening brace to the closing one. Nesting is not a
 * concern — a `TableGroup` body holds names, never another block — so the first
 * `}` after the brace ends it.
 */
function findBlock(code: string, group: string): Block | null {
  const pattern = /(^|\n)[ \t]*TableGroup[ \t]+("[^"]*"|[^\s[{]+)[^\n{]*\{/g
  let match: RegExpExecArray | null

  while ((match = pattern.exec(code)) !== null) {
    if (unquote(match[2] ?? '') !== group) {
      continue
    }

    const open = match.index + match[0].length - 1
    const close = code.indexOf('}', open)

    if (close < 0) {
      return null
    }

    const lead = match[1] === '' ? 0 : 1

    return {
      start: match.index + lead,
      end: close + 1,
      bodyStart: open + 1,
      bodyEnd: close,
    }
  }

  return null
}

/** `central.tenants` is two identifiers around a dot, each quoted on its own. */
function qualified(name: string): string {
  const dot = name.indexOf('.')

  return dot < 0
    ? quoteName(name)
    : `${quoteName(name.slice(0, dot))}.${quoteName(name.slice(dot + 1))}`
}

function unquote(name: string): string {
  return name.startsWith('"') ? name.slice(1, -1) : name
}

/** `"public"."order"` and `public.order` are the same table. */
function unquoteQualified(name: string): string {
  const parts = name.match(/("[^"]*"|[^.]+)/g) ?? [name]

  return parts.map(unquote).join('.')
}

/** Three or more newlines where a block was removed read as a gap. */
function trimBlank(code: string): string {
  return code.replace(/\n{3,}/g, '\n\n')
}

/** Nothing is returned that does not parse: the file is the record. */
function commit(code: string): PatchResult {
  const parsed = parseDbml(code)

  return parsed.ok
    ? { ok: true, code }
    : { ok: false, reason: `That change would break the file at line ${parsed.line}: ${parsed.message}` }
}

/**
 * Puts a table in one group, or in none.
 *
 * One call rather than a remove and an add, because DBML allows a table in at
 * most one group — "Table central.admins is already in group central", which
 * the parser says and this would otherwise hit on every move. So the control is
 * a choice, not a set of switches, and the old membership goes first.
 */
export function setGroup(code: string, table: string, group: string | null): PatchResult {
  let next = code

  for (const current of groupsHolding(code, table)) {
    const removed = removeFromGroup(next, current, table)

    if (!removed.ok) {
      return removed
    }

    next = removed.code
  }

  return group === null ? { ok: true, code: next } : addToGroup(next, group, table)
}

/** Which groups name this table; at most one, but read rather than assumed. */
export function groupsHolding(code: string, table: string): string[] {
  const parsed = parseDbml(code)

  return parsed.ok
    ? parsed.model.groups.filter((one) => one.tables.includes(table)).map((one) => one.name)
    : []
}
