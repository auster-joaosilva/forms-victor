import { execFileSync } from 'node:child_process'
import { Readable } from 'node:stream'
import pg, { type QueryResultRow } from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { resetDatabase } from '../../../../tests/integration/db'
import { prismaRateLimitStore } from '@/server/rate-limit/adapters/prisma-rate-limit-store'
import { getEnv } from '@/server/shared/env'
import { createPgDumper } from './pg-dump'

function hasPgTools(): boolean {
  try {
    execFileSync('pg_dump', ['--version'], { stdio: 'ignore' })
    execFileSync('pg_restore', ['--version'], { stdio: 'ignore' })
    return true
  } catch {
    return false
  }
}

const available = hasPgTools()
if (!available) console.warn('pg-dump.int.test: sem pg_dump/pg_restore no PATH; o teste de dump e restauração foi pulado.')

const env = getEnv()
const withDatabase = (name: string) => {
  const url = new URL(env.DATABASE_URL)
  url.pathname = `/${name}`
  return url.toString()
}
const scratch = `forms_victor_restore_${process.pid}_test`
const scratchUrl = withDatabase(scratch)

async function sql<Row extends QueryResultRow = QueryResultRow>(url: string, statement: string): Promise<Row[]> {
  const client = new pg.Client({ connectionString: url })
  await client.connect()
  try {
    return (await client.query<Row>(statement)).rows
  } finally {
    await client.end()
  }
}

const countRows = async (url: string, table: string) =>
  Number((await sql<{ count: string }>(url, `SELECT count(*)::text AS count FROM "${table}"`))[0]?.count)

// Consome o stream sem ler o conteúdo: resolve quando ele termina ou é destruído.
function settles(stream: Readable): Promise<'end' | 'error'> {
  return new Promise((resolve) => {
    stream.once('end', () => resolve('end'))
    stream.once('close', () => resolve('error'))
    stream.once('error', () => resolve('error'))
    stream.resume()
  })
}

describe.skipIf(!available)('createPgDumper', () => {
  beforeAll(async () => {
    await resetDatabase()
    for (const key of ['a', 'b', 'c']) await prismaRateLimitStore.increment(key, new Date('2026-10-04T06:00:00Z'))
    await sql(env.DATABASE_URL, `DROP DATABASE IF EXISTS "${scratch}" WITH (FORCE)`)
    await sql(env.DATABASE_URL, `CREATE DATABASE "${scratch}"`)
  })

  afterAll(async () => {
    await sql(env.DATABASE_URL, `DROP DATABASE IF EXISTS "${scratch}" WITH (FORCE)`)
  })

  it('streams a dump of the test database into another database with the same counts', async () => {
    const dumper = createPgDumper({ databaseUrl: env.DATABASE_URL })
    const dump = dumper.dump()
    await Promise.all([dumper.restore(dump.stream, scratchUrl), dump.done])
    expect(await countRows(scratchUrl, 'rate_limit_hits')).toBe(3)
    expect(await countRows(scratchUrl, '_prisma_migrations')).toBe(await countRows(env.DATABASE_URL, '_prisma_migrations'))
  })

  it('rejects done with the stderr of pg_dump when the database does not exist', async () => {
    const dump = createPgDumper({ databaseUrl: withDatabase('nao_existe_test') }).dump()
    dump.stream.resume()
    await expect(dump.done).rejects.toThrow(/pg_dump[\s\S]*nao_existe_test/)
  })

  it('ends the stream when pg_dump fails, so a consumer awaiting it never hangs', async () => {
    const dump = createPgDumper({ databaseUrl: withDatabase('nao_existe_test') }).dump()
    dump.done.catch(() => undefined)
    await expect(settles(dump.stream)).resolves.toBeDefined()
  }, 5000)

  it('rejects done and ends the stream when pg_dump cannot be spawned', async () => {
    const dump = createPgDumper({ databaseUrl: env.DATABASE_URL, dumpCommand: 'pg_dump_que_nao_existe' }).dump()
    const ended = settles(dump.stream)
    await expect(dump.done).rejects.toThrow(/pg_dump não iniciou/)
    await expect(ended).resolves.toBe('error')
  }, 5000)

  it('rejects the restore when pg_restore cannot read the input', async () => {
    const dumper = createPgDumper({ databaseUrl: env.DATABASE_URL })
    await expect(dumper.restore(Readable.from([Buffer.from('não é um dump')]), scratchUrl)).rejects.toThrow(/pg_restore/)
  })
})
