import { spawn, type ChildProcess } from 'node:child_process'
import type { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import type { DatabaseDumper } from '../ports/database-dumper'

const STDERR_LIMIT = 4000

// O Prisma aceita ?schema=…, e o libpq recusa um parâmetro que não conhece.
function libpqUrl(url: string): string {
  const parsed = new URL(url)
  parsed.searchParams.delete('schema')
  return parsed.toString()
}

function tail(stream: Readable): () => string {
  let text = ''
  stream.setEncoding('utf8')
  stream.on('data', (chunk: string) => {
    text = (text + chunk).slice(-STDERR_LIMIT)
  })
  return () => text.trim()
}

function exitOf(child: ChildProcess, name: string, stderr: () => string): Promise<void> {
  return new Promise((resolve, reject) => {
    child.once('error', (error) => reject(new Error(`${name} não iniciou: ${error.message}`)))
    child.once('close', (code, signal) => {
      if (code === 0) resolve()
      else reject(new Error(`${name} saiu com ${code ?? signal}: ${stderr()}`))
    })
  })
}

export function createPgDumper({ databaseUrl, dumpCommand = 'pg_dump' }: { databaseUrl: string; dumpCommand?: string }): DatabaseDumper {
  return {
    dump() {
      const child = spawn(dumpCommand, ['-Fc', libpqUrl(databaseUrl)], { stdio: ['ignore', 'pipe', 'pipe'] })
      const done = exitOf(child, 'pg_dump', tail(child.stderr))
      // Quem consome o stream espera por ele e por `done` juntos: com o dump falho, o stream tem de terminar.
      done.catch((error: unknown) => child.stdout.destroy(error instanceof Error ? error : new Error(String(error))))
      return { stream: child.stdout, done }
    },
    async restore(stream, targetUrl) {
      const child = spawn('pg_restore', ['--clean', '--if-exists', '--no-owner', '-d', libpqUrl(targetUrl)], {
        stdio: ['pipe', 'ignore', 'pipe'],
      })
      const exited = exitOf(child, 'pg_restore', tail(child.stderr))
      const [piped, finished] = await Promise.allSettled([pipeline(stream, child.stdin), exited])
      // Quando o pg_restore morre, o pipe quebra com EPIPE: o erro que explica é o do processo, com o stderr.
      if (finished.status === 'rejected') throw finished.reason
      if (piped.status === 'rejected') throw piped.reason
    },
  }
}
