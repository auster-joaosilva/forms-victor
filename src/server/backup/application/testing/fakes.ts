import { Readable } from 'node:stream'
import type { LegacyFileName } from '../../domain/keys'
import type { BackupStore } from '../../ports/backup-store'
import type { Clock } from '../../ports/clock'
import type { DatabaseDumper } from '../../ports/database-dumper'
import type { LegacyFiles } from '../../ports/legacy-files'
import type { SourceFiles } from '../../ports/source-files'

export async function readAll(stream: Readable): Promise<Buffer> {
  const chunks: Uint8Array[] = []
  for await (const chunk of stream) chunks.push(Buffer.from(chunk as Uint8Array))
  return Buffer.concat(chunks)
}

export function memoryBackupStore(initial: Record<string, string> = {}) {
  const objects = new Map<string, Buffer>(Object.entries(initial).map(([key, text]) => [key, Buffer.from(text)]))
  const deleted: string[][] = []
  const store: BackupStore = {
    async put(key, stream) {
      const body = await readAll(stream)
      objects.set(key, body)
      return { bytes: body.length }
    },
    async get(key) {
      const body = objects.get(key)
      return body ? Readable.from([body]) : null
    },
    async list(prefix) {
      return [...objects.keys()].filter((key) => key.startsWith(prefix)).sort()
    },
    async delete(keys) {
      deleted.push(keys)
      for (const key of keys) objects.delete(key)
    },
  }
  return { store, objects, deleted }
}

export function fakeDumper(outcome: { content?: string; error?: Error } = {}) {
  const restores: { targetUrl: string; body: string }[] = []
  const dumper: DatabaseDumper = {
    dump() {
      return {
        stream: Readable.from([Buffer.from(outcome.content ?? 'PGDMP')]),
        done: outcome.error ? Promise.reject(outcome.error) : Promise.resolve(),
      }
    },
    async restore(stream, targetUrl) {
      restores.push({ targetUrl, body: (await readAll(stream)).toString() })
    },
  }
  return { dumper, restores }
}

export function memorySourceFiles(keys: string[], backup: ReturnType<typeof memoryBackupStore>) {
  const copies: [string, string][] = []
  const sourceFiles: SourceFiles = {
    async list() {
      return [...keys]
    },
    async copyTo(sourceKey, backupKey) {
      copies.push([sourceKey, backupKey])
      backup.objects.set(backupKey, Buffer.from(sourceKey))
    },
  }
  return { sourceFiles, copies }
}

export function memoryLegacyFiles(files: Partial<Record<LegacyFileName, string>>) {
  const opened: LegacyFileName[] = []
  const legacyFiles: LegacyFiles = {
    async open(name) {
      opened.push(name)
      const text = files[name]
      return text === undefined ? null : Readable.from([Buffer.from(text)])
    },
  }
  return { legacyFiles, opened }
}

export const fixedClock = (iso: string): Clock => ({ now: () => new Date(iso) })
