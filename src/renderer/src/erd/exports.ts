import { LANDLORD, type ErdColumn, type ErdModel, type ErdTable } from './model'

/**
 * The schema as Laravel migrations, and as SQL.
 *
 * Both are offered as text to copy rather than as files written into the
 * repository. A migration is a decision about history — its timestamp, whether
 * it replaces an existing one, which connection it names — and writing one
 * unasked would put the ERD on the write side of a line the design draws
 * explicitly: the ERD reads.
 */
export function toMigrations(model: ErdModel): string {
  return model.tables.map((table) => migration(table, model)).join('\n\n')
}

function migration(table: ErdTable, model: ErdModel): string {
  const file = `database/migrations/${table.scope === LANDLORD ? 'landlord' : 'tenant'}/xxxx_xx_xx_create_${bare(
    table.name,
  )}_table.php`
  const connection =
    table.scope === LANDLORD
      ? "    protected ?string $connection = 'landlord';\n\n"
      : ''
  const lines = table.columns.map((column) => `            ${blueprint(column)}`)

  for (const relation of model.relations.filter((one) => one.from.table === table.name)) {
    if (relation.crossDatabase) {
      lines.push(
        `            // ${relation.from.column} points at ${relation.to.table} in another database;`,
        '            // MySQL cannot enforce that, so no foreign key is declared.',
      )

      continue
    }

    lines.push(
      `            $table->foreign('${relation.from.column}')->references('${
        relation.to.column
      }')->on('${bare(relation.to.table)}')${
        relation.onDelete === '' ? '' : `->onDelete('${relation.onDelete}')`
      };`,
    )
  }

  for (const index of table.indexes) {
    const columns = index.columns.map((one) => `'${one}'`).join(', ')

    lines.push(`            $table->${index.unique ? 'unique' : 'index'}([${columns}]);`)
  }

  return `// ${file}
return new class extends Migration
{
${connection}    public function up(): void
    {
        Schema::create('${bare(table.name)}', function (Blueprint $table): void {
${lines.join('\n')}
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('${bare(table.name)}');
    }
};`
}

/** One column, as the Blueprint method that builds it. */
function blueprint(column: ErdColumn): string {
  const call = method(column)
  const chain: string[] = []

  if (column.nullable && !column.primary) {
    chain.push('->nullable()')
  }

  if (column.unique && !column.primary) {
    chain.push('->unique()')
  }

  if (column.defaultValue !== null) {
    chain.push(`->default(${literal(column.defaultValue)})`)
  }

  if (column.note !== null) {
    chain.push(`->comment('${column.note.replace(/'/g, "\\'")}')`)
  }

  // The trailing comment names the DBML type the Blueprint has no method for,
  // and sits after the statement rather than inside the chain: `->string('plan')
  // /* tenant_plan */->nullable()` is valid PHP and reads like a mistake.
  const unknown = call.includes('/*') ? ` // ${column.type}` : ''
  const built = call.replace(/ \/\* .* \*\/$/, '')

  return `$table->${built}${chain.join('')};${unknown}`
}

function method(column: ErdColumn): string {
  const type = column.type.toLowerCase()
  const name = `'${column.name}'`

  if (column.primary && column.increment) {
    return type.startsWith('big') ? `id(${name})` : `increments(${name})`
  }

  const size = /\((\d+)/.exec(column.type)?.[1]

  if (type.startsWith('varchar')) {
    return size === undefined ? `string(${name})` : `string(${name}, ${size})`
  }

  if (type.startsWith('char')) {
    return `char(${name}${size === undefined ? '' : `, ${size}`})`
  }

  if (type.startsWith('bigint')) {
    return `unsignedBigInteger(${name})`
  }

  if (type === 'int' || type === 'integer') {
    return `integer(${name})`
  }

  if (type === 'smallint') {
    return `smallInteger(${name})`
  }

  if (type === 'tinyint' || type === 'bool' || type === 'boolean') {
    return `boolean(${name})`
  }

  if (type.startsWith('decimal')) {
    return `decimal(${name}${size === undefined ? '' : `, ${size}`})`
  }

  if (type === 'text') {
    return `text(${name})`
  }

  if (type === 'json') {
    return `json(${name})`
  }

  if (type === 'uuid') {
    return `uuid(${name})`
  }

  if (type === 'date') {
    return `date(${name})`
  }

  if (type === 'datetime') {
    return `dateTime(${name})`
  }

  if (type === 'timestamp') {
    return `timestamp(${name})`
  }

  // An enum type, or anything this does not know: the column keeps its name and
  // the type is spelled out, which is a line a developer can finish.
  return `string(${name}) /* unknown */`
}

function literal(value: string): string {
  return /^-?\d+(\.\d+)?$/.test(value) ? value : `'${value.replace(/'/g, "\\'")}'`
}

/**
 * The schema as MySQL.
 *
 * One `CREATE TABLE` per table, grouped by database, with the cross-database
 * references left out: MySQL cannot declare a foreign key into another schema,
 * and emitting one would produce a script that does not run.
 */
export function toSql(model: ErdModel): string {
  const scopes = [...new Set(model.tables.map((table) => table.scope))]

  return scopes
    .map((scope) => {
      const tables = model.tables.filter((table) => table.scope === scope)

      return [
        `-- ${scope}`,
        ...tables.map((table) => createTable(table, model)),
      ].join('\n\n')
    })
    .join('\n\n')
}

function createTable(table: ErdTable, model: ErdModel): string {
  const lines = table.columns.map((column) => {
    const parts = [`  \`${column.name}\` ${column.type}`]

    if (!column.nullable) {
      parts.push('NOT NULL')
    }

    if (column.increment) {
      parts.push('AUTO_INCREMENT')
    }

    if (column.defaultValue !== null) {
      parts.push(`DEFAULT ${literal(column.defaultValue)}`)
    }

    if (column.note !== null) {
      parts.push(`COMMENT '${column.note.replace(/'/g, "''")}'`)
    }

    return parts.join(' ')
  })

  const primary = table.columns.filter((column) => column.primary).map((column) => column.name)

  if (primary.length > 0) {
    lines.push(`  PRIMARY KEY (${primary.map((one) => `\`${one}\``).join(', ')})`)
  }

  for (const index of table.indexes) {
    lines.push(
      `  ${index.unique ? 'UNIQUE KEY' : 'KEY'} \`${index.name || index.columns.join('_')}\` (${index.columns
        .map((one) => `\`${one}\``)
        .join(', ')})`,
    )
  }

  for (const relation of model.relations) {
    if (relation.from.table !== table.name || relation.crossDatabase) {
      continue
    }

    lines.push(
      `  FOREIGN KEY (\`${relation.from.column}\`) REFERENCES \`${bare(relation.to.table)}\` (\`${
        relation.to.column
      }\`)${relation.onDelete === '' ? '' : ` ON DELETE ${relation.onDelete.toUpperCase()}`}`,
    )
  }

  return `CREATE TABLE \`${bare(table.name)}\` (\n${lines.join(',\n')}\n);`
}

function bare(name: string): string {
  const dot = name.indexOf('.')

  return dot < 0 ? name : name.slice(dot + 1)
}
