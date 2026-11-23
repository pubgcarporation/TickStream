import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import pg from 'pg'
import { env } from './env'

// Counts and money in this system fit comfortably in a JS number; parse int8 and numeric as numbers.
pg.types.setTypeParser(20, (value) => Number(value))
pg.types.setTypeParser(1700, (value) => Number(value))

let pool: pg.Pool | undefined

export function getPool(): pg.Pool {
  pool ??= new pg.Pool({ connectionString: env.databaseUrl(), max: 10 })
  return pool
}

export async function query<T extends pg.QueryResultRow = pg.QueryResultRow>(
  text: string,
  params: unknown[] = [],
): Promise<T[]> {
  const result = await getPool().query<T>(text, params)
  return result.rows
}

export async function queryOne<T extends pg.QueryResultRow = pg.QueryResultRow>(
  text: string,
  params: unknown[] = [],
): Promise<T | undefined> {
  const rows = await query<T>(text, params)
  return rows[0]
}

export async function migrate(): Promise<void> {
  const file = fileURLToPath(new URL('../../database/migrations/001_init.sql', import.meta.url))
  await getPool().query(readFileSync(file, 'utf8'))
}

export async function closeDb(): Promise<void> {
  await pool?.end()
  pool = undefined
}
