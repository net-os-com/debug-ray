import type { ErdModel, ErdTable } from './model'

export type EloquentRelation = {
  /** The method you would write on the model. */
  method: string
  /** Its body, as the inspector shows it. */
  signature: string
  crossDatabase: boolean
}

/**
 * The relations a Laravel model would declare, read off the foreign keys.
 *
 * This is the design's reason for the panel: the diagram already knows which
 * way every key points, and the thing a developer actually wants from it is
 * the `belongsTo` or `hasMany` to paste into a model. A pivot table — one with
 * no primary key of its own and exactly two foreign keys — is reported as the
 * `belongsToMany` it stands for rather than as a model nobody writes.
 */
export function eloquentRelations(model: ErdModel, table: ErdTable): EloquentRelation[] {
  const out: EloquentRelation[] = []
  const byName = new Map(model.tables.map((one) => [one.name, one]))

  for (const relation of model.relations) {
    if (relation.from.table === table.name) {
      const method = camel(singular(relation.from.column.replace(/_id$/, '')))

      out.push({
        method: method === '' ? camel(singular(bare(relation.to.table))) : method,
        signature: `belongsTo(${studly(singular(bare(relation.to.table)))}::class, '${
          relation.from.column
        }')`,
        crossDatabase: relation.crossDatabase,
      })
    }

    if (relation.to.table === table.name) {
      const source = byName.get(relation.from.table)

      if (source !== undefined && isPivot(source, model)) {
        const other = model.relations.find(
          (one) => one.from.table === source.name && one.to.table !== table.name,
        )

        if (other !== undefined) {
          out.push({
            method: camel(bare(other.to.table)),
            signature: `belongsToMany(${studly(
              singular(bare(other.to.table)),
            )}::class, '${bare(source.name)}')`,
            crossDatabase: other.crossDatabase || relation.crossDatabase,
          })
        }

        continue
      }

      out.push({
        method: camel(bare(relation.from.table)),
        signature: `hasMany(${studly(singular(bare(relation.from.table)))}::class, '${
          relation.from.column
        }')`,
        crossDatabase: relation.crossDatabase,
      })
    }
  }

  return out
}

/** The Eloquent model a table maps to, as `php artisan` would name it. */
export function modelName(table: ErdTable): string {
  return studly(singular(bare(table.name)))
}

/**
 * A join table: no primary key of its own, and exactly two outgoing keys.
 *
 * Both halves matter. `role_user` has two keys and no id, and stands for a
 * `belongsToMany`; `invites` has two keys and an id of its own, and is a model
 * in its own right.
 */
function isPivot(table: ErdTable, model: ErdModel): boolean {
  const outgoing = model.relations.filter((one) => one.from.table === table.name)

  return outgoing.length === 2 && !table.columns.some((column) => column.primary)
}

/** `landlord.tenants` is the `tenants` table; the schema is not part of the name. */
function bare(name: string): string {
  const dot = name.indexOf('.')

  return dot < 0 ? name : name.slice(dot + 1)
}

export function singular(name: string): string {
  return name
    .replace(/ies$/, 'y')
    .replace(/(s|x|z|ch|sh)es$/, '$1')
    .replace(/([^s])s$/, '$1')
}

export function studly(name: string): string {
  return name
    .split('_')
    .filter(Boolean)
    .map((word) => (word[0] ?? '').toUpperCase() + word.slice(1))
    .join('')
}

function camel(name: string): string {
  const studlied = studly(name)

  return studlied === '' ? name : (studlied[0] ?? '').toLowerCase() + studlied.slice(1)
}
