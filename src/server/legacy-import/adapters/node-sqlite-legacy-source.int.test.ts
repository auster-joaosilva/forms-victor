import { createHash, randomUUID } from 'node:crypto'
import { chmodSync, existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { buildLegacyDatabase } from '../../../../tests/integration/legacy-portal'
import { legacyDatabase, probeReadOnly, readLegacySnapshot } from './node-sqlite-legacy-source'

const paths: string[] = []
const newPath = () => {
  const path = join(tmpdir(), `portal-${randomUUID()}.db`)
  paths.push(path)
  return path
}
const fingerprint = (path: string) => ({ mtime: statSync(path).mtimeMs, sha: createHash('sha256').update(readFileSync(path)).digest('hex') })

afterEach(() => {
  vi.restoreAllMocks()
  for (const path of paths.splice(0)) for (const suffix of ['', '-wal', '-shm', '-journal']) rmSync(path + suffix, { force: true })
})

describe('legacy SQLite source', () => {
  it('reads every table without touching the file', async () => {
    const path = newPath()
    buildLegacyDatabase(path)
    const before = fingerprint(path)
    const source = readLegacySnapshot(path)
    expect((await source.users()).map((user) => user.usuario)).toEqual(['victor', 'maria', 'gestora', 'regina', 'otavio', 'chico'])
    expect(await source.responses()).toHaveLength(4)
    expect(await source.adhesions()).toHaveLength(3)
    expect(await source.events()).toHaveLength(4)
    expect(await source.invitations()).toHaveLength(1)
    expect(fingerprint(path)).toEqual(before)
    expect(['-wal', '-shm', '-journal'].filter((suffix) => existsSync(path + suffix))).toEqual([])
  })

  it('reads all tables inside one read transaction and closes the connection', () => {
    const path = newPath()
    buildLegacyDatabase(path)
    const calls: string[] = []
    const exec = DatabaseSync.prototype.exec
    const prepare = DatabaseSync.prototype.prepare
    const close = DatabaseSync.prototype.close
    vi.spyOn(DatabaseSync.prototype, 'exec').mockImplementation(function (this: DatabaseSync, sql: string) {
      calls.push(sql)
      return exec.call(this, sql)
    })
    vi.spyOn(DatabaseSync.prototype, 'prepare').mockImplementation(function (this: DatabaseSync, sql: string) {
      calls.push('prepare')
      return prepare.call(this, sql)
    })
    vi.spyOn(DatabaseSync.prototype, 'close').mockImplementation(function (this: DatabaseSync) {
      calls.push('close')
      return close.call(this)
    })
    readLegacySnapshot(path)
    expect(calls[0]).toBe('BEGIN')
    expect(calls.slice(-2)).toEqual(['COMMIT', 'close'])
    expect(calls.filter((call) => call === 'prepare').length).toBeGreaterThanOrEqual(5)
    expect(calls.filter((call) => call !== 'prepare' && call !== 'close')).toEqual(['BEGIN', 'COMMIT'])
  })

  it('reads the committed snapshot while the old portal holds a write in WAL mode', async () => {
    const path = newPath()
    buildLegacyDatabase(path)
    const portal = new DatabaseSync(path)
    portal.exec('PRAGMA journal_mode = WAL')
    portal.exec('BEGIN IMMEDIATE')
    portal.prepare("INSERT INTO usuarios (usuario, papel, sal, resumo, criado_em) VALUES ('novo', 'equipe', 's', 'r', '2026-10-01T12:00:00.000Z')").run()
    try {
      const before = fingerprint(path)
      expect((await readLegacySnapshot(path).users()).map((user) => user.usuario)).not.toContain('novo')
      expect(fingerprint(path)).toEqual(before)
    } finally {
      portal.exec('ROLLBACK')
      portal.close()
    }
  })

  it('never writes to the file it reads', () => {
    const path = newPath()
    buildLegacyDatabase(path)
    vi.spyOn(DatabaseSync.prototype, 'exec').mockImplementation(function (this: DatabaseSync) {
      this.prepare("INSERT INTO eventos (quando, o_que) VALUES ('x', 'y')").run()
    })
    expect(() => readLegacySnapshot(path)).toThrow(/readonly/i)
  })

  it('tells whether the file exists and opens as a SQLite database, without creating it', () => {
    const missing = newPath()
    expect(probeReadOnly(missing)).toEqual({ available: false })
    expect(existsSync(missing)).toBe(false)
    const garbage = newPath()
    writeFileSync(garbage, 'não é um banco')
    expect(probeReadOnly(garbage)).toEqual({ available: false, reason: 'file is not a database' })
    const path = newPath()
    buildLegacyDatabase(path)
    expect(probeReadOnly(path)).toEqual({ available: true })
  })

  // Reproduz o volume do portal antigo: diretório que o app não grava e um banco em WAL fechado sem o -shm.
  it.skipIf(process.getuid?.() === 0)('says the old portal must be running when SQLite cannot create the -shm', async () => {
    const dir = join(tmpdir(), `legacy-${randomUUID()}`)
    mkdirSync(dir)
    const path = join(dir, 'portal.db')
    buildLegacyDatabase(path)
    const portal = new DatabaseSync(path)
    portal.exec('PRAGMA journal_mode = WAL')
    portal.close()
    chmodSync(dir, 0o555)
    try {
      expect(existsSync(`${path}-shm`)).toBe(false)
      expect(probeReadOnly(path)).toEqual({
        available: false,
        reason: 'o portal antigo precisa estar no ar (o SQLite cria o portal.db-shm); suba o container antigo e recarregue',
      })
      const db = legacyDatabase(path)
      expect(await db.probe()).toMatchObject({ available: false })
    } finally {
      chmodSync(dir, 0o755)
      rmSync(dir, { recursive: true, force: true })
    }
  })
})
