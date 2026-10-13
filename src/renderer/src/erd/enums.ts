import type { ErdEnum, ErdModel } from './model'

export type EnumUse = { enum: ErdEnum; columns: { table: string; column: string }[] }

/**
 * The enum a column's type names, or null.
 *
 * A column typed as an enum is spelled exactly like any other column — the
 * parser reports `varchar(255)` and `rol` the same way — so the only thing that
 * makes it a reference is a declaration with that name. A type that looks like
 * one but has none is just a type, and must not be shown as a link to something
 * that is not there.
 */
export function enumFor(enums: ErdEnum[], type: string): ErdEnum | null {
  return enums.find((one) => one.name === type) ?? null
}

/** Every enum with the columns that use it, for the sidebar's list. */
export function enumUses(model: ErdModel): EnumUse[] {
  return model.enums.map((one) => ({
    enum: one,
    columns: model.tables.flatMap((table) =>
      table.columns
        .filter((column) => enumFor(model.enums, column.type)?.name === one.name)
        .map((column) => ({ table: table.name, column: column.name })),
    ),
  }))
}
