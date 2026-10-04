import type { Readable } from 'node:stream'

export interface RunningDump {
  stream: Readable
  done: Promise<void>
}

export interface DatabaseDumper {
  dump(): RunningDump
  restore(stream: Readable, targetUrl: string): Promise<void>
}
