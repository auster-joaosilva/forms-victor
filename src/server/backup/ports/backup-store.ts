import type { Readable } from 'node:stream'

export interface BackupStore {
  put(key: string, stream: Readable): Promise<{ bytes: number }>
  get(key: string): Promise<Readable | null>
  list(prefix: string): Promise<string[]>
  delete(keys: string[]): Promise<void>
}
