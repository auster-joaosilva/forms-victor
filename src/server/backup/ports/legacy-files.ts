import type { Readable } from 'node:stream'
import type { LegacyFileName } from '../domain/keys'

export interface LegacyFiles {
  open(name: LegacyFileName): Promise<Readable | null>
}
